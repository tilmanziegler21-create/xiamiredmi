import express from 'express';
import jwt from 'jsonwebtoken';
import { requireAuthAllowUnverified, verifyTelegramAuth } from '../middleware/auth.js';
import db from '../services/database.js';
import { getCouriers } from '../services/sheets.js';

const router = express.Router();

function parseIdList(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function defaultCity() {
  const raw = String(process.env.CITY_CODES || '').trim();
  const first = raw.split(',').map((s) => s.trim()).filter(Boolean)[0];
  return first || '';
}

async function resolveStatus(tgId, existingStatus) {
  const adminIds = parseIdList(process.env.TELEGRAM_ADMIN_IDS);
  const n = Number(String(tgId));
  if (Number.isFinite(n) && adminIds.includes(n)) return 'admin';
  const existing = String(existingStatus || '').trim();
  if (existing === 'courier' || existing === 'admin') return existing;
  if (existing && existing !== 'regular') return existing;

  try {
    const city = defaultCity();
    if (!city) return 'regular';
    const list = await Promise.race([
      getCouriers(city),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ]);
    if (list.some((c) => String(c?.tg_id || '') === String(tgId))) return 'courier';
  } catch {
    // ignore
  }

  return existing || 'regular';
}

router.post('/verify', verifyTelegramAuth, async (req, res) => {
  try {
    const { tgId, username, firstName, lastName } = req.user;

    const existing = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tgId);
    const ageVerified = existing ? Boolean(existing.age_verified) : false;
    const existingStatus = existing ? String(existing.status || 'regular') : '';
    const status = await resolveStatus(tgId, existingStatus);

    db.prepare(
      'INSERT OR IGNORE INTO users (tg_id, username, first_name, last_name, age_verified, status, bonus_balance) VALUES (?, ?, ?, ?, ?, ?, 0)',
    ).run(tgId, username, firstName, lastName, ageVerified ? 1 : 0, status);
    db.prepare('UPDATE users SET username=?, first_name=?, last_name=?, status=? WHERE tg_id=?').run(username, firstName, lastName, status, tgId);
    let secret = String(process.env.JWT_SECRET || '').trim();
    if (!secret) {
      if (String(process.env.NODE_ENV || '') === 'production') {
        return res.status(500).json({ error: 'Server misconfigured' });
      }
      secret = 'dev-secret';
    }
    const token = jwt.sign(
      { tgId, username },
      secret,
      { expiresIn: '7d' }
    );
    
    const user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tgId);
    
    res.json({
      user: {
        tgId: user.tg_id,
        username: user.username,
        firstName: user.first_name,
        ageVerified: user.age_verified,
        status: user.status,
        bonusBalance: user.bonus_balance
      },
      token
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.post('/dev', async (_req, res) => {
  try {
    if (String(process.env.DEV_AUTH || '') !== '1') {
      return res.status(404).json({ error: 'Not found' });
    }
    if (String(process.env.NODE_ENV || '') === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    const tgId = String(_req.query?.tgId || 'dev_user_123');
    const username = String(_req.query?.username || 'dev_user');
    const firstName = String(_req.query?.firstName || 'Dev');
    const lastName = String(_req.query?.lastName || '');
    const status = String(_req.query?.status || process.env.DEV_USER_STATUS || 'regular');

    db.prepare(
      'INSERT OR IGNORE INTO users (tg_id, username, first_name, last_name, age_verified, status, bonus_balance) VALUES (?, ?, ?, ?, ?, ?, 0)',
    ).run(tgId, username, firstName, lastName, 1, status);
    db.prepare('UPDATE users SET username=?, first_name=?, last_name=?, status=? WHERE tg_id=?').run(username, firstName, lastName, status, tgId);

    const token = jwt.sign(
      { tgId, username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    const user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tgId);

    res.json({
      user: {
        tgId: user.tg_id,
        username: user.username,
        firstName: user.first_name,
        ageVerified: user.age_verified,
        status: user.status,
        bonusBalance: user.bonus_balance,
      },
      token,
    });
  } catch (error) {
    console.error('Dev auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.post('/age-verify', verifyTelegramAuth, async (req, res) => {
  try {
    const { tgId } = req.user;
    
    const stmt = db.prepare('UPDATE users SET age_verified = ? WHERE tg_id = ?');
    stmt.run(true, tgId);
    
    res.json({ success: true, ageVerified: true });
  } catch (error) {
    console.error('Age verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.get('/me', requireAuthAllowUnverified, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(req.user.tgId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({
      user: {
        tgId: user.tg_id,
        username: user.username,
        firstName: user.first_name,
        ageVerified: user.age_verified,
        status: user.status,
        bonusBalance: user.bonus_balance,
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
