import cron from "node-cron";
import { getDb, initDb } from "../db/sqlite";
import { expireOrder } from "../../domain/orders/OrderService";
import { computeDailyMetrics, writeDailyMetricsRow } from "../../domain/metrics/MetricsService";
import { formatDate } from "../../core/time";
import { logger } from "../logger";
import { getBot } from "../../bot/Bot";
import { updateUser } from "../data";
import { getBackend, getDefaultCity } from "../backend";
import { purgeNotIssuedOlderThan } from "../../domain/orders/OrderService";
import { NOT_ISSUED_DELETE_AFTER_MINUTES } from "../../core/constants";
import { shopConfig } from "../../config/shopConfig";
import { ReportService } from "../../services/ReportService";
import { batchGet } from "../sheets/SheetsClient";
import { getProducts } from "../data";
import { getProductsMap, normalizeProductId, formatProductName } from "../../utils/products";

export async function generateDailySummaryText(dateOverride?: string): Promise<string> {
  let db = getDb();
  if (!db) { try { await initDb(); db = getDb(); } catch {} }
  const tz = process.env.TIMEZONE || "Europe/Berlin";
  const today = (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride))
    ? dateOverride
    : new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(new Date());
  const start = Date.parse(`${today}T00:00:00.000Z`);
  const end = start + 86400000;
  const sheetCity = shopConfig.cityCode;
  const sheetName = (process.env.GOOGLE_SHEETS_MODE === "TABS_PER_CITY") ? `orders_${sheetCity}` : "orders";
  let valuesOrders: string[][] = [];
  let headersOrders: string[] = [];
  let rowsOrders: string[][] = [];
  try {
    const vrOrders = await batchGet([`${sheetName}!A:Z`]);
    valuesOrders = vrOrders[0]?.values || [];
    headersOrders = valuesOrders[0] || [];
    rowsOrders = valuesOrders.slice(1);
  } catch (e) {
    console.log("⚠️ Sheets недоступен, перехожу на SQLite fallback:", String(e));
    headersOrders = [];
    rowsOrders = [];
  }
  const idxO = (n: string) => headersOrders.indexOf(n);
  const idxOCI = (...names: string[]) => {
    const lowered = names.map((n) => n.toLowerCase());
    for (let i = 0; i < headersOrders.length; i++) {
      const h = String(headersOrders[i] || "").toLowerCase();
      if (lowered.includes(h)) return i;
    }
    return -1;
  };
  console.log("📋 HEADERS:", headersOrders);
  const idIdxO = idxOCI("order_id","order id","orderid","id");
  const statusIdxO = idxOCI("status");
  const deliveredAtIdxO = idxOCI("delivered_at","delivered timestamp");
  const deliveryDateIdxO = idxOCI("delivery_date","delivery date");
  const totalIdxO = idxOCI("total_amount","total");
  const itemsIdxO = (() => {
    let i = idxOCI("items_json","items (json)","items");
    if (i >= 0) return i;
    for (let j = 0; j < headersOrders.length; j++) {
      const h = String(headersOrders[j] || "").toLowerCase();
      if (h.includes("items")) return j;
    }
    return -1;
  })();
  const paymentIdxO = idxOCI("payment_method","payment");
  const userIdIdxO = idxOCI("user_id","user id","userid","user_tg_id","tg_id","telegram_id","chat_id");
  const usernameIdxO = idxOCI("username","user_name");
  console.log(`📋 Индекс колонки items: ${itemsIdxO}`);
  let deliveredSheetRows: string[][] = [];
  if (rowsOrders.length) {
    deliveredSheetRows = rowsOrders.filter(r => {
      const st = String(statusIdxO>=0 ? r[statusIdxO]||"" : "").toLowerCase();
      const dd = String(deliveryDateIdxO>=0 ? r[deliveryDateIdxO]||"" : "");
      return st==="delivered" && dd===today;
    });
  } else {
    console.log("⚠️ Нет данных из Sheets, используем SQLite delivered fallback");
    const fallback = db.prepare(`
      SELECT order_id, total_with_discount AS total, items_json, payment_method, delivered_timestamp
      FROM orders
      WHERE status='delivered' AND SUBSTR(delivered_timestamp,1,10)=?
    `).all(today) as any[];
    deliveredSheetRows = fallback.map(r => [
      String(r.order_id),
      "", // user_id
      "delivered",
      String(r.total || 0),
      "", // courier_id
      "", // delivery_date
      "", // delivery_time
      String(r.payment_method || ""),
      String(r.delivered_timestamp || ""),
      String(r.items_json || "[]")
    ]);
    headersOrders = ["order_id","user_id","status","total_amount","courier_id","delivery_date","delivery_time","payment_method","delivered_at","items (JSON)"];
    // override indexes for fallback layout
  }
  let ordersCount = deliveredSheetRows.length;
  let revenueSum = 0;
  let cashSum = 0, cardSum = 0;
  for (const r of deliveredSheetRows) {
    const total = Number(totalIdxO>=0 ? r[totalIdxO]||0 : 0);
    revenueSum += total;
    const pm = String(paymentIdxO>=0 ? r[paymentIdxO]||"" : "").toLowerCase();
    if (pm === "card") cardSum += total; else cashSum += total;
  }
  let upsellOffered = 0,
    upsellAccepted = 0,
    upsellRerolls = 0,
    upsellRevenue = 0;
  try {
    const offeredRows = db
      .prepare(
        "SELECT COUNT(1) AS c FROM upsell_events WHERE event_type='offered' AND timestamp >= ? AND timestamp < ?"
      )
      .get(start, end) as any;
    const acceptedRows = db
      .prepare(
        "SELECT COUNT(1) AS c FROM upsell_events WHERE event_type='accepted' AND timestamp >= ? AND timestamp < ?"
      )
      .get(start, end) as any;
    const rerollRows = db
      .prepare(
        "SELECT COUNT(1) AS c FROM upsell_events WHERE event_type='reroll' AND timestamp >= ? AND timestamp < ?"
      )
      .get(start, end) as any;
    upsellOffered = Number(offeredRows?.c || 0);
    upsellAccepted = Number(acceptedRows?.c || 0);
    upsellRerolls = Number(rerollRows?.c || 0);
    const rows = db
      .prepare(
        "SELECT items_json FROM orders WHERE status='delivered' AND ((delivered_at_ms >= ? AND delivered_at_ms < ?) OR (delivered_at_ms IS NULL AND substr(delivered_timestamp,1,10)=?))"
      )
      .all(start, end, today) as any[];
    for (const r of rows) {
      const items = JSON.parse(String(r.items_json || "[]"));
      for (const i of items) if (i.is_upsell) upsellRevenue += Number(i.price) * Number(i.qty || 1);
    }
  } catch {}
  const effectiveOffers = Math.max(upsellOffered - upsellRerolls, 1);
  const conv = Math.round((upsellAccepted / effectiveOffers) * 1000) / 10;
  console.log("═══════════════════════════════");
  console.log(`📊 Delivered из Sheets (${sheetName}) за ${today}: ${ordersCount}`);
  console.log("═══════════════════════════════");

  // Recompute items block and totals based on delivered orders
  const deliveredOrders = deliveredSheetRows.map(r => ({
    order_id: Number(idIdxO>=0 ? r[idIdxO]||0 : 0),
    user_id: Number(userIdIdxO>=0 ? r[userIdIdxO]||0 : 0),
    username: String(usernameIdxO>=0 ? r[usernameIdxO]||"" : ""),
    items_json: String(itemsIdxO>=0 ? r[itemsIdxO]||"[]" : "[]"),
    total_with_discount: Number(totalIdxO>=0 ? r[totalIdxO]||0 : 0)
  }));
  const allProdMap = await getProductsMap(sheetCity);
  const idProdMap = new Map<string, { title: string; brand?: string | null }>();
  try {
    const tabs = [`products_${sheetCity}`, `Products_${sheetCity}`, "products", "Products"];
    let valuesP: string[][] = [];
    let headersP: string[] = [];
    for (const t of tabs) {
      const vrp = await batchGet([`${t}!A:Z`]);
      valuesP = vrp[0]?.values || [];
      headersP = valuesP[0] || [];
      if (valuesP.length) break;
    }
    const rowsP = valuesP.slice(1);
    const idxAny = (...names: string[]) => {
      const lowered = names.map((n) => n.toLowerCase());
      for (let i = 0; i < headersP.length; i++) {
        const h = String(headersP[i] || "").toLowerCase();
        if (lowered.includes(h)) return i;
      }
      return -1;
    };
    const idIdx = idxAny("id","product_id");
    const skuIdx = idxAny("sku");
    const nameIdx = idxAny("name","title");
    const brandIdx = idxAny("brand","vendor","producer","марка");
    const djb2 = (s: string) => {
      let h = 5381;
      for (let k = 0; k < s.length; k++) h = ((h << 5) + h) + s.charCodeAt(k);
      return Math.abs(h >>> 0);
    };
    for (const r of rowsP) {
      const nm = String(nameIdx>=0 ? r[nameIdx]||"" : "");
      if (!nm) continue;
      const br = brandIdx>=0 ? (r[brandIdx]||null) : null;
      const idRaw = idIdx>=0 ? r[idIdx] : "";
      const pidNum = Number(String(idRaw).match(/\d+/)?.[0] || "");
      const sku = String(skuIdx>=0 ? r[skuIdx]||"" : "");
      const skuHash = sku ? djb2(sku) : NaN;
      if (Number.isFinite(pidNum)) {
        idProdMap.set(String(pidNum), { title: nm, brand: br });
      }
      if (Number.isFinite(skuHash)) {
        idProdMap.set(String(skuHash), { title: nm, brand: br });
      }
    }
  } catch {}
  try {
    console.log(`📦 Товаров загружено: ${allProdMap.size}`);
    let shown = 0;
    for (const [key, product] of allProdMap.entries()) {
      if (shown < 5) {
        console.log(`  Ключ: ${String(key)} (${typeof key}) → ${formatProductName(product as any)}`);
        shown++;
      } else {
        break;
      }
    }
    const testIds = [3204076806, 2655319381, 3204076800];
    for (const tid of testIds) {
      const foundNum = allProdMap.get(tid as any);
      const foundStr = allProdMap.get(String(tid));
      console.log(`🔍 ID ${tid}: get(${tid})=${!!foundNum} get("${tid}")=${!!foundStr}`);
    }
  } catch {}
  const stats: Map<string, number> = new Map();
  let itemsTotal = 0;
  console.log("\n═══ ПАРСИНГ ТОВАРОВ ═══");
  for (const r of deliveredOrders) {
    try {
      let items: any[] = [];
      try {
        const parsed = JSON.parse(String(r.items_json || "[]"));
        if (Array.isArray(parsed)) items = parsed;
      } catch {}
      console.log(`\n📦 Заказ #${r.order_id}:`);
      console.log(`  items_json длина: ${String(r.items_json||"").length} символов`);
      console.log(`  items_json: ${String(r.items_json||"").substring(0,100)}...`);
      console.log(`  ✅ Парсинг OK`);
      console.log(`  Тип: ${Array.isArray(items) ? "массив" : typeof items}`);
      console.log(`  Товаров в массиве: ${items.length}`);
      if (!Array.isArray(items)) {
        console.log(`  ❌ Не массив - пропускаю`);
        continue;
      }
      for (const it of items) {
        const pid = normalizeProductId(it.product_id ?? it.id);
        const keysToTry = [pid, String(pid), String(Number(pid)), String(String(pid)).toLowerCase()];
        let prod: any = null;
        for (const k of keysToTry) {
          const cand = allProdMap.get(k);
          if (cand) { prod = cand; break; }
        }
        console.log(`      В карте (${allProdMap.size} товаров): ${!!prod}`);
        let name: string;
        if (prod) {
          name = formatProductName(prod as any);
        } else {
          let byId = null as { title: string; brand?: string | null } | null;
          for (const k of keysToTry) {
            const cand2 = idProdMap.get(String(k));
            if (cand2) { byId = cand2; break; }
          }
          if (byId) {
            const brandPart = byId.brand ? `${String(byId.brand).toUpperCase()} · ` : "";
            name = `${brandPart}${byId.title}`;
          } else if (it.name) {
          const brandPart = it.brand ? `${String(it.brand).toUpperCase()} · ` : "";
          name = `${brandPart}${String(it.name)}`;
          } else {
            name = `#${pid}`;
          }
        }
        const qty = Number(it.qty ?? it.quantity ?? 0);
        console.log(`\n    Товар:`);
        console.log(`      raw item:`, it);
        console.log(`      normalized_id: ${pid}`);
        console.log(`      В карте (${allProdMap.size} товаров): ${!!prod}`);
        console.log(`      Название: ${name}`);
        console.log(`      Количество: ${qty}`);
        stats.set(name, (stats.get(name) || 0) + qty);
        itemsTotal += qty;
        if (stats.has(name)) {
          const cur = stats.get(name)!;
          console.log(`      Добавлено к существующему: ${cur}`);
        } else {
          console.log(`      Создана новая запись`);
        }
      }
    } catch {}
  }
  console.log('\n═══════════════════════════════');
  console.log(`📊 ИТОГО товаров в статистике: ${stats.size}`);
  if (stats.size > 0) {
    console.log('📋 Список:');
    for (const [name, count] of stats.entries()) {
      console.log(`  ${name}: ${count} шт`);
    }
  } else {
    console.log('⚠️ НЕТ ТОВАРОВ!');
  }
  console.log('═══════════════════════════════\n');
  const salesByProduct: Map<string, { brand: string; productName: string; totalQty: number; totalPrice: number; orders: { order_id: number; username: string | null; user_id: number; qty: number; price: number }[] }> = new Map();
  for (const r of deliveredOrders) {
    let items: any[] = [];
    try {
      const parsed = JSON.parse(String(r.items_json || "[]"));
      if (Array.isArray(parsed)) items = parsed;
    } catch {}
    for (const it of items) {
      const pid = normalizeProductId(it.product_id ?? it.id);
      const keysToTry = [pid, String(pid), String(Number(pid)), String(String(pid)).toLowerCase()];
      let prod: any = null;
      for (const k of keysToTry) {
        const cand = allProdMap.get(k);
        if (cand) { prod = cand; break; }
      }
      if (!prod) {
        let byId = null as { title: string; brand?: string | null } | null;
        for (const k of keysToTry) {
          const cand2 = idProdMap.get(String(k));
          if (cand2) { byId = cand2; break; }
        }
        if (byId) prod = { title: byId.title, brand: byId.brand || null };
      }
      const brand = prod?.brand ? String(prod.brand).toUpperCase() : (it.brand ? String(it.brand).toUpperCase() : "");
      const productName = prod?.title ? String(prod.title) : (it.name ? String(it.name) : `#${pid}`);
      const key = `${brand}::${productName}`;
      if (!salesByProduct.has(key)) salesByProduct.set(key, { brand, productName, totalQty: 0, totalPrice: 0, orders: [] });
      const sale = salesByProduct.get(key)!;
      const qty = Number(it.qty ?? it.quantity ?? 0);
      const priceTotal = Number(it.price || 0) * qty;
      sale.totalQty += qty;
      sale.totalPrice += priceTotal;
      sale.orders.push({ order_id: r.order_id, username: r.username || null, user_id: r.user_id || 0, qty, price: priceTotal });
    }
  }
  const sortedSales = Array.from(salesByProduct.values()).sort((a, b) => b.totalPrice - a.totalPrice);
  let itemsBlock = "";
  for (const sale of sortedSales) {
    itemsBlock += `• ${sale.brand ? `${sale.brand} · ` : ""}${sale.productName}: ${sale.totalQty} шт (${sale.totalPrice.toFixed(2)}€)\n`;
    const orders = sale.orders.slice().sort((a, b) => b.order_id - a.order_id);
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const isLast = i === orders.length - 1;
      const prefix = isLast ? "  └─" : "  ├─";
      const userDisplay = o.username ? `@${o.username}` : `user_${o.user_id}`;
      itemsBlock += `${prefix} #${o.order_id} ${userDisplay} (${o.price.toFixed(2)}€)\n`;
    }
    itemsBlock += "\n";
  }
  if (!itemsBlock.trim()) itemsBlock = "(нет данных)";
  const summary = [
    `📊 Отчёт за сегодня (${today})`,
    ``,
    `🏪 Магазин: ${shopConfig.shopName}`,
    `🏙 Город: ${shopConfig.cityCode}`,
    `📦 Заказов: ${ordersCount}`,
    `💰 Выручка: ${revenueSum.toFixed(2)}€`,
    `💵 Комиссия (5%): ${(revenueSum * 0.05).toFixed(2)}€`,
    `💎 Чистая прибыль: ${(revenueSum * 0.95).toFixed(2)}€`,
    ``,
    `💳 Способы оплаты:`,
    `Cash: ${cashSum.toFixed(2)}€`,
    `Card: ${cardSum.toFixed(2)}€`,
    ``,
    `🎲 Upsell (геймификация):`,
    `Предложено: ${upsellOffered}`,
    `Рероллов: ${upsellRerolls}`,
    `Принято: ${upsellAccepted}`,
    `Конверсия: ${conv}%`,
    `Доп. выручка: ${upsellRevenue.toFixed(2)}€`,
    ``,
    `📦 Продано товаров:`,
    `${itemsBlock}`,
  ].join("\n");
  return summary;
}

export async function sendDailySummary() {
  try {
    const bot = getBot();
    const summary = await generateDailySummaryText();
    const adminIds = (process.env.TELEGRAM_ADMIN_IDS || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((x) => x);
    for (const id of adminIds) {
      try {
        await bot.sendMessage(id, summary);
      } catch {}
    }
    try {
      const city = shopConfig.cityCode;
      const sheet = (process.env.GOOGLE_SHEETS_MODE === "TABS_PER_CITY") ? `orders_${city}` : "orders";
      const vr = await batchGet([`${sheet}!A:Z`]);
      const values = vr[0]?.values || [];
      const headers = values[0] || [];
      const rows = values.slice(1);
      const idx = (name: string) => headers.indexOf(name);
      const deliveredAtIdx = (idx("delivered_at") >= 0 ? idx("delivered_at") : idx("delivered_timestamp"));
      const statusIdx = idx("status");
      const itemsIdx = idx("items_json");
      const today = new Date().toISOString().slice(0,10);
      const deliveredRows = rows.filter(r => {
        const d = String(deliveredAtIdx>=0 ? r[deliveredAtIdx]||"" : "").slice(0,10);
        const st = String(statusIdx>=0 ? r[statusIdx]||"" : "").toLowerCase();
        return d===today && st==="delivered";
      });
      const cityCodes = (process.env.CITY_CODES || shopConfig.cityCode || "FFM").split(",").map(s=>s.trim()).filter(Boolean);
      const prodGlobal = new Map<string, any>();
      for (const code of cityCodes) {
        try {
          const m = await getProductsMap(code);
          for (const [k, v] of m.entries()) if (!prodGlobal.has(k)) prodGlobal.set(k, v);
        } catch {}
      }
      const map: Record<string, { qty: number; sum: number; title: string; brand: string }> = {};
      for (const r of deliveredRows) {
        const itemsJson = String(itemsIdx>=0 ? r[itemsIdx]||"[]" : "[]");
        try {
          const items = JSON.parse(itemsJson) as Array<{ product_id: number; qty: number; price: number }>;
          for (const it of items) {
            const key = normalizeProductId(it.product_id);
            const p = prodGlobal.get(key);
            const title = p ? formatProductName(p) : `#${key}`;
            const cur = map[key] || { qty: 0, sum: 0, title, brand: p?.brand || "" };
            cur.qty += Number(it.qty||0);
            cur.sum += Number(it.price||0) * Number(it.qty||0);
            map[key] = cur;
          }
        } catch {}
      }
      const sorted = Object.entries(map).sort((a,b)=>b[1].qty - a[1].qty);
      const lines: string[] = [];
      lines.push("📦 Продажи (доставленные)");
      lines.push("");
      for (const [, v] of sorted.slice(0, 20)) {
        const brandPart = v.brand ? `${v.brand} · ` : "";
        lines.push(`• ${brandPart}${v.title} — ${v.qty} шт · ${(v.sum).toFixed(2)}€`);
      }
      if (sorted.length) {
        const top = sorted[0][1];
        const brandPart = top.brand ? `${top.brand} · ` : "";
        lines.push("");
        lines.push(`🔥 Топ вкус: ${brandPart}${top.title} — ${top.qty} шт`);
      }
      const detail = lines.join("\n");
      for (const id of adminIds) {
        try { await bot.sendMessage(id, detail); } catch {}
      }
    } catch (e) {
      logger.warn("Daily detail summary error", { error: String(e) });
    }
  } catch (e) {
    logger.error("Admin daily report error", { error: String(e) });
  }
}

export async function registerCron() {
  const timezone = "Europe/Berlin";
  cron.schedule("*/1 * * * *", async () => {
    const db = getDb();
    const nowIso = new Date().toISOString();
    const rows = db.prepare("SELECT order_id FROM orders WHERE status='buffer' AND expiry_timestamp < ?").all(nowIso) as any[];
    for (const r of rows) await expireOrder(Number(r.order_id));
  }, { timezone });

  cron.schedule("0 10 * * *", async () => {
    const db = getDb();
    const users = db.prepare("SELECT user_id FROM users WHERE next_reminder_date = ?").all(formatDate(new Date())) as any[];
    const bot = getBot();
    for (const u of users) {
      try {
        db.prepare("UPDATE users SET segment = ? WHERE user_id = ?").run("sale10", Number(u.user_id));
        try { await updateUser(Number(u.user_id), { segment: "sale10" } as any); } catch {}
        await bot.sendMessage(Number(u.user_id), "🔔 Напоминание: время повторить заказ! Скидка 10% на все жидкости по ссылке ниже. Нажмите, чтобы начать.");
      } catch {}
    }
  }, { timezone });

  cron.schedule("5 10 * * *", async () => {
    const db = getDb();
    const bot = getBot();
    const target = formatDate(new Date(Date.now() - 3 * 86400000));
    const rows = db.prepare("SELECT user_id FROM users WHERE last_purchase_date IS NULL AND first_seen = ?").all(target) as any[];
    for (const r of rows) {
      try { await bot.sendMessage(Number(r.user_id), "👋 Возвращайтесь — посмотрите каталог и соберите заказ. Жидкости ELFIC/CHASER и электроника. Нажмите /start или кнопку ниже."); } catch {}
    }
  }, { timezone });

  cron.schedule("0 22 * * *", async () => {
    await sendDailySummary();
  }, { timezone });

  cron.schedule("30 23 * * *", async () => {
    try {
      const bot = getBot();
      const db = getDb();
      const todayLocal = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(new Date());
      console.log(`📊 Checking unconfirmed orders for ${todayLocal}`);
      const rows = db.prepare(`
        SELECT o.order_id, o.courier_id, o.delivery_date, o.status, o.total_with_discount, u.username AS courier_username
        FROM orders o
        LEFT JOIN users u ON o.courier_id = u.user_id
        WHERE o.delivery_date = ? AND o.status NOT IN ('delivered','cancelled')
        ORDER BY o.courier_id, o.order_id
      `).all(todayLocal) as any[];
      const adminIds = (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map(s=>Number(s.trim())).filter(x=>x);
      if (!rows.length) {
        for (const id of adminIds) { try { await bot.sendMessage(id, `✅ Все заказы подтверждены\n\nДата: ${todayLocal}`); } catch {} }
      } else {
        const byCourier = new Map<number|string, any[]>();
        for (const r of rows) {
          const key = r.courier_id || "unassigned";
          if (!byCourier.has(key)) byCourier.set(key, []);
          byCourier.get(key)!.push(r);
        }
        let message = `⚠️ НЕПОДТВЕРЖДЁННЫЕ ЗАКАЗЫ\n\nДата: ${todayLocal}\nВсего: ${rows.length} заказов\n`;
        byCourier.forEach((orders, courierId) => {
          const courierName = orders[0]?.courier_username || `ID: ${courierId}`;
          message += `\n📍 Курьер: ${courierName}\n   Не отметил: ${orders.length} заказов\n`;
          for (const o of orders) message += `   • #${o.order_id} (${Number(o.total_with_discount||0).toFixed(2)}€) - ${o.status}\n`;
        });
        message += `\n⏰ В 00:01 просроченные заказы будут автоматически отменены.`;
        for (const id of adminIds) { try { await bot.sendMessage(id, message); } catch {} }
      }
    } catch (e) { console.log("❌ Unconfirmed report error:", String(e)); }
  }, { timezone });

  cron.schedule("1 0 * * *", async () => {
    try {
      const db = getDb();
      const bot = getBot();
      const yesterdayLocal = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(new Date(Date.now() - 86400000));
      console.log(`🔍 Auto-cancelling overdue orders (${yesterdayLocal})`);
      const overdue = db.prepare(`
        SELECT order_id, courier_id, delivery_date, total_with_discount
        FROM orders
        WHERE delivery_date < ? AND status NOT IN ('delivered','cancelled')
      `).all(yesterdayLocal) as any[];
      if (!overdue.length) { console.log("✅ No overdue orders"); return; }
      console.log(`⚠️ Auto-cancelling ${overdue.length} orders`);
      const tx = db.transaction(() => {
        for (const o of overdue) {
          db.prepare(`UPDATE orders SET status='cancelled', updated_at=? WHERE order_id=?`).run(new Date().toISOString(), Number(o.order_id));
        }
      });
      tx();
      const adminIds = (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map(s=>Number(s.trim())).filter(x=>x);
      for (const id of adminIds) {
        try { await bot.sendMessage(id, `❌ АВТООТМЕНА ПРОСРОЧЕННЫХ\n\nОтменено: ${overdue.length} заказов\nДата: до ${yesterdayLocal}`); } catch {}
      }
      console.log("✅ Auto-cancel complete");
    } catch (e) { console.log("❌ Auto-cancel error:", String(e)); }
  }, { timezone });

  cron.schedule("0 0 * * *", async () => {
    try {
      const date = formatDate(new Date());
      const row = await computeDailyMetrics(date);
      await writeDailyMetricsRow(row);
      const backend = getBackend();
      for (const city of (process.env.CITY_CODES || "FFM").split(",")) {
        await backend.upsertDailyMetrics(date, city.trim(), row);
      }
      logger.info("Metrics written", { date });
    } catch (e) {
      logger.error("Metrics error", { error: String(e) });
    }
  }, { timezone });

  cron.schedule("0 0 * * *", async () => {
    const db = getDb();
    try {
      db.prepare("UPDATE orders SET delivery_exact_time = NULL WHERE status <> 'delivered'").run();
      logger.info("Daily slot cleanup done");
    } catch (e) {
      logger.error("Daily slot cleanup error", { error: String(e) });
    }
  }, { timezone });

  cron.schedule("*/5 * * * *", async () => {
    try {
      const db = getDb();
      const rows = db.prepare("SELECT order_id FROM orders WHERE status='delivered' AND sheets_committed=0").all() as any[];
      const backend = getBackend();
      logger.info("Repair job", { pending: rows.length });
      for (const r of rows) {
        try {
          await backend.commitDelivery(Number(r.order_id));
          db.prepare("UPDATE orders SET sheets_committed=1 WHERE order_id = ?").run(Number(r.order_id));
        } catch (e) {
          logger.warn("Repair commit failed", { order_id: r.order_id, error: String(e) });
        }
      }
    } catch (e) {
      logger.error("Repair job error", { error: String(e) });
    }
  }, { timezone });

  cron.schedule("*/10 * * * *", async () => {
    try {
      const n = await purgeNotIssuedOlderThan(NOT_ISSUED_DELETE_AFTER_MINUTES);
      if (n > 0) logger.info("Purged not_issued orders", { count: n });
    } catch (e) {
      logger.error("Purge not_issued error", { error: String(e) });
    }
  }, { timezone });

  cron.schedule("0 * * * *", async () => {
    try {
      const db = getDb();
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const rows = db.prepare("SELECT order_id FROM orders WHERE status='pending' AND reserve_timestamp < ?").all(cutoff) as any[];
      const sheet = (process.env.GOOGLE_SHEETS_MODE === "TABS_PER_CITY") ? `orders_${shopConfig.cityCode}` : "orders";
      const { batchGet } = await import("../sheets/SheetsClient");
      const { google } = await import("googleapis");
      const api = google.sheets({ version: "v4" });
      const values = (await batchGet([`${sheet}!A:Z`]))[0]?.values || [];
      const headers = values[0] || [];
      const idx = (n: string) => headers.indexOf(n);
      const idIdx = idx("order_id"), statusIdx = idx("status"), cancelledAtIdx = idx("cancelled_at"), cancelledReasonIdx = idx("cancelled_reason");
      const updated: number[] = [];
      const tx = db.transaction(() => {
        for (const r of rows) {
          db.prepare("UPDATE orders SET status='cancelled' WHERE order_id=?").run(Number(r.order_id));
          updated.push(Number(r.order_id));
        }
      });
      tx();
      if (updated.length && idIdx >= 0) {
        for (let i = 1; i < values.length; i++) {
          const oid = Number(values[i][idIdx]);
          if (updated.includes(oid)) {
            const row = [...values[i]];
            if (statusIdx >= 0) row[statusIdx] = "cancelled";
            if (cancelledAtIdx >= 0) row[cancelledAtIdx] = new Date().toISOString();
            if (cancelledReasonIdx >= 0) row[cancelledReasonIdx] = "auto_expired";
            await api.spreadsheets.values.update({
              spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
              range: `${sheet}!A${i + 1}:Z${i + 1}`,
              valueInputOption: "RAW",
              requestBody: { values: [row] }
            });
          }
        }
      }
      if (updated.length) logger.info("Auto-cancelled expired pending orders", { count: updated.length });
    } catch (e) {
      logger.error("Auto-cancel expired error", { error: String(e) });
    }
  }, { timezone });

  cron.schedule("*/15 * * * *", async () => {
    try {
      const db = getDb();
      const backend = getBackend();
      const today = new Date().toISOString().slice(0,10);
      const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0,10);
      const rows = db.prepare("SELECT order_id, items_json FROM orders WHERE status IN ('pending','confirmed','courier_assigned') AND delivery_date >= ? AND delivery_date <= ?").all(today, dayAfter) as any[];
      for (const r of rows) {
        try {
          await backend.updateOrderDetails?.(Number(r.order_id), { items: String(r.items_json || "[]") } as any);
        } catch (e) {
          logger.warn("Update items to Sheets failed", { order_id: r.order_id, error: String(e) });
        }
      }
      logger.info("Synced items to Sheets for upcoming orders", { count: rows.length });
    } catch (e) {
      logger.error("Items sync to Sheets error", { error: String(e) });
    }
  }, { timezone });
  cron.schedule("*/2 * * * *", async () => {
    try {
      const db = getDb();
      const rows = db.prepare("SELECT id, order_id, updates_json, city_code, attempts FROM sheets_repair_queue ORDER BY id ASC LIMIT 20").all() as any[];
      if (!rows.length) return;
      const { getBot } = await import("../../bot/Bot");
      for (const r of rows) {
        try {
          const updates = JSON.parse(String(r.updates_json || "{}"));
          const ok = await (await import("../../bot/flows/courierFlow")).updateOrderInSheets(Number(r.order_id), updates, String(r.city_code));
          if (ok) {
            db.prepare("DELETE FROM sheets_repair_queue WHERE id = ?").run(Number(r.id));
          } else {
            db.prepare("UPDATE sheets_repair_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?").run("retry_failed", Number(r.id));
          }
        } catch (e) {
          db.prepare("UPDATE sheets_repair_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?").run(String(e), Number(r.id));
        }
      }
      logger.info("Sheets repair queue processed", { count: rows.length });
    } catch (e) {
      logger.error("Sheets repair queue error", { error: String(e) });
    }
  }, { timezone });
}
