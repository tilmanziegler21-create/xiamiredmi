import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import db from '../services/database.js';
import { getProducts, updateProductStock, appendOrderRow, updateOrderRowByOrderId, getOrders } from '../services/sheets.js';
import { normalizeOrderStatus } from '../domain/orderStatus.js';

const router = express.Router();

const idempotency = new Map();
const paymentIdempotency = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of idempotency.entries()) {
    if (Number(v?.expiresAt || 0) <= now) idempotency.delete(k);
  }
  for (const [k, v] of paymentIdempotency.entries()) {
    if (Number(v?.expiresAt || 0) <= now) paymentIdempotency.delete(k);
  }
}, 5 * 60 * 1000);

function generateOrderId() {
  return 'ORD-' + Date.now().toString(36).toUpperCase();
}

function countPositions(items) {
  return Array.isArray(items) ? items.length : 0;
}

function getDbOrderItemCount(orderId) {
  let n = 0;
  for (const oi of db.orderItems.values()) {
    if (String(oi.order_id) === String(orderId)) n++;
  }
  return n;
}

function mapDbOrderToHistory(order) {
  return {
    id: order.id,
    status: normalizeOrderStatus(order.status),
    totalAmount: Number(order.total_amount || 0),
    deliveryMethod: order.delivery_method || '',
    createdAt: order.created_at || '',
    itemCount: getDbOrderItemCount(order.id),
  };
}

function safeJson(raw, fallback) {
  try {
    return JSON.parse(String(raw || ''));
  } catch {
    return fallback;
  }
}

async function ensureLocalOrderFromSheets(city, orderId, tgId) {
  if (!city) return null;
  try {
    const rows = await getOrders(city);
    const row = rows.find((o) => String(o.order_id) === String(orderId)) || null;
    if (!row) return null;
    if (String(row.user_id) !== String(tgId)) return null;

    const order = {
      id: String(row.order_id || ''),
      user_id: String(row.user_id || ''),
      city: String(city),
      status: normalizeOrderStatus(row.status),
      total_amount: Number(row.total_amount || 0),
      subtotal_amount: Number(row.subtotal_amount || 0),
      discount_amount: Number(row.discount_amount || 0),
      promo_code: String(row.promo_code || ''),
      delivery_method: String(row.delivery_method || ''),
      courier_data: String(row.courier_data || ''),
      created_at: String(row.created_at || new Date().toISOString()),
      expires_at: '',
      payment_method: String(row.payment_method || ''),
      bonus_applied: Number(row.bonus_applied || 0),
      final_amount: Number(row.final_amount || 0),
      courier_id: String(row.courier_id || ''),
      delivery_date: String(row.delivery_date || ''),
      delivery_time: String(row.delivery_time || ''),
    };

    db.orders.set(String(orderId), order);
    for (const [k, v] of db.orderItems.entries()) {
      if (String(v?.order_id || '') === String(orderId)) db.orderItems.delete(k);
    }
    let items = [];
    try {
      items = row.items_json ? JSON.parse(row.items_json) : [];
    } catch {
      items = [];
    }
    for (const it of Array.isArray(items) ? items : []) {
      const itemId = Math.random().toString(36).substring(2, 15);
      db.orderItems.set(itemId, {
        id: itemId,
        order_id: String(orderId),
        product_id: String(it.productId || it.product_id || ''),
        variant: it.variant ? String(it.variant) : '',
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
        name: String(it.name || ''),
      });
    }
    db.persistState();
    return order;
  } catch {
    return null;
  }
}

router.post('/create', requireAuth, validateBody({ city: 'required' }), async (req, res) => {
  try {
    const { tgId } = req.user;
    const { city, items, promoCode } = req.body;

    const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
    if (idempotencyKey) {
      const key = `${tgId}:${idempotencyKey}`;
      const existing = idempotency.get(key);
      if (existing && existing.expiresAt > Date.now()) {
        return res.json(existing.payload);
      }
    }
    
    if (!city || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid order data' });
    }

    const cityStr = String(city);
    const sheetProducts = await getProducts(cityStr);
    const bySku = new Map(sheetProducts.map((p) => [String(p.sku), p]));

    const reservationTtlMs = Number(process.env.RESERVATION_TTL_MS || 30 * 60 * 1000);

    const normalizedItems = [];

    for (const it of items) {
      const sku = String(it.productId);
      const qty = Number(it.quantity);
      const p = bySku.get(sku);
      if (!p || !p.active) {
        return res.status(404).json({ error: `Product not found: ${sku}` });
      }
      const reserved = db.getActiveReservationsByProduct(sku).reduce((s, r) => s + r.qty, 0);
      const available = Number(p.stock) - reserved;
      if (available < qty) {
        return res.status(409).json({ error: `Insufficient stock for ${sku}` });
      }

      normalizedItems.push({
        productId: sku,
        quantity: qty,
        price: Number(p.price),
        name: String(p.name || ''),
        variant: it.variant ? String(it.variant) : '',
      });
    }

    const orderId = generateOrderId();
    const subtotalAmount = normalizedItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    let discountAmount = 0;

    for (const it of normalizedItems) {
      const qty = Number(it.quantity || 0);
      const price = Number(it.price || 0);
      if (qty >= 3 && price > 40) discountAmount += (price - 40) * qty;
    }

    const promo = String(promoCode || '').trim();
    const promoObj = promo ? db.getPromoById(promo) : null;
    const now = Date.now();
    const inWindow =
      promoObj &&
      (!promoObj.startsAt || Date.parse(promoObj.startsAt) <= now) &&
      (!promoObj.endsAt || Date.parse(promoObj.endsAt) >= now);
    const discountedSubtotal = Math.max(0, subtotalAmount - discountAmount);
    if (promoObj && promoObj.active && inWindow && discountedSubtotal >= Number(promoObj.minTotal || 0)) {
      if (String(promoObj.type || '') === 'percent') {
        discountAmount += (discountedSubtotal * Number(promoObj.value || 0)) / 100;
      }
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const totalAmount = Math.max(0, Math.round((subtotalAmount - discountAmount) * 100) / 100);

    const order = {
      id: orderId,
      user_id: tgId,
      city: cityStr,
      status: 'buffer',
      total_amount: totalAmount,
      subtotal_amount: subtotalAmount,
      discount_amount: discountAmount,
      promo_code: promoObj && promoObj.active ? promo : '',
      delivery_method: null,
      courier_data: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + reservationTtlMs).toISOString(),
    };

    db.orders.set(orderId, order);

    normalizedItems.forEach(item => {
      const itemId = Math.random().toString(36).substring(2, 15);
      const orderItem = {
        id: itemId,
        order_id: orderId,
        product_id: String(item.productId),
        variant: item.variant ? String(item.variant) : '',
        quantity: Number(item.quantity),
        price: Number(item.price),
        name: String(item.name || '')
      };
      db.orderItems.set(itemId, orderItem);
      db.addReservation(orderId, String(item.productId), Number(item.quantity), reservationTtlMs);
    });
    db.persistState();

    try {
      await appendOrderRow(cityStr, {
        order_id: orderId,
        user_id: tgId,
        status: 'buffer',
        total_amount: totalAmount,
        subtotal_amount: subtotalAmount,
        discount_amount: discountAmount,
        promo_code: promoObj && promoObj.active ? promo : '',
        courier_id: '',
        delivery_date: '',
        delivery_time: '',
        payment_method: '',
        created_at: order.created_at,
        delivered_at: '',
        item_count: String(countPositions(normalizedItems)),
        items_json: JSON.stringify(normalizedItems),
      });
    } catch (e) {
      console.error('Sheets append order failed:', e);
    }

    const orderText = `Новый заказ ${orderId}
Город: ${cityStr}
Сумма: ${totalAmount}
Товары: ${items.length} позиций`;

    const payload = {
      orderId,
      orderText,
      totalAmount,
      status: 'buffer',
      expiresAt: order.expires_at,
    };

    if (idempotencyKey) {
      const key = `${tgId}:${idempotencyKey}`;
      idempotency.set(key, { expiresAt: Date.now() + 10 * 60 * 1000, payload });
    }

    res.json(payload);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.post('/confirm', requireAuth, async (req, res) => {
  try {
    const { orderId, deliveryMethod, courierData, city, courier_id, delivery_date, delivery_time, promoCode } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    let order = db.orders.get(orderId);
    const cityStr = String(city || order?.city || '');
    if (!order) order = await ensureLocalOrderFromSheets(cityStr, orderId, req.user.tgId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (String(order.user_id) !== String(req.user.tgId)) return res.status(403).json({ error: 'Forbidden' });
    order.status = 'pending';
    order.delivery_method = deliveryMethod;
    order.courier_data = JSON.stringify(courierData || {});
    db.persistState();

    try {
      const items = [];
      for (const oi of db.orderItems.values()) {
        if (oi.order_id === orderId) {
          items.push({
            productId: oi.product_id,
            quantity: oi.quantity,
            price: oi.price,
            name: String(oi.name || ''),
            variant: oi.variant ? String(oi.variant) : '',
          });
        }
      }

      const patch = {
        status: 'pending',
        courier_id: courier_id || '',
        delivery_date: delivery_date || '',
        delivery_time: delivery_time || '',
        delivery_method: deliveryMethod || '',
        item_count: String(countPositions(items)),
        items_json: JSON.stringify(items),
        promo_code: String(promoCode || order?.promo_code || '').trim(),
        subtotal_amount: order?.subtotal_amount != null ? String(order.subtotal_amount) : '',
        discount_amount: order?.discount_amount != null ? String(order.discount_amount) : '',
        total_amount: order?.total_amount != null ? String(order.total_amount) : '',
        courier_data: courierData ? JSON.stringify(courierData) : '',
      };
      const cd = courierData || {};
      const userName = String(cd?.user?.username || cd?.user?.tgId || '').trim();
      const userPhone = String(cd?.phone || '').trim();
      const deliveryAddress = String(cd?.address || '').trim();
      const comment = String(cd?.comment || '').trim();
      if (userName) patch.user_name = userName;
      if (userPhone) patch.user_phone = userPhone;
      if (deliveryAddress) patch.delivery_address = deliveryAddress;
      if (comment) patch.comment = comment;

      const updated = await updateOrderRowByOrderId(cityStr, orderId, patch);
      if (!updated) {
        await appendOrderRow(cityStr, {
          order_id: orderId,
          user_id: order?.user_id || '',
          status: 'pending',
          total_amount: order?.total_amount || 0,
          subtotal_amount: order?.subtotal_amount || '',
          discount_amount: order?.discount_amount || '',
          promo_code: String(promoCode || order?.promo_code || '').trim(),
          courier_id: courier_id || '',
          delivery_date: delivery_date || '',
          delivery_time: delivery_time || '',
          payment_method: '',
          delivery_method: deliveryMethod || '',
          created_at: order?.created_at || new Date().toISOString(),
          delivered_at: '',
          item_count: String(countPositions(items)),
          items_json: JSON.stringify(items),
        });
      }
    } catch (e) {
      console.error('Sheets upsert order failed:', e);
    }

    res.json({ success: true, status: 'pending' });
  } catch (error) {
    console.error('Confirm order error:', error);
    res.status(500).json({ error: 'Failed to confirm order' });
  }
});

router.post('/payment', requireAuth, validateBody({ orderId: 'required' }), async (req, res) => {
  try {
    const { orderId, paymentMethod, city, bonusApplied } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const paymentKey = `${String(req.user.tgId)}:${String(orderId)}`;
    const existingPayment = paymentIdempotency.get(paymentKey);
    if (existingPayment && Number(existingPayment.expiresAt || 0) > Date.now()) {
      return res.json(existingPayment.payload);
    }

    let order = db.orders.get(orderId);
    const cityStr = String(city || order?.city || '');
    if (!order) order = await ensureLocalOrderFromSheets(cityStr, orderId, req.user.tgId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (String(order.user_id) !== String(req.user.tgId)) return res.status(403).json({ error: 'Forbidden' });
    if (!String(order.delivery_method || '').trim()) {
      return res.status(400).json({ error: 'Order must be confirmed before payment' });
    }
    const current = normalizeOrderStatus(order.status);
    if (current === 'delivered' || current === 'cancelled') {
      return res.json({ success: true, status: current });
    }
    const nextStatus = current === 'buffer' ? 'pending' : current;
    order.status = nextStatus;
    {
      try {
        const sheetProducts = cityStr ? await getProducts(cityStr) : [];
        const bySku = new Map(sheetProducts.map((p) => [String(p.sku), p]));

        for (const oi of db.orderItems.values()) {
          if (oi.order_id !== orderId) continue;
          const sku = String(oi.product_id);
          const p = bySku.get(sku);
          if (!p) continue;
          const newStock = Math.max(0, Number(p.stock) - Number(oi.quantity));
          const newActive = newStock > 0;
          try {
            await updateProductStock(p, newStock, newActive);
          } catch (e) {
            console.error('Update stock failed:', e);
          }
        }
      } catch (e) {
        console.error('Fetch products for stock update failed:', e);
      }

      let bonusUsed = 0;
      try {
        const want = Math.max(0, Number(bonusApplied || 0));
        if (want > 0) {
          const user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(req.user.tgId);
          const balance = Number(user?.bonus_balance || 0);
          bonusUsed = Math.min(balance, want, Number(order.total_amount || 0));
          if (bonusUsed > 0) {
            db.prepare('UPDATE users SET bonus_balance = ? WHERE tg_id = ?').run(balance - bonusUsed, req.user.tgId);
            db.addBonusEvent({
              user_id: req.user.tgId,
              type: 'spend',
              amount: -bonusUsed,
              created_at: new Date().toISOString(),
              meta: JSON.stringify({ order_id: orderId }),
            });
          }
        }
      } catch (e) {
        console.error('Apply bonus failed:', e);
      }

      const paidAmount = Math.max(0, Math.round((Number(order.total_amount || 0) - bonusUsed) * 100) / 100);
      order.payment_method = String(paymentMethod || '');
      order.bonus_applied = Math.round(Number(bonusUsed || 0) * 100) / 100;
      order.final_amount = Math.round(Number(paidAmount || 0) * 100) / 100;
      const cashbackPercent = Number(process.env.BONUS_CASHBACK_PERCENT || 5);
      if (cashbackPercent > 0) {
        const earn = Math.round((paidAmount * cashbackPercent / 100) * 100) / 100;
        if (earn > 0) {
          db.addBonusDelta(req.user.tgId, earn, 'cashback', { order_id: orderId });
        }
      }

      try {
        const u = db.getUser(req.user.tgId);
        const referredBy = String(u?.referred_by || '').trim();
        const hadFirst = String(u?.first_paid_order_at || '').trim();
        if (referredBy && !hadFirst) {
          db.setUser(req.user.tgId, { first_paid_order_at: new Date().toISOString() });
          const ref = db.getUser(referredBy);
          if (ref) {
            const nextConv = Number(ref.referral_conversions || 0) + 1;
            db.setUser(referredBy, { referral_conversions: nextConv });
            const required = Number(process.env.REFERRAL_REQUIRED || 2);
            const bonusAmount = Number(process.env.REFERRAL_BONUS_AMOUNT || 20);
            if (required > 0 && bonusAmount > 0 && nextConv % required === 0) {
              db.addBonusDelta(referredBy, bonusAmount, 'referral', { order_id: orderId, referred_user: req.user.tgId });
            }
          }
        }
      } catch (e) {
        console.error('Referral apply failed:', e);
      }

      db.releaseReservationsByOrder(orderId);

      try {
        if (cityStr) {
          await updateOrderRowByOrderId(cityStr, orderId, {
            status: normalizeOrderStatus(nextStatus),
            payment_method: paymentMethod || '',
            bonus_applied: bonusUsed ? String(bonusUsed) : '',
            final_amount: bonusUsed ? String(paidAmount) : '',
          });
        }
      } catch (e) {
        console.error('Sheets update order failed:', e);
      }

      try {
        const userCart = Array.from(db.carts.values()).find((c) => String(c.user_id) === String(req.user.tgId));
        if (userCart) {
          for (const [k, v] of db.cartItems.entries()) {
            if (String(v.cart_id) === String(userCart.id)) db.cartItems.delete(k);
          }
          db.carts.delete(String(userCart.id));
        }
      } catch {
      }

      db.persistState();
    }

    const payload = { success: true, status: normalizeOrderStatus(db.orders.get(orderId)?.status) };
    paymentIdempotency.set(paymentKey, { expiresAt: Date.now() + 5 * 60 * 1000, payload });
    res.json(payload);
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: 'Payment failed' });
  }
});

router.get('/history', requireAuth, async (req, res) => {
  try {
    const { tgId } = req.user;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const city = String(req.query.city || '');
    try {
      if (!city) throw new Error('City is required');
      const rows = await getOrders(city);
      const all = rows
        .filter((o) => String(o.user_id) === String(tgId))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const total = all.length;
      const slice = all.slice(offset, offset + limit);
      return res.json({
        orders: slice.map((order) => ({
          id: order.order_id,
          status: normalizeOrderStatus(order.status),
          totalAmount: order.total_amount,
          deliveryMethod: order.delivery_method,
          createdAt: order.created_at,
          itemCount: order.item_count,
        })),
        total,
        limit,
        offset,
      });
    } catch {
      const all = Array.from(db.orders.values())
        .filter((o) => String(o.user_id) === String(tgId) && (!city || String(o.city) === city))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .map(mapDbOrderToHistory);
      const total = all.length;
      const orders = all.slice(offset, offset + limit);
      return res.json({ orders, total, limit, offset });
    }
  } catch (error) {
    console.error('Order history error:', error);
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { tgId } = req.user;
    const city = String(req.query.city || '');
    const orderId = String(req.params.id || '');
    if (!orderId) return res.status(400).json({ error: 'Order ID is required' });

    let row = null;
    try {
      const cityStr = city || String(db.orders.get(orderId)?.city || '');
      if (!cityStr) throw new Error('City is required');
      const rows = await getOrders(cityStr);
      row = rows.find((o) => String(o.order_id) === orderId) || null;
      if (row && String(row.user_id) !== String(tgId)) return res.status(403).json({ error: 'Forbidden' });
      if (row) {
        const local = db.orders.get(orderId);
        let items = [];
        try {
          items = row.items_json ? JSON.parse(row.items_json) : [];
        } catch {
          items = [];
        }
        if (!items.length) {
          const localItems = [];
          for (const oi of db.orderItems.values()) {
            if (String(oi.order_id) !== String(orderId)) continue;
            localItems.push({
              productId: String(oi.product_id || ''),
              quantity: Number(oi.quantity || 0),
              price: Number(oi.price || 0),
              variant: oi.variant ? String(oi.variant) : '',
              name: String(oi.name || oi.product_id || ''),
            });
          }
          items = localItems;
        }

        const products = await getProducts(cityStr);
        const bySku = new Map(products.map((p) => [String(p.sku), p]));
        const enriched = (Array.isArray(items) ? items : []).map((it) => {
          const sku = String(it.productId || it.product_id || '');
          const p = bySku.get(sku);
          return {
            productId: sku,
            quantity: Number(it.quantity || 0),
            price: Number(it.price || (p ? p.price : 0) || 0),
            variant: it.variant ? String(it.variant) : '',
            name: p ? p.name : sku,
            brand: p ? p.brand : '',
            category: p ? p.category : '',
            image: p ? (p.image || '') : '',
          };
        });

        const cd = safeJson(row.courier_data, null) || safeJson(local?.courier_data, null);
        const deliveryAddress = String(row.delivery_address || '').trim() || String(cd?.address || '').trim();
        const userPhone = String(row.user_phone || '').trim() || String(cd?.phone || '').trim();
        const comment = String(row.comment || '').trim() || String(cd?.comment || '').trim();

        return res.json({
          order: {
            id: row.order_id,
            status: normalizeOrderStatus(row.status),
            totalAmount: row.total_amount,
            finalAmount: Number(row.final_amount || 0) || Number(local?.final_amount || 0) || 0,
            bonusApplied: Number(row.bonus_applied || 0) || Number(local?.bonus_applied || 0) || 0,
            paymentMethod: String(row.payment_method || '') || String(local?.payment_method || ''),
            deliveryMethod: row.delivery_method || '',
            deliveryAddress,
            userPhone,
            comment,
            courierId: row.courier_id || '',
            deliveryDate: row.delivery_date || '',
            deliveryTime: row.delivery_time || '',
            createdAt: row.created_at || '',
          },
          items: enriched,
        });
      }
    } catch {
      row = null;
    }

    const dbOrder = db.orders.get(orderId);
    if (!dbOrder) return res.status(404).json({ error: 'Order not found' });
    if (String(dbOrder.user_id) !== String(tgId)) return res.status(403).json({ error: 'Forbidden' });

    const items = [];
    for (const oi of db.orderItems.values()) {
      if (String(oi.order_id) !== String(orderId)) continue;
      items.push({
        productId: String(oi.product_id || ''),
        quantity: Number(oi.quantity || 0),
        price: Number(oi.price || 0),
        variant: oi.variant ? String(oi.variant) : '',
        name: String(oi.name || oi.product_id || ''),
        brand: '',
        category: '',
        image: '',
      });
    }

    try {
      const cityStr = city || String(dbOrder.city || '');
      if (cityStr) {
        const products = await getProducts(cityStr);
        const bySku = new Map(products.map((p) => [String(p.sku), p]));
        for (const it of items) {
          const p = bySku.get(String(it.productId));
          if (!p) continue;
          it.name = p.name;
          it.brand = p.brand;
          it.category = p.category;
          it.image = p.image || '';
          if (!it.price) it.price = Number(p.price || 0);
        }
      }
    } catch {
    }

    const cd = safeJson(dbOrder.courier_data, null);
    const deliveryAddress = String(dbOrder.delivery_address || '').trim() || String(cd?.address || '').trim();
    const userPhone = String(dbOrder.user_phone || '').trim() || String(cd?.phone || '').trim();
    const comment = String(dbOrder.comment || '').trim() || String(cd?.comment || '').trim();

    res.json({
      order: {
        id: dbOrder.id,
        status: normalizeOrderStatus(dbOrder.status),
        totalAmount: Number(dbOrder.total_amount || 0),
        finalAmount: Number(dbOrder.final_amount || 0),
        bonusApplied: Number(dbOrder.bonus_applied || 0),
        paymentMethod: String(dbOrder.payment_method || ''),
        deliveryMethod: String(dbOrder.delivery_method || ''),
        deliveryAddress,
        userPhone,
        comment,
        courierId: String(dbOrder.courier_id || ''),
        deliveryDate: String(dbOrder.delivery_date || ''),
        deliveryTime: String(dbOrder.delivery_time || ''),
        createdAt: String(dbOrder.created_at || ''),
      },
      items,
    });
  } catch (error) {
    console.error('Order details error:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

export default router;
