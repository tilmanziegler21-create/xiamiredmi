import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../services/database.js';

const router = express.Router();

router.post('/event', requireAuth, (req, res) => {
  try {
    const { event, params } = req.body || {};
    if (!event) return res.status(400).json({ error: 'event is required' });
    db.addAnalyticsEvent({
      user_id: req.user.tgId,
      event: String(event),
      params: params ? JSON.stringify(params) : '{}',
      created_at: new Date().toISOString(),
      user_agent: String(req.headers['user-agent'] || ''),
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('Analytics error:', e);
    res.status(500).json({ error: 'Failed to write event' });
  }
});

export default router;

