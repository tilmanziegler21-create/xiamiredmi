import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function getEnv(name, fallback = '') {
  return (process.env[name] || fallback || '').toString();
}

function parseCityMap() {
  const raw = String(getEnv('SHEETS_CITY_MAP', getEnv('CITY_SHEET_SUFFIX_MAP')) || '').trim();
  if (!raw) return new Map();
  const m = new Map();
  for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = part.split('=').map((x) => String(x || '').trim()).filter(Boolean);
    if (!k || !v) continue;
    m.set(k.toLowerCase(), v);
  }
  return m;
}

const cityMap = parseCityMap();

function normalizePrivateKey(raw) {
  let v = String(raw || '');
  v = v.trim();
  if (!v) return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!v.includes('BEGIN') && /^[A-Za-z0-9+/=]+$/.test(v) && v.length > 128) {
    try {
      v = Buffer.from(v, 'base64').toString('utf8');
    } catch {
    }
  }
  v = v.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  return v.trim();
}

function getSpreadsheetId() {
  return getEnv('GOOGLE_SHEETS_SPREADSHEET_ID', getEnv('GOOGLE_SHEET_ID'));
}

function getServiceAccount() {
  const email = getEnv(
    'GOOGLE_SHEETS_CLIENT_EMAIL',
    getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', getEnv('GOOGLE_CLIENT_EMAIL')),
  );
  const rawKey = getEnv(
    'GOOGLE_SHEETS_PRIVATE_KEY',
    getEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', getEnv('GOOGLE_PRIVATE_KEY')),
  );
  const key = normalizePrivateKey(rawKey);
  if (!email || !key) {
    const err = new Error('Sheets not configured');
    err.status = 503;
    err.code = 'SHEETS_NOT_CONFIGURED';
    err.missing = [
      ...(email ? [] : ['GOOGLE_SHEETS_CLIENT_EMAIL']),
      ...(rawKey ? [] : ['GOOGLE_SHEETS_PRIVATE_KEY']),
    ];
    throw err;
  }
  return { email, key };
}

let cachedSheets = null;
function sheetsApi() {
  if (cachedSheets) return cachedSheets;
  const { email, key } = getServiceAccount();
  const auth = new google.auth.JWT({ email, key, scopes: SCOPES });
  cachedSheets = google.sheets({ version: 'v4', auth });
  return cachedSheets;
}

let cachedSpreadsheetMeta = null;
async function spreadsheetMeta(spreadsheetId) {
  const ttl = Number(getEnv('SHEETS_CACHE_TTL_SECONDS', '600')) * 1000;
  if (cachedSpreadsheetMeta && cachedSpreadsheetMeta.id === spreadsheetId && Date.now() - cachedSpreadsheetMeta.ts < ttl) {
    return cachedSpreadsheetMeta.data;
  }
  const api = sheetsApi();
  const resp = await withRetry(() => api.spreadsheets.get({ spreadsheetId, includeGridData: false }));
  const data = resp?.data || {};
  cachedSpreadsheetMeta = { id: spreadsheetId, ts: Date.now(), data };
  return data;
}

async function sheetTitleMap(spreadsheetId) {
  const meta = await spreadsheetMeta(spreadsheetId);
  const sheets = Array.isArray(meta.sheets) ? meta.sheets : [];
  const map = new Map();
  for (const s of sheets) {
    const rawTitle = String(s?.properties?.title || '');
    if (!rawTitle.trim()) continue;
    const lowerKey = rawTitle.toLowerCase();
    const normKey = normalizeTabKey(rawTitle);
    if (!map.has(lowerKey)) map.set(lowerKey, rawTitle);
    if (normKey && !map.has(normKey)) map.set(normKey, rawTitle);
  }
  return map;
}

function normalizeHeaderKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '');
}

function headerIndex(headers, name) {
  const target = String(name || '').trim().toLowerCase();
  const key = normalizeHeaderKey(target);
  const exact = headers.findIndex((h) => String(h || '').trim().toLowerCase() === target);
  if (exact >= 0) return exact;
  if (!key) return -1;
  return headers.findIndex((h) => normalizeHeaderKey(h) === key);
}

function headerIndexAny(headers, names) {
  for (const n of names) {
    const target = String(n || '').trim().toLowerCase();
    const key = normalizeHeaderKey(target);
    const i = headers.findIndex((h) => String(h || '').trim().toLowerCase() === target);
    if (i >= 0) return i;
    if (key) {
      const j = headers.findIndex((h) => normalizeHeaderKey(h) === key);
      if (j >= 0) return j;
    }
  }
  return -1;
}

function colLetter(idx) {
  const i = Number(idx);
  if (!Number.isFinite(i) || i < 0) return 'A';
  if (i < 26) return String.fromCharCode(65 + i);
  return String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
}

function toBool(v) {
  const s = String(v || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'да'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'нет'].includes(s)) return false;
  return Boolean(v);
}

function toNumber(v) {
  const n = Number(String(v || '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function sheetRange(sheetTitle, a1) {
  const s = String(sheetTitle || '').replace(/'/g, "''");
  return `'${s}'!${a1}`;
}

const SHEET_READ_A1 = 'A1:AZ5000';

function normalizeTabKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '');
}

function tabOverrideEnvKey(baseName) {
  const b = String(baseName || '').trim().toLowerCase();
  if (b === 'products') return 'SHEET_TAB_PRODUCTS';
  if (b === 'orders') return 'SHEET_TAB_ORDERS';
  if (b === 'couriers') return 'SHEET_TAB_COURIERS';
  return '';
}

function sheetOverrideCandidates(baseName, city) {
  const envKey = tabOverrideEnvKey(baseName);
  if (!envKey) return [];
  const raw = String(getEnv(envKey) || '').trim();
  if (!raw) return [];
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const resolved = p.replace(/\{CITY\}/g, String(city || '').trim()).trim();
    if (resolved) out.push(resolved);
  }
  return out;
}

function baseTabAliases(baseName) {
  const b = String(baseName || '').trim().toLowerCase();
  if (b === 'products') return ['Products', 'Product', 'товары', 'товар', 'каталог', 'ассортимент'];
  if (b === 'orders') return ['Orders', 'Order', 'заказы', 'заказ'];
  if (b === 'couriers') return ['Couriers', 'Courier', 'курьеры', 'курьер'];
  if (b === 'promos') return ['Promos', 'Promo', 'промо', 'акции'];
  return [];
}

function cityVariants(city) {
  const c = String(city || '').trim();
  if (!c) return [];
  const mapped = cityMap.get(c.toLowerCase());
  const out = new Set([c, c.toUpperCase(), c.toLowerCase()]);
  if (mapped) out.add(String(mapped).trim());
  if (c.length >= 2) out.add(c.slice(0, 2).toUpperCase());
  if (c.length >= 3) out.add(c.slice(0, 3).toUpperCase());
  return Array.from(out).filter(Boolean);
}

function sheetCandidates(base, city) {
  const cities = cityVariants(city);
  const out = [];
  for (const c of cities) {
    out.push(base.endsWith('_') ? `${base}${c}` : `${base}_${c}`);
    out.push(`${base}${c}`);
    out.push(`${base}-${c}`);
    out.push(`${base} ${c}`);
  }
  out.push(base);
  out.push(base.endsWith('_') ? base : `${base}_`);
  return Array.from(new Set(out));
}

const cache = new Map();
const inflight = new Map();
function cacheGet(key) {
  const ttl = Number(getEnv('SHEETS_CACHE_TTL_SECONDS', '600')) * 1000;
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > ttl) return null;
  try {
    cache.delete(key);
    cache.set(key, v);
  } catch {
  }
  return v.data;
}

function cacheGetStale(key) {
  const v = cache.get(key);
  if (!v) return null;
  return v.data;
}

function cacheSet(key, data) {
  const max = Math.max(1, Number(getEnv('SHEETS_CACHE_MAX_ENTRIES', '60')));
  try {
    if (cache.has(key)) cache.delete(key);
  } catch {
  }
  cache.set(key, { ts: Date.now(), data });
  while (cache.size > max) {
    const firstKey = cache.keys().next().value;
    if (firstKey == null) break;
    cache.delete(firstKey);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errStatus(e) {
  const direct = Number(e?.status);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const code = Number(e?.code);
  if (Number.isFinite(code) && code > 0) return code;
  const resp = Number(e?.response?.status);
  if (Number.isFinite(resp) && resp > 0) return resp;
  const deep = Number(e?.response?.data?.error?.code);
  if (Number.isFinite(deep) && deep > 0) return deep;
  return 0;
}

async function withRetry(fn) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const st = errStatus(e);
      const retryable = st === 429 || st >= 500 || st === 0;
      if (!retryable || i === 2) break;
      await sleep(400 * Math.pow(2, i));
    }
  }
  throw last;
}

export async function readSheetTable(baseName, city) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    const err = new Error('Sheets not configured');
    err.status = 503;
    err.code = 'SHEETS_NOT_CONFIGURED';
    err.missing = ['GOOGLE_SHEETS_SPREADSHEET_ID'];
    throw err;
  }

  const api = sheetsApi();
  const titles = await sheetTitleMap(spreadsheetId);
  const bases = Array.from(new Set([baseName, ...baseTabAliases(baseName)]));
  const candidates = Array.from(new Set([
    ...sheetOverrideCandidates(baseName, city),
    ...bases.flatMap((b) => sheetCandidates(b, city)),
  ]));
  let lastErr = null;

  for (const name of candidates) {
    const actualName =
      titles.get(String(name).toLowerCase()) ||
      titles.get(normalizeTabKey(name)) ||
      name;
    const key = `${spreadsheetId}:${actualName}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    if (inflight.has(key)) {
      try {
        return await inflight.get(key);
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    const stale = cacheGetStale(key);
    const promise = (async () => {
      const range = sheetRange(actualName, SHEET_READ_A1);
      try {
        const resp = await withRetry(() => api.spreadsheets.values.get({ spreadsheetId, range }));
        const values = resp.data.values || [];
        const headers = (values[0] || []).map((x) => String(x));
        const rows = values.slice(1);
        const out = { sheet: actualName, headers, rows };
        cacheSet(key, out);
        return out;
      } catch (e) {
        const msg = String(e?.message || '');
        if (msg.includes('ERR_OSSL_UNSUPPORTED') || msg.includes('DECODER routines')) {
          const err = new Error('Sheets auth key format not supported');
          err.status = 503;
          err.code = 'SHEETS_KEY_UNSUPPORTED';
          throw err;
        }
        if (msg.toLowerCase().includes('unable to parse range') || msg.toLowerCase().includes('range') && msg.toLowerCase().includes('parse')) {
          const err = new Error('Sheet tab not found');
          err.status = 404;
          err.code = 'SHEETS_TAB_NOT_FOUND';
          const envKey = tabOverrideEnvKey(baseName);
          err.details = {
            candidate: String(name),
            resolvedTitle: String(actualName),
            range: String(range),
            city: String(city || ''),
            envKey,
            envOverride: envKey ? String(getEnv(envKey) || '') : '',
            spreadsheetIdTail: String(spreadsheetId || '').slice(-6),
          };
          throw err;
        }
        if (stale) return stale;
        throw e;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, promise);
    try {
      return await promise;
    } catch (e) {
      lastErr = e;
    }
  }

  if (lastErr?.code === 'SHEETS_TAB_NOT_FOUND') {
    try {
      const baseNorms = Array.from(new Set([baseName, ...baseTabAliases(baseName)].map((x) => normalizeTabKey(x)).filter(Boolean)));
      const cityNorm = normalizeTabKey(city);
      const keys = Array.from(titles.entries()).map(([lower, actual]) => ({
        lower,
        actual,
        norm: normalizeTabKey(actual),
      }));

      const scored = keys
        .map((k) => {
          const hasBase = baseNorms.length ? baseNorms.some((bn) => k.norm.includes(bn)) : false;
          const hasCity = cityNorm ? k.norm.includes(cityNorm) : true;
          if (!hasBase || !hasCity) return null;
          return { ...k, score: k.norm.length };
        })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score);

      const picked = scored[0]?.actual;
      if (picked) {
        const key = `${spreadsheetId}:${picked}`;
        const cached = cacheGet(key);
        if (cached) return cached;
        const range = sheetRange(picked, SHEET_READ_A1);
        const resp = await withRetry(() => api.spreadsheets.values.get({ spreadsheetId, range }));
        const values = resp.data.values || [];
        const headers = (values[0] || []).map((x) => String(x));
        const rows = values.slice(1);
        const out = { sheet: picked, headers, rows };
        cacheSet(key, out);
        return out;
      }
    } catch {
    }
  }

  throw lastErr || new Error(`Unable to read sheet ${baseName}`);
}

export async function listSheetTabs() {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    const err = new Error('Sheets not configured');
    err.status = 503;
    err.code = 'SHEETS_NOT_CONFIGURED';
    err.missing = ['GOOGLE_SHEETS_SPREADSHEET_ID'];
    throw err;
  }
  const meta = await spreadsheetMeta(spreadsheetId);
  const sheets = Array.isArray(meta.sheets) ? meta.sheets : [];
  return sheets
    .map((s) => String(s?.properties?.title || '').trim())
    .filter(Boolean)
    .map((title) => ({ title, key: normalizeTabKey(title) }));
}

export async function getProducts(city) {
  const { sheet, headers, rows } = await readSheetTable('products', city);
  const skuIdx = headerIndexAny(headers, ['sku', 'product_id', 'id']);
  const nameIdx = headerIndexAny(headers, ['name', 'title']);
  const categoryIdx = headerIndexAny(headers, ['category', 'категория']);
  const brandIdx = headerIndexAny(headers, ['brand', 'бренд', 'марка']);
  const priceIdx = headerIndexAny(headers, ['price']);
  const stockIdx = headerIndexAny(headers, ['stock', 'qty', 'qty_available', 'остаток', 'количество', 'кол-во']);
  const activeIdx = headerIndexAny(headers, ['active', 'is_active', 'активен', 'активный']);
  const isNewIdx = headerIndexAny(headers, ['is_new', 'new', 'новинка']);
  const discountIdx = headerIndexAny(headers, ['discount', 'sale', 'скидка']);
  const imageIdx = headerIndexAny(headers, ['image', 'photo', 'img', 'картинка', 'фото', 'изображение']);
  const descIdx = headerIndexAny(headers, ['description', 'desc', 'описание']);
  const tasteSweetIdx = headerIndexAny(headers, ['sweet', 'sweetness']);
  const tasteSourIdx = headerIndexAny(headers, ['sour']);
  const tasteFruitIdx = headerIndexAny(headers, ['fruit', 'fruitiness']);
  const tasteCoolIdx = headerIndexAny(headers, ['cool', 'coolness']);
  const tasteStrengthIdx = headerIndexAny(headers, ['strength']);

  const products = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const sku = skuIdx >= 0 ? String(r[skuIdx] || '').trim() : '';
    if (!sku) continue;
    const name = nameIdx >= 0 ? String(r[nameIdx] || '').trim() : '';
    const category = categoryIdx >= 0 ? String(r[categoryIdx] || '').trim() : '';
    const brand = brandIdx >= 0 ? String(r[brandIdx] || '').trim() : '';
    const price = priceIdx >= 0 ? toNumber(r[priceIdx]) : 0;
    const stock = stockIdx >= 0 ? toNumber(r[stockIdx]) : 0;
    const active = activeIdx >= 0 ? toBool(r[activeIdx]) : true;
    const isNew = isNewIdx >= 0 ? toBool(r[isNewIdx]) : false;
    const discount = discountIdx >= 0 ? toNumber(r[discountIdx]) : 0;
    const image = imageIdx >= 0 ? String(r[imageIdx] || '').trim() : '';
    const description = descIdx >= 0 ? String(r[descIdx] || '').trim() : '';
    const tasteProfile = {
      sweet: tasteSweetIdx >= 0 ? toNumber(r[tasteSweetIdx]) : 0,
      sour: tasteSourIdx >= 0 ? toNumber(r[tasteSourIdx]) : 0,
      fruit: tasteFruitIdx >= 0 ? toNumber(r[tasteFruitIdx]) : 0,
      cool: tasteCoolIdx >= 0 ? toNumber(r[tasteCoolIdx]) : 0,
      strength: tasteStrengthIdx >= 0 ? toNumber(r[tasteStrengthIdx]) : 0,
    };
    products.push({
      sku,
      name,
      category,
      brand,
      price,
      stock,
      active,
      isNew,
      discount,
      image,
      description,
      tasteProfile,
      _sheet: sheet,
      _rowIndex: i + 2,
      _headers: headers,
    });
  }
  return products;
}

export async function getMasterBrands(cityHint) {
  const explicit = String(getEnv('SHEETS_MASTER_CITY', getEnv('MASTER_CITY_CODE')) || '').trim();
  const fromList = String(getEnv('CITY_CODES') || '').split(',')[0].trim();
  const masterCity = explicit || String(cityHint || '').trim() || fromList || 'MU';
  const { headers, rows } = await readSheetTable('products', masterCity);
  const norm = (v) => String(v || '').trim().toLowerCase();
  const idx = headers.findIndex((h) => ['brands', 'brand'].includes(norm(h)));
  if (idx < 0) return [];

  const out = new Set();
  for (const r of rows) {
    const cell = String(r?.[idx] || '').trim();
    if (!cell) continue;
    const parts = cell.split(/[,;|]/g).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) out.add(p);
  }
  return Array.from(out).sort((a, b) => String(a).localeCompare(String(b)));
}

export async function updateProductStock(product, newStock, newActive) {
  const spreadsheetId = getSpreadsheetId();
  const api = sheetsApi();
  const headers = product._headers;
  const stockIdx = headerIndexAny(headers, ['stock', 'qty', 'qty_available', 'остаток', 'количество', 'кол-во']);
  const activeIdx = headerIndexAny(headers, ['active', 'is_active', 'активен', 'активный']);
  if (stockIdx < 0) throw new Error('Stock column not found in products sheet');
  if (activeIdx < 0) throw new Error('Active column not found in products sheet');

  const row = product._rowIndex;
  const stockCol = colLetter(stockIdx);
  const activeCol = colLetter(activeIdx);

  await api.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: sheetRange(product._sheet, `${stockCol}${row}`), values: [[String(newStock)]] },
        { range: sheetRange(product._sheet, `${activeCol}${row}`), values: [[newActive ? 'TRUE' : 'FALSE']] },
      ],
    },
  });

  cache.delete(`${spreadsheetId}:${String(product._sheet || '')}`);
}

export async function appendOrderRow(city, orderRow) {
  const spreadsheetId = getSpreadsheetId();
  const api = sheetsApi();
  const { sheet, headers } = await readSheetTable('orders', city);

  const idx = (name) => headerIndex(headers, name);
  const values = new Array(headers.length).fill('');
  for (const [k, v] of Object.entries(orderRow)) {
    const i = idx(k);
    if (i >= 0) values[i] = v == null ? '' : String(v);
  }

  await api.spreadsheets.values.append({
    spreadsheetId,
    range: sheetRange(sheet, SHEET_READ_A1),
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });

  cache.delete(`${spreadsheetId}:${String(sheet || '')}`);
}

export async function appendCourierRow(city, courierRow) {
  const spreadsheetId = getSpreadsheetId();
  const api = sheetsApi();
  const { sheet, headers } = await readSheetTable('couriers', city);

  const idx = (name) => headerIndex(headers, name);
  const values = new Array(headers.length).fill('');
  for (const [k, v] of Object.entries(courierRow)) {
    const i = idx(k);
    if (i >= 0) values[i] = v == null ? '' : String(v);
  }

  await api.spreadsheets.values.append({
    spreadsheetId,
    range: sheetRange(sheet, SHEET_READ_A1),
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });

  cache.delete(`${spreadsheetId}:${String(sheet || '')}`);
}

export async function updateOrderRowByOrderId(city, orderId, patch) {
  const spreadsheetId = getSpreadsheetId();
  const api = sheetsApi();
  const { sheet, headers, rows } = await readSheetTable('orders', city);
  const idIdx = headerIndexAny(headers, ['order_id', 'id']);
  if (idIdx < 0) throw new Error('order_id column not found in orders sheet');

  let targetRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i]?.[idIdx];
    if (String(v || '').trim() === String(orderId).trim()) {
      targetRowIndex = i + 2;
      break;
    }
  }
  if (targetRowIndex < 0) return false;

  const updates = [];
  for (const [k, v] of Object.entries(patch)) {
    const colIdx = headerIndex(headers, k);
    if (colIdx < 0) continue;
    const col = colLetter(colIdx);
    updates.push({ range: sheetRange(sheet, `${col}${targetRowIndex}`), values: [[v == null ? '' : String(v)]] });
  }
  if (updates.length === 0) return true;

  await api.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data: updates },
  });

  cache.delete(`${spreadsheetId}:${String(sheet || '')}`);
  return true;
}

export async function getCouriers(city) {
  const { headers, rows } = await readSheetTable('couriers', city);
  const idIdx = headerIndexAny(headers, ['courier_id', 'id']);
  const nameIdx = headerIndexAny(headers, ['name']);
  const tgIdx = headerIndexAny(headers, ['tg_id', 'telegram_id']);
  const activeIdx = headerIndexAny(headers, ['active', 'is_active']);
  const fromIdx = headerIndexAny(headers, ['time_from']);
  const toIdx = headerIndexAny(headers, ['time_to']);
  const meetingIdx = headerIndexAny(headers, ['meeting_place', 'meeting place', 'место встречи', 'точка встречи']);
  const placeIdx = meetingIdx >= 0 ? meetingIdx : headerIndexAny(headers, ['place', 'location', 'pickup_point', 'pickup point', 'точка', 'место', 'локация']);
  const addrIdx = meetingIdx >= 0 || placeIdx >= 0 ? -1 : headerIndexAny(headers, ['address', 'адрес']);
  const out = [];
  for (const r of rows) {
    const active = activeIdx >= 0 ? toBool(r[activeIdx]) : true;
    out.push({
      courier_id: idIdx >= 0 ? String(r[idIdx] || '').trim() : '',
      name: nameIdx >= 0 ? String(r[nameIdx] || '').trim() : '',
      tg_id: tgIdx >= 0 ? String(r[tgIdx] || '').trim() : '',
      active,
      time_from: fromIdx >= 0 ? String(r[fromIdx] || '').trim() : '',
      time_to: toIdx >= 0 ? String(r[toIdx] || '').trim() : '',
      meeting_place: placeIdx >= 0 ? String(r[placeIdx] || '').trim() : addrIdx >= 0 ? String(r[addrIdx] || '').trim() : '',
    });
  }
  return out;
}

export async function getOrders(city) {
  const { headers, rows } = await readSheetTable('orders', city);
  const getIdx = (names) => headerIndexAny(headers, names);
  const orderIdIdx = getIdx(['order_id', 'id']);
  const userIdIdx = getIdx(['user_id', 'tg_id']);
  const statusIdx = getIdx(['status']);
  const totalIdx = getIdx(['total_amount', 'total']);
  const deliveryMethodIdx = getIdx(['delivery_method']);
  const courierIdIdx = getIdx(['courier_id']);
  const deliveryDateIdx = getIdx(['delivery_date']);
  const deliveryTimeIdx = getIdx(['delivery_time']);
  const paymentMethodIdx = getIdx(['payment_method']);
  const bonusAppliedIdx = getIdx(['bonus_applied']);
  const finalAmountIdx = getIdx(['final_amount']);
  const userNameIdx = getIdx(['user_name', 'customer_name', 'name']);
  const userPhoneIdx = getIdx(['user_phone', 'phone']);
  const deliveryAddressIdx = getIdx(['delivery_address', 'address']);
  const commentIdx = getIdx(['comment', 'note']);
  const courierDataIdx = getIdx(['courier_data', 'courier_data_json']);
  const promoCodeIdx = getIdx(['promo_code']);
  const discountAmountIdx = getIdx(['discount_amount']);
  const subtotalAmountIdx = getIdx(['subtotal_amount']);
  const createdIdx = getIdx(['created_at', 'created']);
  const itemCountIdx = getIdx(['item_count']);
  const itemsIdx = getIdx(['items_json']);

  const out = [];
  for (const r of rows) {
    const order_id = orderIdIdx >= 0 ? String(r[orderIdIdx] || '').trim() : '';
    if (!order_id) continue;
    out.push({
      order_id,
      user_id: userIdIdx >= 0 ? String(r[userIdIdx] || '').trim() : '',
      status: statusIdx >= 0 ? String(r[statusIdx] || '').trim() : '',
      total_amount: totalIdx >= 0 ? toNumber(r[totalIdx]) : 0,
      delivery_method: deliveryMethodIdx >= 0 ? String(r[deliveryMethodIdx] || '').trim() : '',
      courier_id: courierIdIdx >= 0 ? String(r[courierIdIdx] || '').trim() : '',
      delivery_date: deliveryDateIdx >= 0 ? String(r[deliveryDateIdx] || '').trim() : '',
      delivery_time: deliveryTimeIdx >= 0 ? String(r[deliveryTimeIdx] || '').trim() : '',
      payment_method: paymentMethodIdx >= 0 ? String(r[paymentMethodIdx] || '').trim() : '',
      bonus_applied: bonusAppliedIdx >= 0 ? toNumber(r[bonusAppliedIdx]) : 0,
      final_amount: finalAmountIdx >= 0 ? toNumber(r[finalAmountIdx]) : 0,
      user_name: userNameIdx >= 0 ? String(r[userNameIdx] || '').trim() : '',
      user_phone: userPhoneIdx >= 0 ? String(r[userPhoneIdx] || '').trim() : '',
      delivery_address: deliveryAddressIdx >= 0 ? String(r[deliveryAddressIdx] || '').trim() : '',
      comment: commentIdx >= 0 ? String(r[commentIdx] || '').trim() : '',
      courier_data: courierDataIdx >= 0 ? String(r[courierDataIdx] || '').trim() : '',
      promo_code: promoCodeIdx >= 0 ? String(r[promoCodeIdx] || '').trim() : '',
      discount_amount: discountAmountIdx >= 0 ? toNumber(r[discountAmountIdx]) : 0,
      subtotal_amount: subtotalAmountIdx >= 0 ? toNumber(r[subtotalAmountIdx]) : 0,
      created_at: createdIdx >= 0 ? String(r[createdIdx] || '').trim() : '',
      item_count: itemCountIdx >= 0 ? toNumber(r[itemCountIdx]) : 0,
      items_json: itemsIdx >= 0 ? String(r[itemsIdx] || '').trim() : '',
    });
  }
  return out;
}

export async function updateCourierRowByCourierId(city, courierId, patch) {
  const spreadsheetId = getSpreadsheetId();
  const api = sheetsApi();
  const { sheet, headers, rows } = await readSheetTable('couriers', city);
  const idIdx = headerIndexAny(headers, ['courier_id', 'id']);
  if (idIdx < 0) throw new Error('courier_id column not found in couriers sheet');

  let targetRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i]?.[idIdx];
    if (String(v || '').trim() === String(courierId).trim()) {
      targetRowIndex = i + 2;
      break;
    }
  }
  if (targetRowIndex < 0) return false;

  const updates = [];
  const seen = new Set();
  const pushUpdate = (colIdx, value) => {
    if (colIdx < 0) return;
    const col = colLetter(colIdx);
    const range = sheetRange(sheet, `${col}${targetRowIndex}`);
    if (seen.has(range)) return;
    seen.add(range);
    updates.push({ range, values: [[value == null ? '' : String(value)]] });
  };
  const findIdx = (names) => headerIndexAny(headers, names);

  const timeFrom = patch?.time_from ?? patch?.timeFrom;
  const timeTo = patch?.time_to ?? patch?.timeTo;
  const meetingPlace = patch?.meeting_place ?? patch?.meetingPlace ?? patch?.place ?? patch?.location;
  const updatedAt = patch?.updated_at ?? patch?.updatedAt;

  if (timeFrom != null && String(timeFrom).trim()) {
    pushUpdate(findIdx(['time_from', 'time from', 'время с', 'с']), timeFrom);
  }
  if (timeTo != null && String(timeTo).trim()) {
    pushUpdate(findIdx(['time_to', 'time to', 'время до', 'до']), timeTo);
  }
  if (meetingPlace != null && String(meetingPlace).trim()) {
    const meetingIdx = findIdx(['meeting_place', 'meeting place', 'место встречи', 'точка встречи']);
    const placeIdx = meetingIdx >= 0 ? meetingIdx : findIdx(['place', 'location', 'pickup_point', 'pickup point', 'точка', 'место', 'локация']);
    const addrIdx = meetingIdx >= 0 || placeIdx >= 0 ? -1 : findIdx(['address', 'адрес']);
    if (placeIdx >= 0) pushUpdate(placeIdx, meetingPlace);
    else if (addrIdx >= 0) pushUpdate(addrIdx, meetingPlace);
  }
  if (updatedAt != null && String(updatedAt).trim()) {
    pushUpdate(findIdx(['updated_at', 'updated at', 'обновлено', 'обновлено в', 'дата обновления']), updatedAt);
  }

  for (const [k, v] of Object.entries(patch || {})) {
    if (k === 'time_from' || k === 'time_to' || k === 'meeting_place' || k === 'updated_at') continue;
    const colIdx = headerIndex(headers, k);
    if (colIdx < 0) continue;
    pushUpdate(colIdx, v);
  }
  if (updates.length === 0) return true;

  await api.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data: updates },
  });

  cache.delete(`${spreadsheetId}:${String(sheet || '')}`);
  return true;
}
