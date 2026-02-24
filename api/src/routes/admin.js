import express from 'express';
import { requireAuthAllowUnverified } from '../middleware/auth.js';
import db from '../services/database.js';
import { appendCourierRow, getCouriers, getOrders, updateCourierRowByCourierId, updateOrderRowByOrderId } from '../services/sheets.js';
import { isAllowedAdminOrderStatus, normalizeOrderStatus } from '../domain/orderStatus.js';

const router = express.Router();

function parseIdList(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function isAdmin(tgId) {
  const list = parseIdList(process.env.TELEGRAM_ADMIN_IDS);
  const n = Number(String(tgId));
  return Number.isFinite(n) && list.includes(n);
}

function safeJson(raw, fallback) {
  try {
    return JSON.parse(String(raw || ''));
  } catch {
    return fallback;
  }
}

function parseCourierData(order, dbOrder) {
  const raw = String(order?.courier_data || '').trim() || String(dbOrder?.courier_data || '').trim();
  const cd = raw ? safeJson(raw, null) : null;
  const address = String(order?.delivery_address || '').trim() || String(cd?.address || '').trim();
  const phone = String(order?.user_phone || '').trim() || String(cd?.phone || '').trim();
  const userName = String(order?.user_name || '').trim() || String(cd?.user?.username || '').trim() || String(cd?.user?.tgId || '').trim();
  const comment = String(order?.comment || '').trim() || String(cd?.comment || '').trim();
  return { address, phone, userName, comment };
}

function periodStart(period) {
  const now = new Date();
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

router.use(requireAuthAllowUnverified);
router.use((req, res, next) => {
  if (String(req.user?.status || '') === 'admin') return next();
  if (!isAdmin(req.user?.tgId)) return res.status(403).json({ error: 'Forbidden' });
  next();
});

router.get('/orders', async (req, res) => {
  try {
    const city = String(req.query.city || '');
    if (!city) return res.status(400).json({ error: 'City parameter is required' });
    const [rows, couriers] = await Promise.all([getOrders(city), getCouriers(city)]);
    const courierMap = new Map(couriers.map((c) => [String(c.courier_id || ''), c]));
    const orders = rows
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .map((o) => {
        const dbOrder = db.orders.get(String(o.order_id || ''));
        const cd = parseCourierData(o, dbOrder);
        const items = Array.isArray(safeJson(o.items_json, [])) ? safeJson(o.items_json, []) : [];
        const courier = courierMap.get(String(o.courier_id || ''));
        const totalAmount = Number(o.final_amount || 0) > 0 ? Number(o.final_amount || 0) : Number(o.total_amount || 0);
        return {
          id: String(o.order_id || ''),
          userId: String(o.user_id || ''),
          userName: cd.userName,
          userPhone: cd.phone,
          deliveryAddress: cd.address || '-',
          deliveryDate: String(o.delivery_date || ''),
          deliveryTime: String(o.delivery_time || ''),
          courierId: String(o.courier_id || ''),
          courierName: courier ? String(courier.name || '') : '',
          status: normalizeOrderStatus(o.status),
          totalAmount,
          paymentMethod: String(o.payment_method || ''),
          createdAt: String(o.created_at || ''),
          itemCount: Number(o.item_count || (Array.isArray(items) ? items.length : 0) || 0),
          items: (Array.isArray(items) ? items : []).map((it) => ({
            name: String(it.name || it.productName || it.product_id || ''),
            quantity: Number(it.quantity || it.qty || 0),
            price: Number(it.price || it.unit_price || 0),
            options: it.variant ? { variant: String(it.variant) } : {},
          })),
        };
      });
    res.json({ orders });
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/couriers', async (req, res) => {
  try {
    const city = String(req.query.city || '');
    if (!city) return res.status(400).json({ error: 'City parameter is required' });
    const couriers = await getCouriers(city);
    res.json({ couriers });
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to fetch couriers' });
  }
});

router.post('/couriers/status', async (req, res) => {
  try {
    const courierId = String(req.body?.courierId || '').trim();
    const active = Boolean(req.body?.active);
    const city = String(req.body?.city || req.query.city || '').trim();
    if (!city) return res.status(400).json({ error: 'City parameter is required' });
    if (!courierId) return res.status(400).json({ error: 'courierId is required' });
    await updateCourierRowByCourierId(city, courierId, { active: active ? 'TRUE' : 'FALSE' });
    res.json({ ok: true });
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to update courier' });
  }
});

router.post('/couriers/add', async (req, res) => {
  try {
    const city = String(req.body?.city || '').trim();
    const courierId = String(req.body?.courierId || '').trim();
    const name = String(req.body?.name || '').trim();
    const tgId = String(req.body?.tgId || '').trim();
    const timeFrom = String(req.body?.timeFrom || '').trim();
    const timeTo = String(req.body?.timeTo || '').trim();
    if (!city) return res.status(400).json({ error: 'City parameter is required' });
    if (!courierId) return res.status(400).json({ error: 'courierId is required' });
    if (!name) return res.status(400).json({ error: 'name is required' });
    await appendCourierRow(city, {
      courier_id: courierId,
      name,
      tg_id: tgId,
      active: 'TRUE',
      time_from: timeFrom,
      time_to: timeTo,
    });
    res.json({ ok: true });
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to add courier' });
  }
});

router.get('/promos', async (req, res) => {
  const promos = db.getPromos().map((p) => ({
    id: String(p.id || ''),
    title: String(p.title || ''),
    description: String(p.description || ''),
    active: Boolean(p.active),
    value: Number(p.value || 0),
    type: String(p.type || ''),
    minTotal: Number(p.minTotal || 0),
    startsAt: String(p.startsAt || ''),
    endsAt: String(p.endsAt || ''),
  }));
  res.json({ promos });
});

router.post('/promos/status', async (req, res) => {
  const promoId = String(req.body?.promoId || '').trim();
  const active = Boolean(req.body?.active);
  if (!promoId) return res.status(400).json({ error: 'promoId is required' });
  const ok = db.setPromoActive(promoId, active);
  if (!ok) return res.status(404).json({ error: 'Promo not found' });
  res.json({ ok: true });
});

router.delete('/promos/:promoId', async (req, res) => {
  const promoId = String(req.params?.promoId || '').trim();
  if (!promoId) return res.status(400).json({ error: 'promoId is required' });
  const ok = db.deletePromo(promoId);
  if (!ok) return res.status(404).json({ error: 'Promo not found' });
  res.json({ ok: true });
});

router.post('/orders/status', async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    const status = String(req.body?.status || '').trim().toLowerCase();
    const city = String(req.body?.city || req.query.city || '').trim();
    if (!city) return res.status(400).json({ error: 'City parameter is required' });
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    if (!status) return res.status(400).json({ error: 'status is required' });
    if (!isAllowedAdminOrderStatus(status)) return res.status(400).json({ error: 'Invalid status' });
    const next = normalizeOrderStatus(status);
    await updateOrderRowByOrderId(city, orderId, { status: next });
    const local = db.orders.get(String(orderId));
    if (local) {
      local.status = next;
      db.orders.set(String(orderId), local);
    }
    res.json({ ok: true });
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to update order' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const city = String(req.query.city || '');
    const period = String(req.query.period || 'today');
    if (!city) return res.status(400).json({ error: 'City parameter is required' });
    const [rows, couriers] = await Promise.all([getOrders(city), getCouriers(city)]);
    const start = periodStart(period);
    const promos = db.getPromos();
    const activePromos = promos.filter((p) => Boolean(p.active)).length;
    const activeCouriers = couriers.filter((c) => Boolean(c.active)).length;
    const filtered = rows.filter((o) => {
      const dt = new Date(String(o.created_at || ''));
      if (Number.isNaN(dt.getTime())) return true;
      return dt >= start;
    });
    const deliveredOrders = filtered.filter((o) => normalizeOrderStatus(o.status) === 'delivered').length;
    const activeOrders = filtered.filter((o) => {
      const st = normalizeOrderStatus(o.status);
      return st === 'pending' || st === 'assigned' || st === 'picked_up';
    }).length;
    const totalRevenue = filtered.reduce((sum, o) => {
      const v = Number(o.final_amount || 0) > 0 ? Number(o.final_amount || 0) : Number(o.total_amount || 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const stats = {
      totalOrders: filtered.length,
      totalRevenue,
      activeOrders,
      deliveredOrders,
      activeCouriers,
      activePromos,
    };
    res.json({ stats });
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
