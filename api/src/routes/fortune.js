import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';

const router = express.Router();
const spinLocks = new Set();

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function tierFor(user) {
  const balance = Number(user?.bonus_balance || 0);
  if (balance >= 5000) return 'elite';
  if (balance >= 1000) return 'vip';
  return 'regular';
}

function dailyLimit(tier) {
  if (tier === 'elite') return 10;
  if (tier === 'vip') return 5;
  return 3;
}

function pickReward() {
  const r = Math.random();
  if (r < 0.18) return { type: 'nothing', amount: 0 };
  if (r < 0.58) return { type: 'bonus', amount: 2 };
  if (r < 0.80) return { type: 'bonus', amount: 5 };
  if (r < 0.93) return { type: 'bonus', amount: 10 };
  if (r < 0.98) return { type: 'promo', code: 'WELCOME10', value: 10 };
  return { type: 'bonus', amount: 20 };
}

router.get('/state', requireAuth, (req, res) => {
  const tgId = String(req.user?.tgId || '');
  const u = db.getUser(tgId);
  const day = dateKey();
  const tier = tierFor(u);
  const limit = dailyLimit(tier);
  const st = db.getFortuneState(tgId, day) || { used: 0 };
  const used = Number(st.used || 0);
  res.json({ date: day, tier, dailyLimit: limit, used, left: Math.max(0, limit - used) });
});

router.post('/spin', requireAuth, (req, res) => {
  const tgId = String(req.user?.tgId || '');
  const lockKey = String(tgId);
  if (spinLocks.has(lockKey)) return res.status(429).json({ error: 'Spin in progress' });
  spinLocks.add(lockKey);
  try {
  const u = db.getUser(tgId);
  const day = dateKey();
  const tier = tierFor(u);
  const limit = dailyLimit(tier);
  const st = db.getFortuneState(tgId, day) || { used: 0 };
  const used = Number(st.used || 0);
  if (used >= limit) return res.status(409).json({ error: 'No spins left' });

  const reward = pickReward();
  db.setFortuneUsed(tgId, day, used + 1);
  if (reward.type === 'bonus') {
    db.addBonusDelta(tgId, Number(reward.amount || 0), 'fortune', { reward });
  }
  const nextUser = db.getUser(tgId);
  res.json({
    reward,
    date: day,
    tier,
    dailyLimit: limit,
    used: used + 1,
    left: Math.max(0, limit - (used + 1)),
    bonusBalance: Number(nextUser?.bonus_balance || 0),
  });
  } finally {
    spinLocks.delete(lockKey);
  }
});

export default router;
