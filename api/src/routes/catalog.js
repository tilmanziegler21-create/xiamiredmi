import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';
import { getMasterBrands, getProducts } from '../services/sheets.js';

const router = express.Router();

function errorStatus(e) {
  const direct = Number(e?.status);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const code = Number(e?.code);
  if (Number.isFinite(code) && code > 0) return code;
  const deep = Number(e?.response?.data?.error?.code);
  if (Number.isFinite(deep) && deep > 0) return deep;
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

function normText(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function categoryMatches(query, productCategory) {
  const q = normText(query);
  const c = normText(productCategory);
  if (!q) return true;
  const aliases = {
    'жидкости': ['жидкости', 'жидкость', 'liquids', 'liquid'],
    'одноразки': ['одноразки', 'одноразка', 'disposables', 'disposable'],
    'поды': ['поды', 'под', 'pods', 'pod'],
    'картриджи': ['картриджи', 'картридж', 'cartridges', 'cartridge'],
  };
  for (const [key, list] of Object.entries(aliases)) {
    if (q === key) return list.includes(c);
  }
  return c === q;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { city, category, brand, price_min, price_max, discount, new: isNew, taste_sweetness_min, taste_sweetness_max, taste_coolness_min, taste_fruitiness_min } = req.query;
    
    if (!city) {
      return res.status(400).json({ error: 'City parameter is required' });
    }

    const sheetProducts = await getProducts(String(city));
    const toNum = (v) => {
      const n = Number(String(v || '').replace(',', '.'));
      return Number.isFinite(n) ? n : NaN;
    };
    const tSweetMin = toNum(taste_sweetness_min);
    const tSweetMax = toNum(taste_sweetness_max);
    const tCoolMin = toNum(taste_coolness_min);
    const tFruitMin = toNum(taste_fruitiness_min);

    let filteredProducts = sheetProducts
      .map((p) => {
        const activeRes = db.getActiveReservationsByProduct(p.sku).reduce((s, r) => s + r.qty, 0);
        const qtyAvailable = Math.max(0, Number(p.stock) - activeRes);
        const tp = p.tasteProfile && typeof p.tasteProfile === 'object' ? p.tasteProfile : null;
        const sweet = tp ? Number(tp.sweet || 0) : 0;
        const sour = tp ? Number(tp.sour || 0) : 0;
        const fruit = tp ? Number(tp.fruit || 0) : 0;
        const cool = tp ? Number(tp.cool || 0) : 0;
        const strength = tp ? Number(tp.strength || 0) : 0;
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
          tasteProfile: tp
            ? {
                sweetness: sweet,
                sourness: sour,
                fruitiness: fruit,
                coolness: cool,
                strength,
              }
            : null,
        };
      })
      .filter((product) => product.active);

    if (Number.isFinite(tSweetMin)) {
      filteredProducts = filteredProducts.filter((p) => Number(p.tasteProfile?.sweetness || 0) >= tSweetMin);
    }
    if (Number.isFinite(tSweetMax)) {
      filteredProducts = filteredProducts.filter((p) => Number(p.tasteProfile?.sweetness || 0) <= tSweetMax);
    }
    if (Number.isFinite(tCoolMin)) {
      filteredProducts = filteredProducts.filter((p) => Number(p.tasteProfile?.coolness || 0) >= tCoolMin);
    }
    if (Number.isFinite(tFruitMin)) {
      filteredProducts = filteredProducts.filter((p) => Number(p.tasteProfile?.fruitiness || 0) >= tFruitMin);
    }

    if (category) {
      filteredProducts = filteredProducts.filter((product) => categoryMatches(category, product.category));
    }

    if (brand) {
      const qb = normText(brand);
      filteredProducts = filteredProducts.filter((product) => normText(product.brand) === qb);
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

    filteredProducts.sort((a, b) => {
      const ai = Number(Number(a.qtyAvailable || 0) > 0);
      const bi = Number(Number(b.qtyAvailable || 0) > 0);
      return bi - ai;
    });

    res.json({ products: filteredProducts });
  } catch (error) {
    console.error('Catalog error:', error);
    const status = errorStatus(error);
    const message = errorMessage(error);
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: error.code, missing: error.missing || [] });
    }
    if (status === 401 || status === 403) {
      return res.status(503).json({ error: 'Sheets access denied', details: message || undefined });
    }
    if (status === 404) {
      return res.status(404).json({ error: 'Sheet tab not found', code: error.code || undefined });
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
    if (status === 401 || status === 403) {
      return res.status(503).json({ error: 'Sheets access denied', details: message || undefined });
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
    const brands = await getMasterBrands();
    res.json({ brands });
  } catch (e) {
    console.error('Brands error:', e);
    const status = errorStatus(e);
    const message = errorMessage(e);
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    if (status === 401 || status === 403) {
      return res.status(503).json({ error: 'Sheets access denied', details: message || undefined });
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
