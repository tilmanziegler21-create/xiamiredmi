import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';
import { validateBody } from '../middleware/validate.js';
import { getProducts } from '../services/sheets.js';

const router = express.Router();

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { tgId } = req.user;
    const { city } = req.query;
    
    if (!city) {
      return res.status(400).json({ error: 'City parameter is required' });
    }

    let cart = db.prepare('SELECT * FROM carts WHERE user_id = ? AND city = ?').get(tgId, city);
    
    if (!cart) {
      const cartId = generateId();
      const newCart = {
        id: cartId,
        user_id: tgId,
        city,
        items: [],
        total: 0
      };
      db.carts.set(cartId, newCart);
      db.persistState();
      cart = newCart;
    }

    const products = await getProducts(String(city));
    const bySku = new Map(products.map((p) => [String(p.sku), p]));

    const items = [];
    for (const item of db.cartItems.values()) {
      if (item.cart_id !== cart.id) continue;
      const p = bySku.get(String(item.product_id));
      items.push({
        ...item,
        name: p?.name || 'Товар',
        category: p?.category || '',
        brand: p?.brand || '',
        product_price: Number(p?.price || item.price || 0),
        image: p?.image || '',
      });
    }

    let subtotal = 0;
    let quantityDiscount = 0;
    const minQty = Number(process.env.QTY_DISCOUNT_MIN || process.env.QUANTITY_DISCOUNT_MIN_QTY || 3);
    const unitPrice = Number(process.env.QTY_DISCOUNT_PRICE || process.env.QUANTITY_DISCOUNT_UNIT_PRICE || 40);

    const mappedItems = items.map(item => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.product_price || item.price || 0);
      const effectivePrice = qty >= minQty && price > unitPrice ? unitPrice : price;
      const lineSubtotal = price * qty;
      const lineTotal = effectivePrice * qty;
      subtotal += lineSubtotal;
      quantityDiscount += Math.max(0, lineSubtotal - lineTotal);
      return {
        id: item.id,
        productId: item.product_id,
        variant: item.variant || '',
        bundle_id: item.bundle_id || '',
        bundle_role: item.bundle_role || '',
        name: item.name,
        category: item.category,
        brand: item.brand,
        price,
        effectivePrice,
        quantity: qty,
        image: item.image,
        total: lineTotal,
      };
    });

    const discount = Math.round(quantityDiscount * 100) / 100;
    const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

    res.json({
      cart: {
        id: cart.id,
        city: cart.city,
        items: mappedItems,
        pricing: {
          subtotal: Math.round(subtotal * 100) / 100,
          discount,
          total,
        },
        total,
      }
    });
  } catch (error) {
    console.error('Cart fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

router.post('/add', requireAuth, validateBody({ productId: 'required', city: 'required', quantity: 'number' }), async (req, res) => {
  try {
    const { tgId } = req.user;
    const { productId, quantity = 1, city, variant } = req.body;
    
    if (!productId || !city) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const qty = Number(quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    const products = await getProducts(String(city));
    const p = products.find((x) => String(x.sku) === String(productId));
    if (!p || !p.active) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const reserved = db.getActiveReservationsByProduct(String(productId)).reduce((s, r) => s + r.qty, 0);
    const available = Number(p.stock) - reserved;
    if (available <= 0) {
      return res.status(409).json({ error: 'Out of stock' });
    }
    if (qty > available) {
      return res.status(409).json({ error: 'Insufficient stock' });
    }

    let cart = db.prepare('SELECT * FROM carts WHERE user_id = ? AND city = ?').get(tgId, city);
    
    if (!cart) {
      const cartId = generateId();
      const newCart = {
        id: cartId,
        user_id: tgId,
        city,
        items: [],
        total: 0
      };
      db.carts.set(cartId, newCart);
      cart = newCart;
    }

    const itemId = generateId();
    const newItem = {
      id: itemId,
      cart_id: cart.id,
      product_id: productId,
      variant: variant ? String(variant) : '',
      quantity: qty,
      price: Number(p.price)
    };
    db.cartItems.set(itemId, newItem);
    db.persistState();

    res.json({ success: true, message: 'Product added to cart' });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

router.post('/remove', requireAuth, validateBody({ itemId: 'required' }), (req, res) => {
  try {
    const { itemId } = req.body;
    
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    const ok = db.cartItems.delete(itemId);
    if (ok) db.persistState();
    
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
});

router.post('/update', requireAuth, validateBody({ itemId: 'required', quantity: 'number' }), async (req, res) => {
  try {
    const { itemId, quantity } = req.body;
    if (!itemId) return res.status(400).json({ error: 'Item ID is required' });
    const qty = Number(quantity || 0);
    if (!Number.isFinite(qty)) return res.status(400).json({ error: 'Invalid quantity' });

    const item = db.cartItems.get(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (qty <= 0) {
      db.cartItems.delete(itemId);
      db.persistState();
      return res.json({ success: true });
    }

    const cart = db.carts.get(String(item.cart_id));
    const city = String(cart?.city || '').trim();
    if (!city) return res.status(400).json({ error: 'City is required' });

    const products = await getProducts(city);
    const p = products.find((x) => String(x.sku) === String(item.product_id));
    if (!p || !p.active) return res.status(404).json({ error: 'Product not found' });
    const reserved = db.getActiveReservationsByProduct(String(item.product_id)).reduce((s, r) => s + r.qty, 0);
    const available = Number(p.stock) - reserved;
    if (qty > available) return res.status(409).json({ error: 'Insufficient stock' });

    item.quantity = qty;
    db.cartItems.set(itemId, item);
    db.persistState();
    return res.json({ success: true });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
});

router.post('/clear', requireAuth, validateBody({ city: 'required' }), (req, res) => {
  try {
    const { tgId } = req.user;
    const { city } = req.body;
    if (!city) return res.status(400).json({ error: 'City is required' });

    const cart = db.prepare('SELECT * FROM carts WHERE user_id = ? AND city = ?').get(tgId, city);
    if (!cart) return res.json({ success: true });

    for (const [id, item] of db.cartItems.entries()) {
      if (item.cart_id === cart.id) db.cartItems.delete(id);
    }
    db.persistState();

    res.json({ success: true });
  } catch (e) {
    console.error('Clear cart error:', e);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

router.post('/add-bundle', requireAuth, validateBody({ city: 'required', podProductId: 'required', liquidProducts: 'required' }), async (req, res) => {
  try {
    const { tgId } = req.user;
    const { city, podProductId, liquidProducts } = req.body || {};
    const cityStr = String(city || '').trim();
    const podId = String(podProductId || '').trim();
    const liquids = Array.isArray(liquidProducts) ? liquidProducts : [];
    if (!cityStr || !podId || liquids.length !== 2) {
      return res.status(400).json({ error: 'Invalid bundle payload' });
    }
    const products = await getProducts(cityStr);
    const bySku = new Map(products.map((p) => [String(p.sku), p]));
    const pod = bySku.get(podId);
    if (!pod || !pod.active || Number(pod.stock || 0) <= 0) {
      return res.status(404).json({ error: 'Pod not available' });
    }
    const liquidSku1 = String(liquids[0]?.productId || '').trim();
    const liquidSku2 = String(liquids[1]?.productId || '').trim();
    const l1 = bySku.get(liquidSku1);
    const l2 = bySku.get(liquidSku2);
    if (!l1 || !l1.active || Number(l1.stock || 0) <= 0) return res.status(404).json({ error: 'Liquid #1 not available' });
    if (!l2 || !l2.active || Number(l2.stock || 0) <= 0) return res.status(404).json({ error: 'Liquid #2 not available' });

    const reservedPod = db.getActiveReservationsByProduct(podId).reduce((s, r) => s + Number(r.qty || 0), 0);
    const reservedL1 = db.getActiveReservationsByProduct(liquidSku1).reduce((s, r) => s + Number(r.qty || 0), 0);
    const reservedL2 = db.getActiveReservationsByProduct(liquidSku2).reduce((s, r) => s + Number(r.qty || 0), 0);
    if (Number(pod.stock || 0) - reservedPod < 1) return res.status(409).json({ error: 'Pod out of stock' });
    if (Number(l1.stock || 0) - reservedL1 < 1) return res.status(409).json({ error: 'Liquid #1 out of stock' });
    if (Number(l2.stock || 0) - reservedL2 < 1) return res.status(409).json({ error: 'Liquid #2 out of stock' });

    let cart = db.prepare('SELECT * FROM carts WHERE user_id = ? AND city = ?').get(tgId, cityStr);
    if (!cart) {
      const cartId = generateId();
      const newCart = {
        id: cartId,
        user_id: tgId,
        city: cityStr,
        items: [],
        total: 0,
      };
      db.carts.set(cartId, newCart);
      cart = newCart;
    }

    const bundleId = `bnd_${generateId()}`;
    const bundlePrice = Number(process.env.BUNDLE_PRICE || 50);
    const podItemId = generateId();
    db.cartItems.set(podItemId, {
      id: podItemId,
      cart_id: cart.id,
      product_id: podId,
      variant: '',
      quantity: 1,
      price: Number(bundlePrice),
      bundle_id: bundleId,
      bundle_role: 'pod',
    });
    const liquid1ItemId = generateId();
    db.cartItems.set(liquid1ItemId, {
      id: liquid1ItemId,
      cart_id: cart.id,
      product_id: liquidSku1,
      variant: String(liquids[0]?.variant || ''),
      quantity: 1,
      price: 0,
      bundle_id: bundleId,
      bundle_role: 'liquid',
    });
    const liquid2ItemId = generateId();
    db.cartItems.set(liquid2ItemId, {
      id: liquid2ItemId,
      cart_id: cart.id,
      product_id: liquidSku2,
      variant: String(liquids[1]?.variant || ''),
      quantity: 1,
      price: 0,
      bundle_id: bundleId,
      bundle_role: 'liquid',
    });
    db.persistState();
    res.json({ success: true, bundleId });
  } catch (e) {
    console.error('Add bundle error:', e);
    res.status(500).json({ error: 'Failed to add bundle' });
  }
});

router.post('/remove-bundle', requireAuth, validateBody({ bundleId: 'required' }), (req, res) => {
  try {
    const { tgId } = req.user;
    const bundleId = String(req.body?.bundleId || '').trim();
    if (!bundleId) return res.status(400).json({ error: 'Bundle ID is required' });
    const userCartIds = new Set();
    for (const c of db.carts.values()) {
      if (String(c.user_id) === String(tgId)) userCartIds.add(String(c.id));
    }
    for (const [id, item] of db.cartItems.entries()) {
      if (!userCartIds.has(String(item.cart_id))) continue;
      if (String(item.bundle_id || '') === bundleId) db.cartItems.delete(id);
    }
    db.persistState();
    res.json({ success: true });
  } catch (e) {
    console.error('Remove bundle error:', e);
    res.status(500).json({ error: 'Failed to remove bundle' });
  }
});

export default router;
