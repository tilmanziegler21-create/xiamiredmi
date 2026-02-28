import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';

const router = express.Router();

router.get('/balance', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(req.user.tgId);
    res.json({
      balance: Number(user?.bonus_balance || 0),
    });
  } catch (e) {
    console.error('Bonus balance error:', e);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

router.get('/history', requireAuth, (req, res) => {
  try {
    const list = db.getBonusHistory(req.user.tgId);
    res.json({ history: list });
  } catch (e) {
    console.error('Bonus history error:', e);
    res.status(500).json({ error: 'Failed to fetch bonus history' });
  }
});

router.post('/apply', requireAuth, (req, res) => {
  try {
    const { amount, total } = req.body || {};
    const want = Math.max(0, Number(amount || 0));
    const orderTotal = Math.max(0, Number(total || 0));
    const user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(req.user.tgId);
    const balance = Number(user?.bonus_balance || 0);
    const maxByPolicy = orderTotal > 0 ? orderTotal * 0.5 : Number.POSITIVE_INFINITY;
    const applied = Math.min(balance, want, maxByPolicy);
    res.json({ applied, balance });
  } catch (e) {
    console.error('Bonus apply error:', e);
    res.status(500).json({ error: 'Failed to apply bonuses' });
  }
});

export default router;
