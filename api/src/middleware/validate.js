export const validateBody = (fields) => (req, res, next) => {
  try {
    for (const [key, type] of Object.entries(fields || {})) {
      if (type === 'required') {
        const v = req.body?.[key];
        if (v === undefined || v === null || String(v).trim() === '') {
          return res.status(400).json({ error: `${key} обязателен` });
        }
      }
      if (type === 'number') {
        const v = req.body?.[key];
        if (v !== undefined && v !== null && String(v) !== '') {
          const n = Number(v);
          if (!Number.isFinite(n)) {
            return res.status(400).json({ error: `${key} должен быть числом` });
          }
        }
      }
    }
    next();
  } catch {
    return res.status(400).json({ error: 'Invalid body' });
  }
};

