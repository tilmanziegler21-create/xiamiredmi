import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';

const router = express.Router();

function envNumber(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

router.get('/info', requireAuth, (req, res) => {
  const tgId = String(req.user?.tgId || '');
  const u = db.getUser(tgId);
  const required = envNumber('REFERRAL_REQUIRED', 2);
  const bonusAmount = envNumber('REFERRAL_BONUS_AMOUNT', 20);
  res.json({
    referralCode: tgId,
    referredBy: String(u?.referred_by || ''),
    conversions: Number(u?.referral_conversions || 0),
    required,
    bonusAmount,
  });
});

router.post('/claim', requireAuth, (req, res) => {
  const tgId = String(req.user?.tgId || '');
  const ref = String(req.body?.ref || '').trim();
  const result = db.claimReferral(tgId, ref);
  if (!result.ok) return res.status(400).json({ error: result.error || 'Failed' });
  res.json({ ok: true, already: Boolean(result.already) });
});

export default router;
