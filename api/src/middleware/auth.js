import CryptoJS from 'crypto-js';
import jwt from 'jsonwebtoken';
import db from '../services/database.js';

export const verifyTelegramAuth = (req, res, next) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(401).json({ error: 'No initData provided' });
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ error: 'Bot token not configured' });
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return res.status(401).json({ error: 'No hash in initData' });
    }

    params.delete('hash');
    
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = CryptoJS.HmacSHA256(botToken, 'WebAppData');
    const calculatedHash = CryptoJS.HmacSHA256(dataCheckString, secretKey).toString(CryptoJS.enc.Hex);

    if (String(calculatedHash).toLowerCase() !== String(hash).toLowerCase()) {
      return res.status(401).json({ error: 'Invalid hash' });
    }

    const userData = JSON.parse(params.get('user'));
    
    req.user = {
      tgId: userData.id.toString(),
      username: userData.username,
      firstName: userData.first_name,
      lastName: userData.last_name
    };

    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice('Bearer '.length);
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const payload = jwt.verify(token, secret);

    const user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(payload.tgId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      tgId: user.tg_id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      ageVerified: user.age_verified,
      status: user.status,
    };

    if (!req.user.ageVerified) {
      return res.status(403).json({ error: 'Age verification required' });
    }

    next();
  } catch (err) {
    console.error('JWT auth error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAuthAllowUnverified = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice('Bearer '.length);
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const payload = jwt.verify(token, secret);

    const user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(payload.tgId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      tgId: user.tg_id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      ageVerified: user.age_verified,
      status: user.status,
    };

    next();
  } catch (err) {
    console.error('JWT auth error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};
