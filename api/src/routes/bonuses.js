import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';
import { cherryMilestoneRewards, getCherryProfile } from '../domain/cherryClub.js';

const router = express.Router();

router.get('/balance', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(req.user.tgId);
    const cherryProfile = getCherryProfile({
      cherries: user?.cherry_balance,
      freeLiquids: user?.free_liquid_credits,
      freeBoxes: user?.free_box_credits,
    });
    res.json({
      balance: Number(user?.bonus_balance || 0),
      cherries: cherryProfile.cherries,
      cherryTier: cherryProfile.tier,
      cherryNext: cherryProfile.next,
      cherryProgress: cherryProfile.progress,
      cherriesPerOrder: cherryProfile.perOrderCherries,
      freeLiquids: cherryProfile.freeLiquids,
      freeBoxes: cherryProfile.freeBoxes,
      pendingDiscounts: Array.isArray(user?.pending_discounts) ? user.pending_discounts : [],
      redeemedLevels: Array.isArray(user?.cherry_redeemed_levels) ? user.cherry_redeemed_levels : [],
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

router.post('/redeem', requireAuth, (req, res) => {
  try {
    const level = Math.round(Number(req.body?.level || 0));
    if (!Number.isFinite(level) || level < 1 || level > 10) {
      return res.status(400).json({ error: 'Invalid level' });
    }
    const user = db.getUser(req.user.tgId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const cherries = Math.max(0, Math.round(Number(user?.cherry_balance || 0)));
    if (cherries < level) {
      return res.status(400).json({ error: 'Not enough cherries' });
    }
    const redeemed = Array.isArray(user?.cherry_redeemed_levels) ? user.cherry_redeemed_levels.slice() : [];
    if (redeemed.includes(level)) {
      return res.status(400).json({ error: 'Already redeemed' });
    }
    const reward = cherryMilestoneRewards().find((r) => Math.round(Number(r?.at || 0)) === level) || null;
    const pendingDiscounts = Array.isArray(user?.pending_discounts) ? user.pending_discounts.slice() : [];
    let freeLiquids = Math.max(0, Math.round(Number(user?.free_liquid_credits || 0)));
    let freeBoxes = Math.max(0, Math.round(Number(user?.free_box_credits || 0)));
    let extraCherries = 0;

    if (reward?.type === 'next_discount_fixed' && Number(reward?.value || 0) > 0) {
      pendingDiscounts.push({ type: 'fixed', value: Number(reward.value), at: level, status: 'pending' });
    }
    if (reward?.type === 'next_discount_percent' && Number(reward?.value || 0) > 0) {
      pendingDiscounts.push({ type: 'percent', value: Number(reward.value), at: level, status: 'pending' });
    }
    if (reward?.type === 'free_liquid' && Number(reward?.value || 0) > 0) {
      freeLiquids += Math.round(Number(reward.value || 0));
    }
    if (Number(reward?.freeLiquid || 0) > 0) {
      freeLiquids += Math.round(Number(reward.freeLiquid || 0));
    }
    if (Number(reward?.freeBox || 0) > 0) {
      freeBoxes += Math.round(Number(reward.freeBox || 0));
    }
    if (Number(reward?.extraCherries || 0) > 0) {
      extraCherries += Math.round(Number(reward.extraCherries || 0));
    }

    redeemed.push(level);
    db.setUser(req.user.tgId, {
      cherry_balance: Math.max(0, cherries - level + extraCherries),
      free_liquid_credits: freeLiquids,
      free_box_credits: freeBoxes,
      pending_discounts: pendingDiscounts,
      cherry_redeemed_levels: redeemed.sort((a, b) => Number(a) - Number(b)),
    });
    db.addBonusEvent({
      user_id: String(req.user.tgId),
      type: 'cherry_redeem',
      amount: -level,
      meta: { level, reward: reward || null, extraCherries },
      created_at: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('Bonus redeem error:', e);
    res.status(500).json({ error: 'Failed to redeem cherries' });
  }
});

export default router;
