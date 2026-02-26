import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function getEnv(name, fallback = '') {
  return (process.env[name] || fallback || '').toString();
}

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

function getServiceAccount() {
  const email = getEnv('GOOGLE_SHEETS_CLIENT_EMAIL', getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'));
  const rawKey = getEnv('GOOGLE_SHEETS_PRIVATE_KEY', getEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'));
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

function headerIndex(headers, name) {
  const target = String(name || '').trim().toLowerCase();
  return headers.findIndex((h) => String(h || '').trim().toLowerCase() === target);
}

function headerIndexAny(headers, names) {
  for (const n of names) {
    const target = String(n || '').trim().toLowerCase();
    const i = headers.findIndex((h) => String(h || '').trim().toLowerCase() === target);
    if (i >= 0) return i;
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

function sheetCandidates(base, city) {
  const out = [];
  out.push(base);
  out.push(base.endsWith('_') ? base : `${base}_`);
  if (city) {
    out.push(base.endsWith('_') ? `${base}${city}` : `${base}_${city}`);
  }
  return Array.from(new Set(out));
}

const cache = new Map();
const inflight = new Map();
function cacheGet(key) {
  const ttl = Number(getEnv('SHEETS_CACHE_TTL_SECONDS', '600')) * 1000;
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > ttl) return null;
  return v.data;
}

function cacheGetStale(key) {
  const v = cache.get(key);
  if (!v) return null;
  return v.data;
}

function cacheSet(key, data) {
  cache.set(key, { ts: Date.now(), data });
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
  const spreadsheetId = getEnv('GOOGLE_SHEETS_SPREADSHEET_ID');
  if (!spreadsheetId) {
    const err = new Error('Sheets not configured');
    err.status = 503;
    err.code = 'SHEETS_NOT_CONFIGURED';
    err.missing = ['GOOGLE_SHEETS_SPREADSHEET_ID'];
    throw err;
  }

  const api = sheetsApi();
  const candidates = sheetCandidates(baseName, city);
  let lastErr = null;

  for (const name of candidates) {
    const key = `${spreadsheetId}:${name}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    if (inflight.has(key)) return inflight.get(key);
    const stale = cacheGetStale(key);
    const promise = (async () => {
      try {
        const range = `${name}!A:AZ`;
        const resp = await withRetry(() => api.spreadsheets.values.get({ spreadsheetId, range }));
        const values = resp.data.values || [];
        const headers = (values[0] || []).map((x) => String(x));
        const rows = values.slice(1);
        const out = { sheet: name, headers, rows };
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

  throw lastErr || new Error(`Unable to read sheet ${baseName}`);
}

export async function getProducts(city) {
  const { sheet, headers, rows } = await readSheetTable('products', city);
  const skuIdx = headerIndexAny(headers, ['sku', 'product_id', 'id']);
  const nameIdx = headerIndexAny(headers, ['name', 'title']);
  const categoryIdx = headerIndexAny(headers, ['category', 'категория']);
  const brandIdx = headerIndexAny(headers, ['brand', 'бренд', 'марка']);
  const priceIdx = headerIndexAny(headers, ['price']);
  const stockIdx = headerIndexAny(headers, ['stock', 'qty', 'qty_available']);
  const activeIdx = headerIndexAny(headers, ['active', 'is_active']);
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

export async function updateProductStock(product, newStock, newActive) {
  const spreadsheetId = getEnv('GOOGLE_SHEETS_SPREADSHEET_ID');
  const api = sheetsApi();
  const headers = product._headers;
  const stockIdx = headerIndexAny(headers, ['stock', 'qty', 'qty_available']);
  const activeIdx = headerIndexAny(headers, ['active', 'is_active']);
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
        { range: `${product._sheet}!${stockCol}${row}`, values: [[String(newStock)]] },
        { range: `${product._sheet}!${activeCol}${row}`, values: [[newActive ? 'TRUE' : 'FALSE']] },
      ],
    },
  });

  cache.delete(`${spreadsheetId}:${String(product._sheet || '')}`);
}

export async function appendOrderRow(city, orderRow) {
  const spreadsheetId = getEnv('GOOGLE_SHEETS_SPREADSHEET_ID');
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
    range: `${sheet}!A:AZ`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });

  cache.delete(`${spreadsheetId}:${String(sheet || '')}`);
}

export async function appendCourierRow(city, courierRow) {
  const spreadsheetId = getEnv('GOOGLE_SHEETS_SPREADSHEET_ID');
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
    range: `${sheet}!A:AZ`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });

  cache.delete(`${spreadsheetId}:${String(sheet || '')}`);
}

export async function updateOrderRowByOrderId(city, orderId, patch) {
  const spreadsheetId = getEnv('GOOGLE_SHEETS_SPREADSHEET_ID');
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
    updates.push({ range: `${sheet}!${col}${targetRowIndex}`, values: [[v == null ? '' : String(v)]] });
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
  const spreadsheetId = getEnv('GOOGLE_SHEETS_SPREADSHEET_ID');
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
  for (const [k, v] of Object.entries(patch)) {
    const colIdx = headerIndex(headers, k);
    if (colIdx < 0) continue;
    const col = colLetter(colIdx);
    updates.push({ range: `${sheet}!${col}${targetRowIndex}`, values: [[v == null ? '' : String(v)]] });
  }
  if (updates.length === 0) return true;

  await api.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data: updates },
  });

  cache.delete(`${spreadsheetId}:${String(sheet || '')}`);
  return true;
}
