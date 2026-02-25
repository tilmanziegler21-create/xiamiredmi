const base = String(process.env.WEB_URL || '').trim();
const intervalMs = Math.max(10_000, Number(process.env.KEEPALIVE_INTERVAL_MS || 60_000));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ping(path) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    await res.text();
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e) };
  }
}

async function loop() {
  if (!base) {
    process.exit(0);
  }
  for (;;) {
    const health = await ping('/health');
    const sheets = await ping('/health/sheets');
    if (!health.ok || !sheets.ok) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), health, sheets }));
    }
    await sleep(intervalMs);
  }
}

loop().catch((e) => {
  console.log(String(e?.message || e));
  process.exit(1);
});

