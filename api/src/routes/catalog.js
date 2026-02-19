import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';
import { getProducts } from '../services/sheets.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { city, category, brand, price_min, price_max, discount, new: isNew } = req.query;
    
    if (!city) {
      return res.status(400).json({ error: 'City parameter is required' });
    }

    const sheetProducts = await getProducts(String(city));
    let filteredProducts = sheetProducts
      .map((p) => {
        const activeRes = db.getActiveReservationsByProduct(p.sku).reduce((s, r) => s + r.qty, 0);
        const qtyAvailable = Math.max(0, Number(p.stock) - activeRes);
        return {
          id: p.sku,
          sku: p.sku,
          name: p.name,
          category: p.category,
          brand: p.brand,
          price: p.price,
          qtyAvailable,
          active: Boolean(p.active),
          isNew: Boolean(p.isNew),
          discount: Number(p.discount || 0),
          image: p.image || '',
          description: p.description || '',
          tasteProfile: p.tasteProfile || null,
        };
      })
      .filter((product) => product.active && product.qtyAvailable > 0);

    if (category) {
      filteredProducts = filteredProducts.filter(product => product.category === category);
    }

    if (brand) {
      filteredProducts = filteredProducts.filter(product => product.brand === brand);
    }

    if (price_min) {
      filteredProducts = filteredProducts.filter(product => product.price >= parseFloat(price_min));
    }

    if (price_max) {
      filteredProducts = filteredProducts.filter(product => product.price <= parseFloat(price_max));
    }

    if (discount === 'true') {
      filteredProducts = filteredProducts.filter((product) => Number(product.discount || 0) > 0);
    }

    if (isNew === 'true') {
      filteredProducts = filteredProducts.filter((product) => Boolean(product.isNew));
    }

    res.json({ products: filteredProducts });
  } catch (error) {
    console.error('Catalog error:', error);
    const status = Number(error?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: error.code, missing: error.missing || [] });
    }
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

router.get('/categories', requireAuth, async (req, res) => {
  try {
    const city = String(req.query.city || '');
    if (!city) return res.status(400).json({ error: 'City parameter is required' });
    const products = await getProducts(city);
    const categories = Array.from(new Set(products.filter((p) => p.active && Number(p.stock) > 0).map((p) => p.category).filter(Boolean))).sort();
    res.json({ categories });
  } catch (e) {
    console.error('Categories error:', e);
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/brands', requireAuth, async (req, res) => {
  try {
    const city = String(req.query.city || '');
    if (!city) return res.status(400).json({ error: 'City parameter is required' });
    const products = await getProducts(city);
    const brands = Array.from(new Set(products.filter((p) => p.active && Number(p.stock) > 0).map((p) => p.brand).filter(Boolean))).sort();
    res.json({ brands });
  } catch (e) {
    console.error('Brands error:', e);
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

export default router;
