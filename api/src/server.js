import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/order.js';
import productRoutes from './routes/product.js';
import couriersRoutes from './routes/couriers.js';
import configRoutes from './routes/config.js';
import analyticsRoutes from './routes/analytics.js';
import favoritesRoutes from './routes/favorites.js';
import bonusesRoutes from './routes/bonuses.js';
import adminRoutes from './routes/admin.js';
import courierPanelRoutes from './routes/courier.js';
import referralRoutes from './routes/referral.js';
import fortuneRoutes from './routes/fortune.js';
import cron from 'node-cron';
import db from './services/database.js';
import { updateOrderRowByOrderId } from './services/sheets.js';
import { readSheetTable } from './services/sheets.js';
import { requireAdmin, requireAuthAllowUnverified } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

if (!process.env.JWT_SECRET && String(process.env.NODE_ENV || '') === 'production') {
  console.error('FATAL: JWT_SECRET is not set in production');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8080;

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeOriginValue(v) {
  const raw = String(v || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

function parseAllowedOrigins() {
  const raw = String(process.env.FRONTEND_URL || '').trim();
  if (!raw) return ['http://localhost:5173'];
  return raw
    .split(',')
    .map((s) => normalizeOriginValue(s))
    .filter(Boolean);
}

function originAllowed(origin, allowedList) {
  const originNormalized = normalizeOriginValue(origin);
  let originHost = '';
  let originHostname = '';
  try {
    const u = new URL(origin);
    originHost = u.host;
    originHostname = u.hostname;
  } catch {
  }

  for (const a of allowedList) {
    if (!a) continue;
    if (a.includes('://') && a === originNormalized) return true;
    if (!a.includes('://') && (a === originHost || a === originHostname)) return true;
    if (a.includes('*')) {
      const re = new RegExp(`^${escapeRegExp(a).replace(/\\\*/g, '.*')}$`);
      if (re.test(originNormalized)) return true;
      if (originHost && re.test(originHost)) return true;
      if (originHostname && re.test(originHostname)) return true;
    }
  }
  return false;
}

app.use(helmet());
const limiter = rateLimit({ windowMs: 60_000, max: 60 });
app.use('/api/', limiter);
const authLimiter = rateLimit({ windowMs: 60_000, max: 10, message: 'Слишком много попыток' });
app.use('/api/auth', authLimiter);
const spinLimiter = rateLimit({ windowMs: 3_600_000, max: 3, message: 'Лимит спинов' });
app.use('/api/fortune/spin', spinLimiter);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = parseAllowedOrigins();
      if (originAllowed(origin, allowed)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/product', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/couriers', couriersRoutes);
app.use('/api/config', configRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/bonuses', bonusesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courier', courierPanelRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/fortune', fortuneRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/health/sheets', requireAuthAllowUnverified, requireAdmin, async (req, res) => {
  try {
    const city = String(req.query?.city || process.env.CITY_CODES || '').split(',')[0].trim();
    const table = await readSheetTable('products', city);
    const headers = Array.isArray(table.headers) ? table.headers : [];
    const lower = new Set(headers.map((h) => String(h || '').trim().toLowerCase()));
    const required = ['sku', 'name', 'price', 'stock', 'active'];
    const missingHeaders = required.filter((h) => !lower.has(h));
    res.json({
      ok: true,
      city,
      sheet: table.sheet,
      rowCount: Array.isArray(table.rows) ? table.rows.length : 0,
      missingHeaders,
    });
  } catch (e) {
    const status = Number(e?.status) || Number(e?.response?.status) || 500;
    const payload = {
      ok: false,
      error: String(e?.message || 'Sheets error'),
      code: e?.code,
      missing: e?.missing,
      status,
    };
    res.status(status).json(payload);
  }
});

const server = app.listen(PORT, () => {
  const actualPort = server.address().port;
  console.log(`🚀 Server running on port ${actualPort}`);
});

server.on('listening', async () => {
  const cities = String(process.env.CITY_CODES || 'MU')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const c of cities) {
    try {
      await readSheetTable('products', c);
      await readSheetTable('couriers', c);
      console.log(`Cache warmed for city: ${c}`);
    } catch {
    }
  }
});

cron.schedule('*/1 * * * *', () => {
  try {
    const res = db.cleanupExpiredReservations();
    if (res.expiredOrders.length) {
      for (const oid of res.expiredOrders) {
        const order = db.orders.get(String(oid));
        if (order && (order.status === 'buffer' || order.status === 'pending')) {
          order.status = 'cancelled';
          order.cancelled_at = new Date().toISOString();
          db.orders.set(String(oid), order);
          const city = String(order.city || '');
          if (city) {
            updateOrderRowByOrderId(city, String(oid), { status: 'cancelled' }).catch(() => {});
          }
        }
      }
    }
  } catch (e) {
    console.error('Reservation cleanup error:', e);
  }
});

export default app;
