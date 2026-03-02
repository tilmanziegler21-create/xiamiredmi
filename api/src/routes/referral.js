import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';
import { getOrders } from '../services/sheets.js';
import { normalizeOrderStatus } from '../domain/orderStatus.js';

const router = express.Router();

function listCities() {
  const raw = String(process.env.CITY_CODES || '').trim();
  if (!raw) return ['MU'];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function countInvited(referrerId) {
  const id = String(referrerId || '').trim();
  if (!id) return 0;
  let n = 0;
  for (const u of db.users.values()) {
    if (String(u?.referred_by || '').trim() === id) n++;
  }
  return n;
}

function ambassadorPercent(invited) {
  const n = Math.max(0, Math.round(Number(invited || 0)));
  if (n >= 50) return 20;
  if (n >= 30) return 15;
  if (n >= 20) return 10;
  if (n >= 10) return 5;
  return 0;
}

function nextAmbassadorStep(invited) {
  const n = Math.max(0, Math.round(Number(invited || 0)));
  if (n < 20) return { at: 20, percent: 10 };
  if (n < 30) return { at: 30, percent: 15 };
  if (n < 50) return { at: 50, percent: 20 };
  return null;
}

router.get('/info', requireAuth, (req, res) => {
  const tgId = String(req.user?.tgId || '');
  const u = db.getUser(tgId);
  const invited = countInvited(tgId);
  const stage = invited >= 10 ? 'ambassador' : 'partner';
  const minWithdraw = 50;
  const storeBalance = Math.max(0, Math.round(Number(u?.referral_balance_store || 0) * 100) / 100);
  const cashBalance = Math.max(0, Math.round(Number(u?.referral_balance_cash || 0) * 100) / 100);
  const totalBalance = Math.round((storeBalance + cashBalance) * 100) / 100;
  const percent = stage === 'partner' ? 30 : ambassadorPercent(invited);
  const next = stage === 'partner' ? { at: 10, percent: 5 } : nextAmbassadorStep(invited);
  res.json({
    referralCode: tgId,
    referredBy: String(u?.referred_by || ''),
    stage,
    invited,
    percent,
    next,
    unlockAt: 10,
    remainingToUnlock: Math.max(0, 10 - invited),
    balances: {
      total: totalBalance,
      store: storeBalance,
      cash: cashBalance,
      withdrawUnlocked: stage === 'ambassador',
      minWithdraw,
      canWithdraw: stage === 'ambassador' && cashBalance >= minWithdraw,
    },
  });
});

router.post('/claim', requireAuth, (req, res) => {
  const tgId = String(req.user?.tgId || '');
  const ref = String(req.body?.ref || '').trim();
  const result = db.claimReferral(tgId, ref);
  if (!result.ok) return res.status(400).json({ error: result.error || 'Failed' });
  res.json({ ok: true, already: Boolean(result.already) });
});

router.get('/invited', requireAuth, async (req, res) => {
  try {
    const myId = String(req.user?.tgId || '').trim();
    if (!myId) return res.status(401).json({ error: 'Unauthorized' });

    const invitedUsers = Array.from(db.users.values())
      .filter((u) => String(u?.referred_by || '').trim() === myId)
      .map((u) => ({
        tgId: String(u?.tg_id || '').trim(),
        username: String(u?.username || '').trim(),
        firstName: String(u?.first_name || '').trim(),
        claimedAt: String(u?.referral_claimed_at || '').trim(),
      }))
      .filter((u) => u.tgId);

    const purchased = new Set();
    const firstPurchaseAt = new Map();
    const isPurchasedStatus = (raw) => {
      const s = normalizeOrderStatus(raw);
      return s !== 'buffer' && s !== 'cancelled';
    };
    for (const city of listCities()) {
      let orders = [];
      try {
        orders = await getOrders(city);
      } catch {
        orders = [];
      }
      for (const o of orders) {
        const uid = String(o?.user_id || '').trim();
        if (!uid) continue;
        if (!isPurchasedStatus(o?.status)) continue;
        purchased.add(uid);
        const ts = Date.parse(String(o?.created_at || ''));
        if (!Number.isFinite(ts)) continue;
        const prev = firstPurchaseAt.get(uid);
        if (!prev || ts < prev.ts) {
          firstPurchaseAt.set(uid, { ts, iso: new Date(ts).toISOString() });
        }
      }
    }

    res.json({
      invited: invitedUsers
        .map((u) => ({
          ...u,
          bought: purchased.has(u.tgId),
          firstPurchaseAt: String(firstPurchaseAt.get(u.tgId)?.iso || ''),
        }))
        .sort((a, b) => Number(Boolean(b.bought)) - Number(Boolean(a.bought)) || String(a.claimedAt).localeCompare(String(b.claimedAt))),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load invited users' });
  }
});

export default router;
