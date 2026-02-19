import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getCouriers } from '../services/sheets.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const city = String(req.query.city || '');
    const list = await getCouriers(city);
    res.json({ couriers: list.filter((c) => Boolean(c.active)) });
  } catch (e) {
    console.error('Couriers error:', e);
    const status = Number(e?.status) || 500;
    if (status === 503) {
      return res.status(503).json({ error: 'Sheets not configured', code: e.code, missing: e.missing || [] });
    }
    res.status(500).json({ error: 'Failed to fetch couriers' });
  }
});

export default router;
