import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';
import { getProducts } from '../services/sheets.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const city = String(req.query.city || '');
    const favs = db.getFavorites(req.user.tgId);
    const products = city ? await getProducts(city) : [];
    const bySku = new Map(products.map((p) => [String(p.sku), p]));
    const items = favs.map((f) => {
      const p = bySku.get(String(f.product_id));
      if (p) {
        return {
          id: p.sku,
          name: p.name,
          category: p.category,
          brand: p.brand,
          price: p.price,
          image: p.image || '',
        };
      }
      const s = f?.snapshot || {};
      return {
        id: String(f.product_id),
        name: String(s.name || f.product_id || ''),
        category: String(s.category || ''),
        brand: String(s.brand || ''),
        price: Number(s.price || 0),
        image: String(s.image || ''),
      };
    });
    res.json({ favorites: items });
  } catch (e) {
    console.error('Favorites error:', e);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/toggle', requireAuth, (req, res) => {
  try {
    const { productId, enabled, product } = req.body || {};
    if (!productId) return res.status(400).json({ error: 'productId is required' });
    const snap = product && typeof product === 'object'
      ? {
          id: String(product.id || productId),
          name: String(product.name || ''),
          category: String(product.category || ''),
          brand: String(product.brand || ''),
          price: Number(product.price || 0),
          image: String(product.image || ''),
        }
      : null;
    db.setFavorite(req.user.tgId, String(productId), Boolean(enabled), snap);
    res.json({ ok: true });
  } catch (e) {
    console.error('Favorites toggle error:', e);
    res.status(500).json({ error: 'Failed to update favorite' });
  }
});

export default router;
