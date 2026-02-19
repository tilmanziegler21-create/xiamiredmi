import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = String(process.env.FRONTEND_URL || 'http://localhost:5173');
      if (origin === allowed) return callback(null, true);
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

const server = app.listen(PORT, () => {
  const actualPort = server.address().port;
  console.log(`🚀 Server running on port ${actualPort}`);
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
