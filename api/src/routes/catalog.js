import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';
import { getProducts } from '../services/sheets.js';

const router = express.Router();

function errorStatus(e) {
  const direct = Number(e?.status);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const resp = Number(e?.response?.status);
  if (Number.isFinite(resp) && resp > 0) return resp;
  return 500;
}

function errorMessage(e) {
  const msg =
    e?.response?.data?.error?.message ||
    e?.response?.data?.error_description ||
    e?.response?.data?.error ||
    e?.message;
  return typeof msg === 'string' ? msg : '';
}

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
      .filter((product) => product.active);

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
    const status = errorStatus(error);
    const message = errorMessage(error);
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: error.code, missing: error.missing || [] });
    }
    if (status === 401 || status === 403) {
      return res.status(status).json({ error: 'Authentication required' });
    }
    if (status === 404) {
      return res.status(404).json({ error: 'Sheet not found or access denied' });
    }
    if (status === 429) {
      return res.status(429).json({ error: 'Sheets quota exceeded' });
    }
    res.status(500).json({ error: 'Failed to fetch catalog', details: message || undefined });
  }
});

router.get('/categories', requireAuth, async (req, res) => {
  try {
    const city = String(req.query.city || '');
    if (!city) return res.status(400).json({ error: 'City parameter is required' });
    const products = await getProducts(city);
    const categories = Array.from(new Set(products.filter((p) => p.active).map((p) => p.category).filter(Boolean))).sort();
    res.json({ categories });
  } catch (e) {
    console.error('Categories error:', e);
    const status = errorStatus(e);
    const message = errorMessage(e);
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    if (status === 404) {
      return res.status(404).json({ error: 'Sheet not found or access denied' });
    }
    if (status === 429) {
      return res.status(429).json({ error: 'Sheets quota exceeded' });
    }
    res.status(500).json({ error: 'Failed to fetch categories', details: message || undefined });
  }
});

router.get('/brands', requireAuth, async (req, res) => {
  try {
    const city = String(req.query.city || '');
    if (!city) return res.status(400).json({ error: 'City parameter is required' });
    const products = await getProducts(city);
    const brands = Array.from(new Set(products.filter((p) => p.active).map((p) => p.brand).filter(Boolean))).sort();
    res.json({ brands });
  } catch (e) {
    console.error('Brands error:', e);
    const status = errorStatus(e);
    const message = errorMessage(e);
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    if (status === 404) {
      return res.status(404).json({ error: 'Sheet not found or access denied' });
    }
    if (status === 429) {
      return res.status(429).json({ error: 'Sheets quota exceeded' });
    }
    res.status(500).json({ error: 'Failed to fetch brands', details: message || undefined });
  }
});

export default router;
