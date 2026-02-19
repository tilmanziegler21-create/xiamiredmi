import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';
import { getProducts } from '../services/sheets.js';

const router = express.Router();

function socialProof(seed) {
  const s = String(seed || '0');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  const rating = 4.3 + (h % 51) / 100;
  const reviewsCount = 12 + (h % 240);
  const weeklyOrders = 24 + (h % 90);
  const snippets = [
    'Вкус топ, доставка быстро.',
    'Брал второй раз — все ок.',
    'Качество отличное, рекомендую.',
    'Хороший вкус, не горчит.',
    'Пришло вовремя, упаковано отлично.',
  ];
  const pick = (i) => snippets[(h + i) % snippets.length];
  return {
    rating: Math.round(rating * 10) / 10,
    reviewsCount,
    weeklyOrders,
    reviews: [pick(1), pick(2), pick(3)],
  };
}

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const city = String(req.query.city || '');
    const sku = String(req.params.id || '');
    const products = await getProducts(city);
    const p = products.find((x) => String(x.sku) === sku);
    if (!p || !p.active) return res.status(404).json({ error: 'Product not found' });

    const reserved = db.getActiveReservationsByProduct(sku).reduce((s, r) => s + r.qty, 0);
    const qtyAvailable = Math.max(0, Number(p.stock) - reserved);
    if (qtyAvailable <= 0) return res.status(404).json({ error: 'Out of stock' });

    const similar = products
      .filter((x) => x.active && String(x.sku) !== sku)
      .filter((x) => (p.category && x.category === p.category) || (p.brand && x.brand === p.brand))
      .slice(0, 6)
      .map((x) => ({
        id: x.sku,
        name: x.name,
        category: x.category,
        brand: x.brand,
        price: x.price,
        image: x.image || '',
      }));

    const fav = db.getFavorites(req.user.tgId).some((f) => String(f.product_id) === sku);

    res.json({
      product: {
        id: p.sku,
        sku: p.sku,
        name: p.name,
        category: p.category,
        brand: p.brand,
        price: p.price,
        qtyAvailable,
        description: p.description || '',
        image: p.image || '',
        tasteProfile: p.tasteProfile || null,
        favorite: fav,
      },
      social: socialProof(sku),
      similar,
    });
  } catch (e) {
    console.error('Product error:', e);
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

export default router;
