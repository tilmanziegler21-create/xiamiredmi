import TelegramBot from "node-telegram-bot-api";
import { decodeCb } from "../cb";
import { env } from "../../infra/config";
import { shopConfig } from "../../config/shopConfig";
import { getProducts, getCouriers, updateProductPrice, updateCourier, updateUser } from "../../infra/data";
import { batchGet } from "../../infra/sheets/SheetsClient";
import { generateDailyReportCSV, generateCouriersCSV, generateOrdersCSV } from "../../domain/metrics/CSVExport";
import fs from "fs";
import { getDb } from "../../infra/db/sqlite";
import { ReportService } from "../../services/ReportService";
import { getDefaultCity } from "../../infra/backend";
import { sendDailySummary, generateDailySummaryText } from "../../infra/cron/scheduler";
import { addDaysInTimezone, dateInTimezone } from "../../core/time";

function isAdmin(id: number) {
  const list = (env.TELEGRAM_ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter((x) => x);
  return list.includes(id);
}

export function registerAdminFlow(bot: TelegramBot) {
  const priceEditAwait: Map<number, number> = new Map();
  bot.onText(/\/admin/, async (msg) => {
    if (!isAdmin(msg.from?.id || 0)) return;
      const keyboard = [
        [{ text: "Список заказов", callback_data: "admin_orders" }],
        [{ text: "Курьеры", callback_data: "admin_couriers" }],
        [{ text: "Назначить курьеров (до 3)", callback_data: "admin_assign_couriers" }],
        [{ text: "Отчёт за день", callback_data: "admin_report_today" }],
        [{ text: "🛍️ Проданные товары", callback_data: "admin_sold_products" }],
        [{ text: "Upsell статистика", callback_data: "admin_upsell_stats" }],
        [{ text: "Миграция items", callback_data: "admin_migrate_items" }],
        [{ text: "Скачать заказы (CSV)", callback_data: "admin_export_orders" }],
        [{ text: "Статус Sheets", callback_data: "admin_sheets_status" }],
        [{ text: "Запустить repair", callback_data: "admin_repair_now" }],
        [{ text: "Сброс данных", callback_data: "admin_reset_all" }],
        [{ text: "Акция 15 мин (скидка)", callback_data: "admin_promo15" }],
        [{ text: "Демо: сгенерировать продажи", callback_data: "admin_demo" }]
      ];
    await bot.sendMessage(msg.chat.id, "Админ-панель", { reply_markup: { inline_keyboard: keyboard }, parse_mode: "HTML" });
  });

  bot.onText(/\/test_summary/, async (ctx) => {
    const adminIds = process.env.TELEGRAM_ADMIN_IDS?.split(',') || [];
    if (!adminIds.includes(ctx.from?.id.toString() || '')) {
      return;
    }
    try {
      await bot.sendMessage(ctx.chat.id, '⏳ Генерирую тестовую сводку...');
      const text = await generateDailySummaryText();
      await bot.sendMessage(ctx.chat.id, text);
      await bot.sendMessage(ctx.chat.id, '✅ Сводка отправлена');
    } catch (error: any) {
      console.error('[TEST SUMMARY ERROR]:', error);
      await bot.sendMessage(ctx.chat.id, `❌ Ошибка: ${error.message}`);
    }
  });
  bot.onText(/\/test_report\s+(\d{4}-\d{2}-\d{2})/, async (msg, match) => {
    const adminIds = process.env.TELEGRAM_ADMIN_IDS?.split(',') || [];
    if (!adminIds.includes(msg.from?.id.toString() || '')) return;
    const date = match?.[1] || dateInTimezone(env.TIMEZONE);
    try {
      await bot.sendMessage(msg.chat.id, `⏳ Генерирую отчёт за ${date}...`);
      const text = await generateDailySummaryText(date);
      await bot.sendMessage(msg.chat.id, text);
    } catch (e: any) {
      await bot.sendMessage(msg.chat.id, `❌ Ошибка: ${e.message || e}`);
    }
  });
  bot.onText(/\/debug_products(?:\s+([A-Z]+))?/, async (msg, match) => {
    const adminIds = process.env.TELEGRAM_ADMIN_IDS?.split(',') || [];
    if (!adminIds.includes(msg.from?.id.toString() || '')) return;
    const city = (match?.[1] || shopConfig.cityCode || "FFM").trim();
    const sheet = `products_${city}`;
    try {
      await bot.sendMessage(msg.chat.id, `🔍 Читаю ${sheet}...`);
      const vr = await batchGet([`${sheet}!A:Z`]);
      const values = vr[0]?.values || [];
      if (!values.length) {
        await bot.sendMessage(msg.chat.id, `⚠️ ${sheet} пустая`);
        return;
      }
      const headers = values[0] || [];
      await bot.sendMessage(msg.chat.id, `📋 Колонки: ${headers.join(" | ")}`);
      const idIdx = headers.indexOf("id")>=0?headers.indexOf("id")
        : (headers.indexOf("product_id")>=0?headers.indexOf("product_id"):-1);
      const skuIdx = headers.indexOf("sku");
      const nameIdx = headers.indexOf("name")>=0?headers.indexOf("name")
        : (headers.indexOf("title")>=0?headers.indexOf("title"):-1);
      let lines: string[] = [];
      for (let i = 1; i < Math.min(values.length, 6); i++) {
        const r = values[i] || [];
        const id = idIdx>=0 ? r[idIdx] : "";
        const sku = skuIdx>=0 ? r[skuIdx] : "";
        const nm = nameIdx>=0 ? r[nameIdx] : "";
        lines.push(`ID: ${id} → SKU: ${sku} → Name: ${nm}`);
      }
      await bot.sendMessage(msg.chat.id, lines.join("\n") || "(нет строк)");
    } catch (e: any) {
      await bot.sendMessage(msg.chat.id, `❌ Ошибка: ${e.message||e}`);
    }
  });

  bot.on("message", async (msg) => {
    if (!isAdmin(msg.from?.id || 0)) return;
    const awaiting = priceEditAwait.get(msg.from!.id);
    if (!awaiting) return;
    const text = msg.text || "";
    const price = Number(text.replace(",", "."));
    if (!isFinite(price) || price <= 0) {
      await bot.sendMessage(msg.chat.id, "Некорректная цена. Попробуйте снова.");
      return;
    }
    await updateProductPrice(awaiting, price);
    priceEditAwait.delete(msg.from!.id);
    await bot.sendMessage(msg.chat.id, `Цена обновлена: #${awaiting} → ${price.toFixed(2)}`);
  });
  bot.onText(/\/godconsole/, async (msg) => {
    const keyboard = [
      [{ text: "Список заказов", callback_data: "admin_orders" }],
      [{ text: "Курьеры", callback_data: "admin_couriers" }],
      [{ text: "Назначить курьеров (до 3)", callback_data: "admin_assign_couriers" }],
      [{ text: "Отчёт за день", callback_data: "admin_report_today" }],
      [{ text: "Скачать заказы (CSV)", callback_data: "admin_export_orders" }],
      [{ text: "Акция 15 мин (скидка)", callback_data: "admin_promo15" }],
      [{ text: "Демо: сгенерировать продажи", callback_data: "admin_demo" }]
    ];
    await bot.sendMessage(msg.chat.id, "Админ-панель", { reply_markup: { inline_keyboard: keyboard }, parse_mode: "HTML" });
  });

  bot.onText(/\/whoami/, async (msg) => {
    const id = msg.from?.id || 0;
    const adminList = (env.TELEGRAM_ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter((x) => x);
    const is = adminList.includes(id);
    await bot.sendMessage(msg.chat.id, `Ваш tg_id: ${id}\nАдмин: ${is ? "да" : "нет"}`);
  });

  bot.onText(/\/reset_all/, async (msg) => {
    if (!isAdmin(msg.from?.id || 0)) return;
    const db = getDb();
    db.exec("DELETE FROM orders; DELETE FROM reservations; DELETE FROM events;");
    try {
      const { useSheets } = await import("../../infra/config");
      if (useSheets) {
        const { clear } = await import("../../infra/sheets/SheetsClient");
        const { getDefaultCity } = await import("../../infra/backend");
        const city = getDefaultCity();
        await clear(`orders_${city}!A:Z`);
        await clear(`metrics_${city}!A:Z`);
      }
    } catch {}
    await bot.sendMessage(msg.chat.id, "Сброс выполнен: заказы, резервы и события очищены");
  });

  bot.onText(/\/sale\s+(\d+)\s+(\d+)/, async (msg, match) => {
    if (!isAdmin(msg.from?.id || 0)) return;
    const userId = Number(match?.[1] || 0);
    const percent = Number(match?.[2] || 0);
    if (!userId || !percent || percent <= 0) {
      await bot.sendMessage(msg.chat.id, "Использование: /sale <id> <percent>. Пример: /sale 8358091146 10");
      return;
    }
    const tag = `sale${percent}`;
    const db = getDb();
    db.prepare("UPDATE users SET segment = ? WHERE user_id = ?").run(tag, userId);
    try { await updateUser(userId, { segment: tag } as any); } catch {}
    await bot.sendMessage(msg.chat.id, `Скидка ${percent}% выдана пользователю ${userId}`);
  });

  bot.on("callback_query", async (q) => {
    try { await bot.answerCallbackQuery(q.id); } catch {}
    const chatId = q.message?.chat.id || 0;
    if (!isAdmin(q.from.id)) return;
    const data = q.data || "";
    const dec = decodeCb(data);
    const finalData = dec === "__expired__" ? data : dec;
    if (!finalData.startsWith("admin_")) return;
    if (finalData === "admin_open") {
      const keyboard = [
        [{ text: "Список заказов", callback_data: "admin_orders" }],
        [{ text: "Курьеры", callback_data: "admin_couriers" }],
        [{ text: "Назначить курьеров (до 3)", callback_data: "admin_assign_couriers" }],
        [{ text: "Отчёт за день", callback_data: "admin_report_today" }],
        [{ text: "🛍️ Проданные товары", callback_data: "admin_sold_products" }],
        [{ text: "Upsell статистика", callback_data: "admin_upsell_stats" }],
        [{ text: "Скачать заказы (CSV)", callback_data: "admin_export_orders" }]
      ];
      await bot.editMessageText("Админ-панель", { chat_id: chatId, message_id: q.message?.message_id!, reply_markup: { inline_keyboard: keyboard }, parse_mode: "HTML" });
      return;
    }
    if (finalData === "admin_sold_products") {
      const kb: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: "Сегодня", callback_data: "admin_sold_products_period:today" }],
        [{ text: "Вчера", callback_data: "admin_sold_products_period:yesterday" }],
        [{ text: "Последние 7 дней", callback_data: "admin_sold_products_period:days:7" }],
        [{ text: "Последние 30 дней", callback_data: "admin_sold_products_period:days:30" }],
        [{ text: "⬅️ Назад", callback_data: "admin_back" }]
      ];
      await bot.sendMessage(chatId, "Выберите период", { reply_markup: { inline_keyboard: kb } });
    } else if (finalData.startsWith("admin_sold_products_period:")) {
      try {
        const parts = finalData.split(":");
        let dateFrom = "";
        let dateTo = dateInTimezone(env.TIMEZONE);
        if (parts[1] === "today") {
          dateFrom = dateTo;
        } else if (parts[1] === "yesterday") {
          dateFrom = addDaysInTimezone(env.TIMEZONE, -1);
          dateTo = dateFrom;
        } else if (parts[1] === "days" && parts[2]) {
          const d = Number(parts[2]);
          dateFrom = addDaysInTimezone(env.TIMEZONE, -d);
        } else {
          dateFrom = dateTo;
        }
        const db = getDb();
        const cityCode = shopConfig.cityCode || getDefaultCity();
        const { getProductsMap, formatProductName, normalizeProductId } = await import("../../utils/products");
        const prodMap = await getProductsMap(cityCode);
        const orders = db.prepare("SELECT order_id, items_json, total_with_discount, delivery_date, reserve_timestamp FROM orders WHERE status='delivered' AND ((delivery_date >= ? AND delivery_date <= ?) OR (substr(reserve_timestamp,1,10) >= ? AND substr(reserve_timestamp,1,10) <= ?)) ORDER BY order_id DESC").all(dateFrom, dateTo, dateFrom, dateTo) as any[];
        const productsList = await getProducts();
        const priceMap = new Map<number, number>();
        for (const p of productsList) priceMap.set(Number(p.product_id), Number(p.price || 0));
        const productStats = new Map<string, { count: number; revenue: number }>();
        let totalRevenue = 0;
        for (const order of orders) {
          try {
            const items = JSON.parse(String(order.items_json || "[]"));
            for (const item of items) {
              const productId = String(item.product_id);
              const qty = Number(item.quantity ?? item.qty ?? 1);
              const price = Number(item.price ?? priceMap.get(Number(item.product_id)) ?? 0);
              const key = normalizeProductId(productId);
              const prod = prodMap.get(key);
              const name = prod ? formatProductName(prod) : `Товар #${productId}`;
              const prev = productStats.get(name);
              if (prev) { prev.count += qty; prev.revenue += price * qty; } else { productStats.set(name, { count: qty, revenue: price * qty }); }
              totalRevenue += price * qty;
            }
          } catch {}
        }
        const sorted = Array.from(productStats.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
        let text = `🛍️ Проданные товары\n`;
        text += `📅 Период: ${dateFrom} - ${dateTo}\n`;
        text += `📦 Заказов: ${orders.length}\n`;
        text += `💰 Выручка: ${totalRevenue.toFixed(2)}€\n\n`;
        if (!sorted.length) {
          text += "(нет данных)";
        } else {
          const totalItems = sorted.reduce((sum, [, stat]) => sum + stat.count, 0);
          text += `📊 Всего продано: ${totalItems} позиций\n\n`;
          for (const [name, stat] of sorted.slice(0, 20)) {
            text += `${name}\n`;
            text += `  └ ${stat.count} шт · ${stat.revenue.toFixed(2)}€\n`;
          }
          if (sorted.length > 20) text += `\n... и ещё ${sorted.length - 20} товаров`;
        }
        const keyboard = { inline_keyboard: [[{ text: "« Назад", callback_data: "admin_sold_products" }]] };
        try {
          await bot.editMessageText(text, { chat_id: chatId, message_id: q.message?.message_id, reply_markup: keyboard });
        } catch {
          await bot.sendMessage(chatId, text, { reply_markup: keyboard });
        }
      } catch (error) {
        await bot.answerCallbackQuery(q.id, { text: "Ошибка загрузки", show_alert: true });
      }
    }
    if (finalData === "admin_upsell_stats") {
      const db = getDb();
      const today = dateInTimezone(env.TIMEZONE);
      const offers = db.prepare("SELECT COUNT(1) AS c FROM events WHERE type='upsell_offer' AND substr(date,1,10)=?").get(today) as any;
      const acceptsRows = db.prepare("SELECT payload FROM events WHERE type='upsell_accept' AND substr(date,1,10)=?").all(today) as any[];
      const accepts = acceptsRows.length;
      let extra = 0;
      for (const r of acceptsRows) {
        try { const p = JSON.parse(String(r.payload||'{}')); extra += Number(p.price||0); } catch {}
      }
      const rate = offers?.c ? Math.round((accepts / Number(offers.c)) * 100) : 0;
      const lines = [
        `Upsell предложения: ${Number(offers?.c||0)}`,
        `Upsell приняты: ${accepts}`,
        `Conversion: ${rate}%`,
        `Доп. выручка: ${extra.toFixed(2)} €`
      ];
      const kb = [[{ text: "⬅️ Назад", callback_data: "admin_back" }], [{ text: "🏠 Главное меню", callback_data: "back:main" }]];
      await bot.sendMessage(chatId, lines.join("\n"), { reply_markup: { inline_keyboard: kb } });
    }
    if (finalData === "admin_products") {
      const products = await getProducts();
      const lines = products.map((p) => `#${p.product_id} ${p.title} ${p.price} остаток ${p.qty_available}`);
      const kb = [[{ text: "⬅️ Назад", callback_data: "admin_back" }]];
      await bot.sendMessage(chatId, lines.slice(0, 20).join("\n") || "Нет данных", { reply_markup: { inline_keyboard: kb } });
    } else if (finalData === "admin_orders") {
      const rows = getDb()
        .prepare("SELECT o.order_id, o.status, o.total_with_discount, o.items_json, u.username FROM orders o LEFT JOIN users u ON o.user_id=u.user_id ORDER BY o.order_id DESC LIMIT 20")
        .all() as any[];
      const products = await getProducts();
      const fmt = (n: number) => `${Number(n).toFixed(2)} €`;
      const lines = rows.map((r) => {
        const items = JSON.parse(r.items_json || "[]");
        const itemsText = items.map((i: any) => {
          const p = products.find((x) => x.product_id === i.product_id);
          const title = p ? p.title : `#${i.product_id}`;
          return `• ${title} x${i.qty}`;
        }).join("\n");
        const user = r.username ? `@${r.username}` : "Клиент";
        return `#${r.order_id} · ${user} · ${r.status} · ${fmt(r.total_with_discount)}\n${itemsText}`;
      });
      const kb = [[{ text: "⬅️ Назад", callback_data: "admin_back" }]];
      await bot.sendMessage(chatId, lines.join("\n") || "Нет данных", { reply_markup: { inline_keyboard: kb } });
    } else if (finalData === "admin_couriers") {
      const list = await getCouriers();
      const lines = list.map((c) => `#${c.courier_id} ${c.name} ${(c.active ? "active" : "inactive")} ${c.last_delivery_interval}`);
      const kb = [[{ text: "⬅️ Назад", callback_data: "admin_back" }]];
      await bot.sendMessage(chatId, lines.join("\n") || "Нет данных", { reply_markup: { inline_keyboard: kb } });
    } else if (finalData === "admin_assign_couriers") {
      const list = await getCouriers();
      const rowsKb: TelegramBot.InlineKeyboardButton[][] = list.map((c) => [{ text: `${c.active ? "✅" : "❌"} ${c.name} · ${c.last_delivery_interval}`, callback_data: `admin_toggle_courier:${c.courier_id}` }]);
      rowsKb.push([{ text: "⬅️ Назад", callback_data: "admin_back" }]);
      await bot.sendMessage(chatId, "Выберите курьера (активно до 3)", { reply_markup: { inline_keyboard: rowsKb } });
    } else if (finalData.startsWith("admin_toggle_courier:")) {
      const cid = Number(finalData.split(":")[1]);
      const list = await getCouriers();
      const target = list.find((c) => c.courier_id === cid);
      if (!target) return;
      const activeCount = list.filter((c) => c.active).length;
      const willActivate = !target.active;
      if (willActivate && activeCount >= 3) {
        await bot.sendMessage(chatId, "Нельзя активировать более 3 курьеров одновременно.");
      } else {
        await updateCourier(cid, { active: willActivate } as any);
        const updated = await getCouriers();
        const rowsKb: TelegramBot.InlineKeyboardButton[][] = updated.map((c) => [{ text: `${c.active ? "✅" : "❌"} ${c.name} · ${c.last_delivery_interval}`, callback_data: `admin_toggle_courier:${c.courier_id}` }]);
        rowsKb.push([{ text: "⬅️ Назад", callback_data: "admin_back" }]);
        try {
          await bot.editMessageText("Выберите курьера (активно до 3)", { chat_id: chatId, message_id: q.message?.message_id!, reply_markup: { inline_keyboard: rowsKb } });
        } catch {
          await bot.sendMessage(chatId, "Выберите курьера (активно до 3)", { reply_markup: { inline_keyboard: rowsKb } });
        }
      }
  } else if (finalData === "admin_report_today") {
      try {
        const text = await generateDailySummaryText();
        const kb = [[{ text: "⬅️ Назад", callback_data: "admin_back" }]];
        await bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: kb } });
      } catch (error) {
        await bot.sendMessage(chatId, "❌ Ошибка загрузки отчёта");
      }
    } else if (finalData === "admin_export") {
      const file = "data/report.csv";
      await generateDailyReportCSV(file, 7);
      await bot.sendDocument(chatId, file);
    } else if (finalData === "admin_export_orders") {
      const file = "data/orders.csv";
      await generateOrdersCSV(file, 14);
      await bot.sendDocument(chatId, file);
    } else if (finalData === "admin_export_accounting") {
      const file = "data/accounting.csv";
      const { generateAccountingCSV } = await import("../../domain/metrics/CSVExport");
      await generateAccountingCSV(file);
      await bot.sendDocument(chatId, file);
    } else if (finalData === "admin_demo") {
      const db = getDb();
      const products = await getProducts();
      const now = new Date();
      for (let k = 0; k < 10; k++) {
        const day = new Date(now.getTime() - Math.floor(Math.random() * 5) * 86400000);
        const items = [products[Math.floor(Math.random() * products.length)]];
        const payload = [{ product_id: items[0].product_id, qty: 1, price: items[0].price, is_upsell: false }];
        const totals = items[0].price;
        db.prepare("INSERT INTO orders(user_id, items_json, total_without_discount, total_with_discount, discount_total, status, reserve_timestamp, expiry_timestamp) VALUES (?,?,?,?,?,?,?,?)")
          .run(999, JSON.stringify(payload), totals, totals, 0, "delivered", day.toISOString(), day.toISOString());
      }
      await bot.sendMessage(chatId, "Демо-данные добавлены для наглядности");
  } else if (finalData === "admin_promo15") {
      const db = getDb();
      const users = db.prepare("SELECT user_id FROM users").all() as any[];
      try { const { startPromo15 } = await import("../../domain/promo/PromoService"); startPromo15(); } catch {}
      for (const u of users) {
        try { await bot.sendMessage(Number(u.user_id), "🔥 Акция! Скидка 10% на всё 15 минут. Успейте оформить заказ."); } catch {}
      }
      await bot.sendMessage(chatId, "Акция запущена: 15 минут скидка 10% отмечается у курьера");
    } else if (finalData === "admin_migrate_items") {
      try {
        const db = getDb();
        const today = dateInTimezone(env.TIMEZONE);
        const dayAfter = addDaysInTimezone(env.TIMEZONE, 2);
        const rows = db.prepare("SELECT order_id, items_json FROM orders WHERE status IN ('pending','confirmed','courier_assigned') AND delivery_date >= ? AND delivery_date <= ? ORDER BY order_id DESC").all(today, dayAfter) as any[];
        const products = await getProducts();
        const pmap = new Map<number, string>();
        for (const p of products) pmap.set(Number(p.product_id), String(p.title || "Товар"));
        const enrichedPairs: Array<{ id: number; items: string }> = [];
        for (const r of rows) {
          try {
            const arr = JSON.parse(String(r.items_json || "[]"));
            if (Array.isArray(arr) && arr.length > 0) {
              const enriched = JSON.stringify(arr.map((it: any) => {
                const pid = Number(it.product_id);
                const name = pmap.get(pid) || `Товар #${pid}`;
                const qty = it.quantity ?? it.qty ?? 1;
                return { ...it, name, quantity: qty };
              }));
              db.prepare("UPDATE orders SET items_json = ? WHERE order_id = ?").run(enriched, Number(r.order_id));
              enrichedPairs.push({ id: Number(r.order_id), items: enriched });
            }
          } catch {}
        }
        const { getBackend } = await import("../../infra/backend");
        const backend = getBackend();
        for (const pair of enrichedPairs) {
          try { await backend.updateOrderDetails?.(pair.id, { items: pair.items } as any); } catch {}
        }
        const kb = [[{ text: "⬅️ Назад", callback_data: "admin_back" }]];
        await bot.sendMessage(chatId, `✅ Миграция выполнена: обновлено ${enrichedPairs.length} заказов`, { reply_markup: { inline_keyboard: kb } });
      } catch (e) {
        await bot.sendMessage(chatId, "❌ Ошибка миграции items");
      }
    } else if (finalData === "admin_reset_all") {
      const db = getDb();
      db.exec("DELETE FROM orders; DELETE FROM reservations; DELETE FROM events;");
      try {
        const { useSheets } = await import("../../infra/config");
        if (useSheets) {
          const { clear } = await import("../../infra/sheets/SheetsClient");
          const city = shopConfig.cityCode || getDefaultCity();
          await clear(`orders_${city}!A:Z`);
          await clear(`metrics_${city}!A:Z`);
        }
      } catch {}
      await bot.sendMessage(chatId, "Сброс выполнен: заказы и метрики очищены");
    } else if (data === "admin_sheets_status") {
      const db = getDb();
      const pending = db.prepare("SELECT COUNT(1) AS c FROM orders WHERE status='delivered' AND sheets_committed=0").get() as any;
      const sheetsStatus = (process.env.DATA_BACKEND === "sheets") ? "OK" : "DISABLED";
      await bot.sendMessage(chatId, `Sheets: ${sheetsStatus}\nPending commits: ${Number(pending?.c || 0)}`);
    } else if (data === "admin_repair_now") {
      const db = getDb();
      const rows = db.prepare("SELECT order_id FROM orders WHERE status='delivered' AND sheets_committed=0").all() as any[];
      const { getBackend } = await import("../../infra/backend");
      const backend = getBackend();
      let success = 0, fail = 0;
      for (const r of rows) {
        try {
          await backend.commitDelivery(Number(r.order_id));
          success++;
        } catch {
          fail++;
        }
      }
      await bot.sendMessage(chatId, `Repair finished: success=${success} fail=${fail}`);
    } else if (finalData === "admin_back") {
      const keyboard = [
        [{ text: "Список заказов", callback_data: "admin_orders" }],
        [{ text: "Курьеры", callback_data: "admin_couriers" }],
        [{ text: "Назначить курьеров (до 3)", callback_data: "admin_assign_couriers" }],
        [{ text: "Отчёт за день", callback_data: "admin_report_today" }],
        [{ text: "Скачать заказы (CSV)", callback_data: "admin_export_orders" }],
        [{ text: "Акция 15 мин (скидка)", callback_data: "admin_promo15" }],
        [{ text: "Демо: сгенерировать продажи", callback_data: "admin_demo" }]
      ];
      await bot.editMessageText("Админ-панель", { chat_id: chatId, message_id: q.message?.message_id!, reply_markup: { inline_keyboard: keyboard }, parse_mode: "HTML" });
    }
  });
}
