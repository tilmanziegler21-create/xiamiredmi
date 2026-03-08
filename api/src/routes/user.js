import express from 'express';
import { requireAuthAllowUnverified } from '../middleware/auth.js';
import db from '../services/database.js';

const router = express.Router();

router.post('/start', requireAuthAllowUnverified, (req, res) => {
  try {
    const tgId = String(req.user?.tgId || '').trim();
    const userId = String(req.body?.user_id || '').trim();
    const referrerId = String(req.body?.referrer_id || '').trim();
    if (!tgId) return res.status(401).json({ error: 'Unauthorized' });
    if (userId && userId !== tgId) return res.status(400).json({ error: 'Invalid user_id' });
    if (!referrerId) return res.json({ ok: true, applied: false });
    if (referrerId === tgId) return res.status(400).json({ error: 'Self ref' });
    const u = db.getUser(tgId);
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (String(u.referred_by || '').trim()) return res.json({ ok: true, applied: false, already: true });
    const result = db.claimReferral(tgId, referrerId);
    if (!result.ok) return res.status(400).json({ error: result.error || 'Failed to claim referral' });
    return res.json({ ok: true, applied: !result.already, already: Boolean(result.already) });
  } catch {
    return res.status(500).json({ error: 'Failed to process start' });
  }
});

export default router;
