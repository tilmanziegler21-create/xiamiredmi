import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';
import { getCouriers, getOrders, updateOrderRowByOrderId, updateCourierRowByCourierId } from '../services/sheets.js';
import { isAllowedCourierOrderStatus, normalizeOrderStatus } from '../domain/orderStatus.js';

const router = express.Router();

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

async function resolveCourierIdForUser(city, tgId) {
  try {
    const list = await getCouriers(city);
    const c = list.find((x) => String(x?.tg_id || '') === String(tgId)) || list.find((x) => String(x?.courier_id || '') === String(tgId));
    return c ? String(c.courier_id || '').trim() : '';
  } catch {
    return '';
  }
}

router.get('/orders', requireAuth, async (req, res) => {
  try {
    const city = String(req.query.city || '');
    if (!city) return res.status(400).json({ error: 'City parameter is required' });

    const status = String(req.user?.status || '');
    if (status !== 'courier' && status !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const myCourierId = status === 'admin' ? String(req.query.courierId || '').trim() : await resolveCourierIdForUser(city, req.user.tgId);
    if (status !== 'admin' && !myCourierId) {
      return res.status(403).json({ error: 'Courier profile not found. Contact admin.' });
    }
    const filterCourierId = myCourierId;

    const rows = await getOrders(city);
    const orders = rows
      .filter((o) => String(o.courier_id || '') === String(filterCourierId))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .map((o) => {
        const dbOrder = db.orders.get(String(o.order_id || ''));
        const cd = parseCourierData(o, dbOrder);
        const parsedItems = safeJson(o.items_json, []);
        const items = Array.isArray(parsedItems) ? parsedItems : [];
        const maskedPhone = cd.phone ? `${String(cd.phone).slice(0, 3)}***${String(cd.phone).slice(-2)}` : null;
        const totalAmount = Number(o.final_amount || 0) > 0 ? Number(o.final_amount || 0) : Number(o.total_amount || 0);
        const courierPayoutPercent = Number(process.env.COURIER_PAYOUT_PERCENT || 20) / 100;
        const payoutAmount = Math.round(totalAmount * courierPayoutPercent * 100) / 100;
        return {
          id: String(o.order_id || ''),
          userId: String(o.user_id || ''),
          userName: cd.userName,
          userPhone: maskedPhone,
          deliveryAddress: cd.address,
          comment: cd.comment,
          status: normalizeOrderStatus(o.status),
          totalAmount,
          payoutAmount,
          courierId: String(o.courier_id || ''),
          deliveryDate: String(o.delivery_date || ''),
          deliveryTime: String(o.delivery_time || ''),
          createdAt: String(o.created_at || ''),
          itemCount: Number(o.item_count || (Array.isArray(items) ? items.length : 0) || 0),
          items,
        };
      });

    res.json({ orders });
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to fetch courier orders' });
  }
});

router.post('/orders/status', requireAuth, async (req, res) => {
  try {
    const city = String(req.body?.city || req.query.city || '');
    if (!city) return res.status(400).json({ error: 'City parameter is required' });
    const status = String(req.user?.status || '');
    if (status !== 'courier' && status !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const orderId = String(req.body?.orderId || '').trim();
    const next = String(req.body?.status || '').trim().toLowerCase();
    const reason = String(req.body?.reason || '').trim().slice(0, 200);
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    if (!isAllowedCourierOrderStatus(next)) return res.status(400).json({ error: 'Invalid status' });
    const normalizedNext = normalizeOrderStatus(next);

    const rows = await getOrders(city);
    const order = rows.find((o) => String(o.order_id || '') === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const myCourierId = status === 'admin' ? String(req.body?.courierId || req.query.courierId || '').trim() : await resolveCourierIdForUser(city, req.user.tgId);
    if (status !== 'admin' && !myCourierId) {
      return res.status(403).json({ error: 'Courier profile not found. Contact admin.' });
    }
    const filterCourierId = myCourierId;
    if (status !== 'admin' && String(order.courier_id || '') !== String(filterCourierId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const patch = { status: normalizedNext };
    if (normalizedNext === 'delivered') {
      patch.delivered_at = new Date().toISOString();
    }
    if (normalizedNext === 'cancelled') {
      patch.cancelled_at = new Date().toISOString();
      if (reason) patch.cancel_reason = reason;
    }
    await updateOrderRowByOrderId(city, orderId, patch);
    const local = db.orders.get(String(orderId));
    if (local) {
      local.status = normalizedNext;
      if (normalizedNext === 'cancelled' && reason) local.cancel_reason = reason;
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

router.post('/preferences', requireAuth, async (req, res) => {
  try {
    const city = String(req.body?.city || req.query.city || '');
    if (!city) return res.status(400).json({ error: 'City parameter is required' });

    const status = String(req.user?.status || '');
    if (status !== 'courier' && status !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const myCourierId = status === 'admin' ? String(req.body?.courierId || '').trim() : await resolveCourierIdForUser(city, req.user.tgId);
    if (status !== 'admin' && !myCourierId) {
      return res.status(403).json({ error: 'Courier profile not found. Contact admin.' });
    }

    const timeFrom = String(req.body?.time_from || req.body?.timeFrom || '').trim();
    const timeTo = String(req.body?.time_to || req.body?.timeTo || '').trim();
    const meetingPlace = String(req.body?.meeting_place || req.body?.meetingPlace || '').trim();

    const patch = {
      ...(timeFrom ? { time_from: timeFrom } : {}),
      ...(timeTo ? { time_to: timeTo } : {}),
      ...(meetingPlace ? { meeting_place: meetingPlace, place: meetingPlace, location: meetingPlace, address: meetingPlace } : {}),
      updated_at: new Date().toISOString(),
    };

    const ok = await updateCourierRowByCourierId(city, myCourierId, patch);
    if (!ok) return res.status(404).json({ error: 'Courier not found' });
    res.json({ ok: true });
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to update courier preferences' });
  }
});

export default router;
