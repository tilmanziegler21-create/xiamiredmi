import TelegramBot, { CallbackQuery } from "node-telegram-bot-api";
import { ensureUser } from "../../domain/users/UserService";
import { getProducts, refreshProductsCache } from "../../infra/data";
import { getUserSegment } from "../../domain/users/UserService";
import { OrderItem, Product } from "../../core/types";
import { createOrder, confirmOrder, setDeliverySlot, getOrderById, previewTotals, setOrderCourier, setCourierAssigned, setPaymentMethod } from "../../domain/orders/OrderService";
import { finalDeduction } from "../../domain/inventory/InventoryService";
import { getActiveCouriers } from "../../domain/couriers/CourierService";
import { generateTimeSlots, validateSlot, getOccupiedSlots, isSlotAvailable } from "../../domain/delivery/DeliveryService";
import { env } from "../../infra/config";
import { shopConfig } from "../../config/shopConfig";
import { encodeCb, decodeCb } from "../cb";
import { logger } from "../../infra/logger";
import { getDb } from "../../infra/db/sqlite";
import { formatDate, addDays } from "../../core/time";
import { getLiquidUnitPrice } from "../../services/PriceService";
import { carts as cartsStore, userStates, userRerollCount } from "../../infra/storage/InMemoryStorage";
import { showHybridUpsellWithGuidance } from "../handlers/fortuneHandler";
import { showUpsellCatalog } from "../handlers/catalogHandler";

const carts: Map<number, OrderItem[]> = cartsStore as Map<number, OrderItem[]>;
const lastMainMsg: Map<number, number> = new Map();
const upsellRerolls: Map<number, number> = userRerollCount as Map<number, number>;
const upsellShown: Map<number, Set<number>> = new Map();

function fmtMoney(n: number) {
  return `${n.toFixed(2)} €`;
}

function addToCart(user_id: number, p: Product, isUpsell: boolean, priceOverride?: number) {
  const cart = carts.get(user_id) || [];
  const idx = cart.findIndex((c) => c.product_id === p.product_id);
  if (idx >= 0) cart[idx].qty += 1;
  else cart.push({ product_id: p.product_id, qty: 1, price: priceOverride ?? p.price, is_upsell: isUpsell });
  carts.set(user_id, cart);
  recalcLiquidPrices(user_id);
}

function renderCart(items: OrderItem[], products: Product[]) {
  const lines = items.map((i) => {
    const p = products.find((x) => x.product_id === i.product_id);
    const t = p ? `${p.brand ? `${String(p.brand).toUpperCase()} · ` : ""}${p.title}` : `#${i.product_id}`;
    const icon = p && p.category === "electronics" ? "💨" : "💧";
    return `${icon} ${t} x${i.qty} · ${i.price.toFixed(2)} €`;
  });
  return lines.join("\n") || "Корзина пустая";
}

async function recalcLiquidPrices(user_id: number) {
  const cart = carts.get(user_id) || [];
  if (cart.length === 0) return;
  const products = await getProducts();
  let liquCount = 0;
  for (const it of cart) {
    const p = products.find((x) => x.product_id === it.product_id);
    if (p && p.category === "liquids") liquCount += it.qty;
  }
  let unit = await getLiquidUnitPrice(liquCount, shopConfig.cityCode);
  const seg = getUserSegment(user_id);
  if (seg === "sale10") unit = Math.round(unit * 0.9 * 100) / 100;
  for (const it of cart) {
    const p = products.find((x) => x.product_id === it.product_id);
    if (p && p.category === "liquids") it.price = unit;
  }
  carts.set(user_id, cart);
  const total = cart.reduce((s,i)=>s+(i.price*i.qty),0);
  try {
    console.log("Cart calculation:");
    console.log("City:", shopConfig.cityCode);
    console.log("Qty:", liquCount);
    console.log("Price per unit:", unit);
    console.log("Total:", Math.round(total*100)/100);
  } catch {}
}

export function registerClientFlow(bot: TelegramBot) {
  bot.onText(/\/start/, async (msg) => {
    const user_id = msg.from?.id || 0;
    const username = msg.from?.username || "";
    await ensureUser(user_id, username);
    const rows: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "💧 Жидкости", callback_data: encodeCb("catalog_liquids") }],
      [{ text: "⚡️ Одноразки", callback_data: encodeCb("catalog_electronics") }],
      [{ text: "🛒 Моя корзина", callback_data: encodeCb("view_cart") }],
      [{ text: "❓ Как заказать?", callback_data: "how_to_order" }],
      [{ text: "👥 Наш канал", url: shopConfig.telegramGroupUrl }]
    ];
    const admins = (env.TELEGRAM_ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter((x) => x);
    if (admins.includes(user_id)) rows.push([{ text: "Админ", callback_data: "admin_open" }]);
    const prev = lastMainMsg.get(user_id);
    if (prev) { try { await bot.deleteMessage(msg.chat.id, prev); } catch {} }
    const sent = await bot.sendMessage(
      msg.chat.id,
      shopConfig.welcomeMessage,
      { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" }
    );
    lastMainMsg.set(user_id, sent.message_id);
  });

  bot.on("callback_query", async (q: CallbackQuery) => {
    try { await bot.answerCallbackQuery(q.id); } catch {}
    let data = q.data || "";
    data = decodeCb(data);
    try { logger.info("CLIENT_CLICK", { data }); } catch {}
    if (String(data || "").startsWith("admin_") || String(data || "").startsWith("courier_")) return;
    if (data === "__expired__") {
      const chatId = q.message?.chat.id || 0;
      await bot.sendMessage(chatId, "Кнопка устарела. Нажмите /start, чтобы обновить меню.");
      return;
    }
    const chatId = q.message?.chat.id || 0;
    const messageId = q.message?.message_id as number;
    const user_id = q.from.id;
    if (data === "back:main" || data === "start") {
      const rows = [
        [{ text: "💧 Жидкости", callback_data: encodeCb("catalog_liquids") }],
        [{ text: "⚡️ Одноразки", callback_data: encodeCb("catalog_electronics") }],
        [{ text: "🛒 Моя корзина", callback_data: encodeCb("view_cart") }],
        [{ text: "❓ Как заказать?", callback_data: "how_to_order" }],
        [{ text: "👥 Наш канал", url: shopConfig.telegramGroupUrl }]
      ];
      try {
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      await bot.sendMessage(chatId, shopConfig.welcomeMessage, { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      } catch {
        await bot.sendMessage(chatId, shopConfig.welcomeMessage, { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      }
      return;
    }
    if (data === "menu_catalog" || data === "catalog") {
      const rows = [
        [{ text: "💧 Жидкости", callback_data: encodeCb("catalog_liquids") }],
        [{ text: "⚡️ Электроника", callback_data: encodeCb("catalog_electronics") }],
        [{ text: "🛒 Моя корзина", callback_data: encodeCb("view_cart") }],
        [{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]
      ];
      try {
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      await bot.sendMessage(chatId, "🎯 <b>Наш ассортимент</b>\n\n💧 Жидкости\n⚡️ Одноразки", { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      } catch {
        await bot.sendMessage(chatId, "🎯 <b>Наш ассортимент</b>\n\n💧 Жидкости\n⚡️ Одноразки", { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      }
      return;
    }
    if (data === "menu_howto" || data === "how_to_order") {
      const rows = [[{ text: "🎯 Начать выбор", callback_data: "catalog" }], [{ text: "🔙 Назад", callback_data: "start" }]];
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      const { getManagerContact } = await import("../../config/managerContacts");
      const managerContact = getManagerContact(shopConfig.cityCode);
      await bot.sendMessage(chatId, `� <b>Как заказать</b>\n\n1️⃣ Выбор товаров\n2️⃣ Курьер и время\n3️⃣ Оплата\n\n❓ Вопросы?\n${managerContact}`, { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      return;
    }
    if (data === "catalog_liquids") {
      const products = await getProducts();
      const liquids = products.filter((p) => p.active && p.category === "liquids");
      const brandsSet = new Set<string>();
      for (const p of liquids) if (p.brand) brandsSet.add(p.brand);
      const brands = Array.from(brandsSet);
      const order = ["ELFIC", "CHASER"]; // приоритет
      brands.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      if (brands.length === 0) {
        // fallback: постраничный список всех жидкостей
        const page = 0;
        const per = 10;
        const start = page * per;
        const slice = liquids.slice(start, start + per);
        const rows: { text: string; callback_data: string }[][] = slice.map((a) => [{ text: `💧 ${a.title} · ${fmtMoney(a.price)}`, callback_data: encodeCb(`add_item:${a.product_id}`) }]);
        const nav: { text: string; callback_data: string }[] = [];
        if (start + per < liquids.length) nav.push({ text: "▶️", callback_data: encodeCb(`catalog_liquids:page:${page + 1}`) });
        if (nav.length) rows.push(nav);
        rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      const p1 = await getLiquidUnitPrice(1, shopConfig.cityCode);
      const p2 = await getLiquidUnitPrice(2, shopConfig.cityCode);
      const p3 = await getLiquidUnitPrice(3, shopConfig.cityCode);
      await bot.sendMessage(chatId, `📦 <b>Каталог вкусов</b>\n\n💶 ${shopConfig.cityCode}: 1 → ${p1.toFixed(2)}€ · 2 → ${p2.toFixed(2)}€/шт · 3+ → ${p3.toFixed(2)}€/шт`, { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      } else {
        const rows: { text: string; callback_data: string }[][] = brands.map((b) => [{ text: `💧 ${b}`, callback_data: encodeCb(`liq_brand:${b}`) }]);
        rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      const p1b = await getLiquidUnitPrice(1, shopConfig.cityCode);
      const p2b = await getLiquidUnitPrice(2, shopConfig.cityCode);
      const p3b = await getLiquidUnitPrice(3, shopConfig.cityCode);
      await bot.sendMessage(chatId, `💧 <b>Шаг 2: Выбери бренд жидкостей</b>\n\n🧪 ELFIQ — ⬇️⬇️⬇️\n🧪 CHASER — ⬇️⬇️⬇️\n\n${shopConfig.cityCode}: 1 → ${p1b.toFixed(2)}€ · 2 → ${p2b.toFixed(2)}€/шт · 3+ → ${p3b.toFixed(2)}€/шт`, { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      }
      return;
    }
    if (data.startsWith("catalog_liquids:page:")) {
      const page = Number(data.split(":")[2] || 0);
      const per = 10;
      const products = await getProducts();
      const liquids = products.filter((p) => p.active && p.category === "liquids");
      const start = page * per;
      const slice = liquids.slice(start, start + per);
      const rows: { text: string; callback_data: string }[][] = slice.map((a) => [{ text: `💧 ${a.title}${a.qty_available>0&&a.qty_available<=3?` (только ${a.qty_available}❗️)`:''} · ${fmtMoney(a.price)}`, callback_data: encodeCb(`add_item:${a.product_id}`) }]);
      const nav: { text: string; callback_data: string }[] = [];
      if (page > 0) nav.push({ text: "◀️", callback_data: encodeCb(`catalog_liquids:page:${page - 1}`) });
      if (start + per < liquids.length) nav.push({ text: "▶️", callback_data: encodeCb(`catalog_liquids:page:${page + 1}`) });
      if (nav.length) rows.push(nav);
      rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      const p1c = await getLiquidUnitPrice(1, shopConfig.cityCode);
      const p2c = await getLiquidUnitPrice(2, shopConfig.cityCode);
      const p3c = await getLiquidUnitPrice(3, shopConfig.cityCode);
      await bot.sendMessage(chatId, `🎯 <b>Каталог вкусов</b>\n\n💶 ${shopConfig.cityCode}: 1 → ${p1c.toFixed(2)}€ · 2 → ${p2c.toFixed(2)}€/шт · 3+ → ${p3c.toFixed(2)}€/шт`, { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      return;
    }
    if (data === "catalog_electronics") {
      const products = await getProducts();
      const list = products.filter((p) => p.active && p.category === "electronics");
      const brandsSet = new Set<string>();
      for (const p of list) if (p.brand) brandsSet.add(p.brand);
      const brands = Array.from(brandsSet);
      if (brands.length > 0) {
        const rows: { text: string; callback_data: string }[][] = brands.map((b) => [{ text: `💨 ${b}`, callback_data: encodeCb(`elec_brand:${b}`) }]);
        rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
        try { await bot.deleteMessage(chatId, messageId); } catch {}
        await bot.sendMessage(chatId, "⚡️ <b>Бренд электроники</b>", { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      } else {
        const page = 0;
        const per = 10;
        const start = page * per;
        const slice = list.slice(start, start + per);
        const rows: { text: string; callback_data: string }[][] = slice.map((a) => [{ text: `💨 ${a.title} · ${fmtMoney(a.price)}`, callback_data: encodeCb(`add_item:${a.product_id}`) }]);
        const nav: { text: string; callback_data: string }[] = [];
        if (start + per < list.length) nav.push({ text: "▶️", callback_data: encodeCb(`catalog_electronics:page:${page + 1}`) });
        if (nav.length) rows.push(nav);
        rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
        try { await bot.deleteMessage(chatId, messageId); } catch {}
        await bot.sendMessage(chatId, "📦 <b>Каталог электроники</b>", { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      }
      return;
    }
    if (data.startsWith("catalog_electronics:page:")) {
      const page = Number(data.split(":")[2] || 0);
      const per = 10;
      const products = await getProducts();
      const list = products.filter((p) => p.active && p.category === "electronics");
      const start = page * per;
      const slice = list.slice(start, start + per);
      const rows: { text: string; callback_data: string }[][] = slice.map((a) => [{ text: `💨 ${a.title}${a.qty_available>0&&a.qty_available<=3?` (только ${a.qty_available}❗️)`:''} · ${fmtMoney(a.price)}`, callback_data: encodeCb(`add_item:${a.product_id}`) }]);
      const nav: { text: string; callback_data: string }[] = [];
      if (page > 0) nav.push({ text: "◀️", callback_data: encodeCb(`catalog_electronics:page:${page - 1}`) });
      if (start + per < list.length) nav.push({ text: "▶️", callback_data: encodeCb(`catalog_electronics:page:${page + 1}`) });
      if (nav.length) rows.push(nav);
      rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      await bot.sendMessage(chatId, "📦 <b>Каталог электроники</b>", { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      return;
    }
    if (data.startsWith("elec_brand:")) {
      const parts = data.split(":");
      const brand = parts[1];
      const page = parts[3] ? Number(parts[3]) : 0;
      const per = 10;
      const products = await getProducts();
      const list = products.filter((p) => p.active && p.category === "electronics" && (p.brand || "") === brand);
      const start = page * per;
      const slice = list.slice(start, start + per);
      const rows: { text: string; callback_data: string }[][] = slice.map((a) => [{ text: `💨 ${a.title}${a.qty_available>0&&a.qty_available<=3?` (только ${a.qty_available}❗️)`:''} · ${fmtMoney(a.price)}`, callback_data: encodeCb(`add_item:${a.product_id}`) }]);
      const nav: { text: string; callback_data: string }[] = [];
      if (page > 0) nav.push({ text: "◀️", callback_data: encodeCb(`elec_brand:${brand}:page:${page - 1}`) });
      if (start + per < list.length) nav.push({ text: "▶️", callback_data: encodeCb(`elec_brand:${brand}:page:${page + 1}`) });
      if (nav.length) rows.push(nav);
      rows.push([{ text: "🛒 Корзина", callback_data: encodeCb("cart_open") }]);
      rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      await bot.sendMessage(chatId, `<b>${brand}</b> 💨`, { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      return;
    }
    if (data.startsWith("liq_brand:")) {
      const parts = data.split(":");
      const brand = parts[1];
      const page = parts[3] ? Number(parts[3]) : 0;
      const per = 10;
      const products = await getProducts();
      const list = products.filter((p) => p.active && p.category === "liquids" && (p.brand || "") === brand);
      const start = page * per;
      const slice = list.slice(start, start + per);
      const rows: { text: string; callback_data: string }[][] = slice.map((a) => [{ text: `💧 ${a.title}${a.qty_available>0&&a.qty_available<=3?` (только ${a.qty_available}❗️)`:''} · ${fmtMoney(a.price)}`, callback_data: encodeCb(`add_item:${a.product_id}`) }]);
      const nav: { text: string; callback_data: string }[] = [];
      if (page > 0) nav.push({ text: "◀️", callback_data: encodeCb(`liq_brand:${brand}:page:${page - 1}`) });
      if (start + per < list.length) nav.push({ text: "▶️", callback_data: encodeCb(`liq_brand:${brand}:page:${page + 1}`) });
      if (nav.length) rows.push(nav);
      rows.push([{ text: "🛒 Корзина", callback_data: encodeCb("cart_open") }]);
      rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      await bot.sendMessage(chatId, `🧪 <b>${brand}</b>\n\nВкусы`, { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      return;
    }
    if (data === "back:menu_catalog") {
      const rows = [
        [{ text: "🛍️ Каталог", callback_data: "menu_catalog" }],
        [{ text: "🛒 Корзина", callback_data: encodeCb("cart_open") }],
        [{ text: "❓ Как заказать?", callback_data: "menu_howto" }],
        [{ text: "👥 Группа в Telegram", url: env.GROUP_URL || "https://t.me/+OiFfOVteCMFhYjZi" }],
        [{ text: "⭐ Отзывы", url: env.REVIEWS_URL || "https://t.me/" }]
      ];
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      await bot.sendMessage(chatId, "🍬 <b>Добро пожаловать</b>\n\nПремиальные жидкости ELFIQ/CHASER и электроника.\n💶 Цена автоматически зависит от количества и города.\n🚚 Курьерская выдача — выбираете удобный слот.\n\n👇 Выберите действие и соберите заказ за минуту", { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
      return;
    }
    if (data.startsWith("add_item:")) {
      const pid = Number(data.split(":")[1]);
      const products = await getProducts();
      try { console.log("🔍 Callback(add_item):", data, "pid:", pid, "type:", typeof pid); } catch {}
      const p = products.find((x) => x.product_id === pid);
      try { console.log("🔍 Found product:", p ? { id: p.product_id, name: p.title, category: p.category } : "NOT FOUND"); } catch {}
      if (!p) return;
      addToCart(user_id, p, false);
      const items = carts.get(user_id) || [];
      const totals = await previewTotals(user_id, items);
      let savings = 0;
      for (const i of items) {
        const ip = products.find((x) => x.product_id === i.product_id);
        if (ip && ip.category === "liquids" && i.price < 18) savings += (18 - i.price) * i.qty;
      }
      savings = Math.round(savings * 100) / 100;
      const baseKeyboard: { text: string; callback_data: string }[][] = [[{ text: `✅ Подтвердить заказ · ${totals.total_with_discount.toFixed(2)} €`, callback_data: encodeCb("confirm_order") }], [{ text: "🛒 Корзина", callback_data: encodeCb("cart_open") }]];
      let finalKeyboard = baseKeyboard;
      if (p.category === "liquids") {
        const productsAll = await refreshProductsCache();
        const available = productsAll.filter((x) => x.active && x.category === "liquids" && !items.find((i) => i.product_id === x.product_id));
        for (let i = available.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = available[i]; available[i] = available[j]; available[j] = t; }
        const pick = available.slice(0, 2);
        try {
          const dbx = getDb();
          dbx.prepare("INSERT INTO events(date, type, user_id, payload) VALUES (?,?,?,?)").run(new Date().toISOString(), "upsell_offer", user_id, JSON.stringify({ suggestions: pick.map(x=>x.product_id) }));
          for (const s of pick) dbx.prepare("INSERT INTO upsell_events(user_id, product_id, event_type, timestamp) VALUES (?,?,?,?)").run(user_id, s.product_id, "offered", Date.now());
        } catch {}
        let liquCount = 0; for (const it of items) { const ip = products.find((x) => x.product_id === it.product_id); if (ip && ip.category === "liquids") liquCount += it.qty; }
        const nextUnitDyn = await getLiquidUnitPrice(liquCount + 1, shopConfig.cityCode);
        const rows: { text: string; callback_data: string }[][] = pick.map((s) => [{ text: `➕ ${s.title} — ${nextUnitDyn.toFixed(2)} €`, callback_data: encodeCb(`add_upsell:${s.product_id}`) }]);
        rows.push([{ text: "🧪 Выбор бренда", callback_data: encodeCb("catalog_liquids") }]);
        finalKeyboard = rows.concat(finalKeyboard);
      }
      let liquCountNow = 0; for (const it of items) { const ip = products.find((x) => x.product_id === it.product_id); if (ip && ip.category === "liquids") liquCountNow += it.qty; }
      const price1 = await getLiquidUnitPrice(1, shopConfig.cityCode);
      const price2 = await getLiquidUnitPrice(2, shopConfig.cityCode);
      const price3 = await getLiquidUnitPrice(3, shopConfig.cityCode);
      const pairSave = Math.max(0, Math.round((price1 * 2 - price2 * 2)));
      const tripleSave = Math.max(0, Math.round((price1 * 3 - price3 * 3)));
      const textLiquids =
        liquCountNow === 1
          ? `✅ ${p.title} добавлен\n\n💧 ${p.title} · ${price1.toFixed(2)} €\n\n💰 Итого: <b>${totals.total_with_discount.toFixed(2)} €</b>\n\n🔥 Добавь второй — обе по ${price2.toFixed(2)} €!\n💡 Экономия: ${pairSave} € на двух`
          : (liquCountNow === 2
              ? `✅ ${p.title} добавлен\n💰 Цены пересчитаны!\n\n${renderCart(items, products)}\n\n💰 Итого: <b>${totals.total_with_discount.toFixed(2)} €</b>${savings > 0 ? `\n💚 Сэкономил: ${savings.toFixed(2)} €` : ""}\n\n🔥 Третий = все по ${price3.toFixed(2)} €!\n💸 Экономия вырастет до ${tripleSave} €`
              : `✅ ${p.title} добавлен\n💰 Максимальная скидка!\n\n${renderCart(items, products)}\n\n💰 Итого: <b>${totals.total_with_discount.toFixed(2)} €</b>${savings > 0 ? `\n💚 Сэкономил: ${savings.toFixed(2)} €` : ""}`);
      const textElectronics = `💨 ${p.title} добавлен — ${fmtMoney(p.price)}\n${renderCart(items, products)}\n\nИтого: <b>${totals.total_with_discount.toFixed(2)} €</b>`;
      const outText = p.category === "liquids" ? textLiquids : textElectronics;
      if (p.category !== "liquids") {
        try {
          await bot.editMessageText(outText, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: finalKeyboard }, parse_mode: "HTML" });
        } catch {
          await bot.sendMessage(chatId, outText, { reply_markup: { inline_keyboard: finalKeyboard }, parse_mode: "HTML" });
        }
      }
      if (p.category === "liquids") {
        const exclude = Array.from(new Set((items || []).map((i) => i.product_id)));
        try { await showHybridUpsellWithGuidance(bot, chatId, messageId, user_id, "liquids", exclude); } catch {}
      }
    } else if (data === "show_upsell") {
      const products = await refreshProductsCache();
      const cart = carts.get(user_id) || [];
      const groups = new Set<number>();
      for (const it of cart) {
        const p = products.find((x) => x.product_id === it.product_id);
        if (p && typeof p.upsell_group_id === "number") groups.add(p.upsell_group_id);
      }
      const sug = products.filter((p) => p.active && p.upsell_group_id != null && groups.has(p.upsell_group_id as number)).slice(0, 6);
      let liquCountS = 0; for (const it of cart) { const ip = products.find((x) => x.product_id === it.product_id); if (ip && ip.category === "liquids") liquCountS += it.qty; }
      const nextUnitS = await getLiquidUnitPrice(liquCountS + 1, shopConfig.cityCode);
      const rows: { text: string; callback_data: string }[][] = sug.slice(0, 3).map((p) => [{ text: `🔥 Добавить вкус: ${p.title}${p.qty_available>0&&p.qty_available<=3?` (только ${p.qty_available}❗️)`:''} · ${p.category === "liquids" ? `${nextUnitS.toFixed(2)} €` : fmtMoney(p.price)}`, callback_data: `add_upsell:${p.product_id}` }]);
      rows.push([{ text: "🧴 Добавить ещё жидкости", callback_data: encodeCb("catalog_liquids") }]);
      await bot.editMessageText("<b>Рекомендуем дополнительно</b> ⭐", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
    } else if (data.startsWith("add_upsell:")) {
    const pid = Number(data.split(":")[1]);
    const products = await getProducts();
    const p = products.find((x) => x.product_id === pid);
    if (!p) return;
    const price = p.category === "liquids" ? 16 : p.price;
    addToCart(user_id, p, true, price);
    try {
      const dbx = getDb();
      dbx.prepare("INSERT INTO events(date, type, user_id, payload) VALUES (?,?,?,?)").run(new Date().toISOString(), "upsell_accept", user_id, JSON.stringify({ product_id: pid, price }));
      dbx.prepare("INSERT INTO upsell_events(user_id, product_id, event_type, timestamp) VALUES (?,?,?,?)").run(user_id, pid, "accepted", Date.now());
    } catch {}
    const items = carts.get(user_id) || [];
    const cu = await currentUnitPrice(user_id, products);
    const label = p.category === "liquids" ? `${cu.toFixed(2)} €` : fmtMoney(p.price);
    const totals = await previewTotals(user_id, items);
    let savings2 = 0;
    for (const it of items) {
      const ip = products.find((x) => x.product_id === it.product_id);
      if (ip && ip.category === "liquids" && it.price < 18) savings2 += (18 - it.price) * it.qty;
    }
    savings2 = Math.round(savings2 * 100) / 100;
    const groups = new Set<number>();
    for (const it of items) {
      const ip = products.find((x) => x.product_id === it.product_id);
      if (ip && typeof ip.upsell_group_id === "number") groups.add(ip.upsell_group_id);
    }
    const pool = products.filter((x) => x.active && x.category === "liquids" && !items.find((i) => i.product_id === x.product_id));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const more = pool.slice(0, 2);
    let liquCount2 = 0; for (const it of items) { const ip = products.find((x) => x.product_id === it.product_id); if (ip && ip.category === "liquids") liquCount2 += it.qty; }
    const nextUnit2 = await getLiquidUnitPrice(liquCount2 + 1, shopConfig.cityCode);
    const rows: { text: string; callback_data: string }[][] = more.map((m) => [{ text: `➕ Добавить вкус — ${nextUnit2.toFixed(2)} €`, callback_data: encodeCb(`add_upsell:${m.product_id}`) }]);
    rows.push([{ text: `✅ Подтвердить заказ · ${totals.total_with_discount.toFixed(2)} €`, callback_data: encodeCb("confirm_order") }]);
    rows.push([{ text: "🧴 Добавить ещё жидкости", callback_data: encodeCb("catalog_liquids") }]);
    rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
    try {
      await bot.editMessageText(`<b>Добавлено в корзину</b>: ${p.title} — ${label}\n${renderCart(items, products)}\n\nИтого: <b>${totals.total_with_discount.toFixed(2)} €</b>${savings2 > 0 ? ` · Экономия: ${savings2.toFixed(2)} €` : ""}`, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
    } catch {
      await bot.sendMessage(chatId, `<b>Добавлено в корзину</b>: ${p.title} — ${label}\n${renderCart(items, products)}\n\nИтого: <b>${totals.total_with_discount.toFixed(2)} €</b>${savings2 > 0 ? ` · Экономия: ${savings2.toFixed(2)} €` : ""}`, { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
    }
    } else if (data.startsWith("add_upsell_discount10:")) {
    const pid = Number(data.split(":")[1]);
    const products = await getProducts();
    const p = products.find((x) => x.product_id === pid);
    if (!p) return;
    addToCart(user_id, p, true);
    try {
      const dbx = getDb();
      dbx.prepare("INSERT INTO events(date, type, user_id, payload) VALUES (?,?,?,?)").run(new Date().toISOString(), "upsell_accept", user_id, JSON.stringify({ product_id: pid, price: p.price }));
      dbx.prepare("INSERT INTO upsell_events(user_id, product_id, event_type, timestamp) VALUES (?,?,?,?)").run(user_id, pid, "accepted", Date.now());
    } catch {}
    const items = carts.get(user_id) || [];
    const totals = await previewTotals(user_id, items);
    let savings3 = 0;
    for (const it of items) {
      const ip = products.find((x) => x.product_id === it.product_id);
      if (ip && ip.category === "liquids" && it.price < 18) savings3 += (18 - it.price) * it.qty;
    }
    savings3 = Math.round(savings3 * 100) / 100;
    const liqu = products.filter((x) => x.active && x.category === "liquids" && !items.find((i) => i.product_id === x.product_id));
    const more = liqu.slice(0, 6);
    const rows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < more.length; i += 3) {
      const r: { text: string; callback_data: string }[] = [];
      for (let j = i; j < Math.min(i + 3, more.length); j++) r.push({ text: `🔥 ${more[j].title} · скидка 10%`, callback_data: encodeCb(`add_upsell_discount10:${more[j].product_id}`) });
      rows.push(r);
    }
    rows.push([{ text: `✅ Подтвердить заказ · ${totals.total_with_discount.toFixed(2)} €`, callback_data: encodeCb("confirm_order") }]);
    rows.push([{ text: "🧴 Добавить ещё жидкости", callback_data: encodeCb("catalog_liquids") }]);
    rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
    try {
      await bot.editMessageText(`<b>Добавлено в корзину</b>: ${p.title} — скидка 10%\n${renderCart(items, products)}\n\nИтого: <b>${totals.total_with_discount.toFixed(2)} €</b>${savings3 > 0 ? ` · Экономия: ${savings3.toFixed(2)} €` : ""}`, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
    } catch {
      await bot.sendMessage(chatId, `<b>Добавлено в корзину</b>: ${p.title} — скидка 10%\n${renderCart(items, products)}\n\nИтого: <b>${totals.total_with_discount.toFixed(2)} €</b>${savings3 > 0 ? ` · Экономия: ${savings3.toFixed(2)} €` : ""}`, { reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
    }
    } else if (data === "cart_open" || data === "view_cart") {
      await showCart(bot, chatId, user_id, messageId);
    } else if (data.startsWith("add_to_cart:")) {
      const pid = Number(data.split(":")[1]);
      const products = await getProducts();
      const p = products.find((x) => x.product_id === pid);
      if (!p) return;
      addToCart(user_id, p, false);
      upsellRerolls.set(user_id, 0);
      const items = carts.get(user_id) || [];
      const exclude = Array.from(new Set((items || []).map((i) => i.product_id)));
      try { await showHybridUpsellWithGuidance(bot, chatId, messageId, user_id, p.category, exclude.concat([p.product_id])); } catch {}
    } else if (data.startsWith("cart_add:")) {
      const parts = data.split(":");
      const pid = Number(parts[1]);
      const n = Number(parts[2] || 1);
      const items = carts.get(user_id) || [];
      const idx = items.findIndex((x) => x.product_id === pid);
      if (idx >= 0) items[idx].qty += n;
      carts.set(user_id, items);
      await recalcLiquidPrices(user_id);
      await showCart(bot, chatId, user_id, messageId);
    } else if (data.startsWith("cart_sub:")) {
      const parts = data.split(":");
      const pid = Number(parts[1]);
      const n = Number(parts[2] || 1);
      const items = carts.get(user_id) || [];
      const idx = items.findIndex((x) => x.product_id === pid);
      if (idx >= 0) items[idx].qty = Math.max(0, items[idx].qty - n);
      if (idx >= 0 && items[idx].qty === 0) items.splice(idx, 1);
      carts.set(user_id, items);
      await recalcLiquidPrices(user_id);
      await showCart(bot, chatId, user_id, messageId);
    } else if (data.startsWith("cart_del:")) {
      const pid = Number(data.split(":")[1]);
      const items = carts.get(user_id) || [];
      const idx = items.findIndex((x) => x.product_id === pid);
      if (idx >= 0) items.splice(idx, 1);
      carts.set(user_id, items);
      await recalcLiquidPrices(user_id);
      await showCart(bot, chatId, user_id, messageId);
    } else if (data === "confirm_order" || data === "confirm_order_start") {
      const items = carts.get(user_id) || [];
      if (items.length === 0) return;
      const productsNow = await getProducts();
      for (const it of items) {
        const p = productsNow.find((x) => x.product_id === it.product_id);
        if (!p || !p.active || p.qty_available < it.qty) {
          const warnKb: TelegramBot.InlineKeyboardButton[][] = [[{ text: "🛒 Перейти в корзину", callback_data: encodeCb("view_cart") }]];
          await bot.editMessageText(`❌ Недостаточно "${p ? p.title : ('#'+it.product_id)}". Доступно: ${p ? p.qty_available : 0} шт.\n\nПожалуйста, обновите корзину.`, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: warnKb }, parse_mode: "HTML" });
          return;
        }
      }
      let order;
      try {
        order = await createOrder(user_id, items);
      } catch (e:any) {
        const msgErr = String(e?.message || "");
        const warnKb: TelegramBot.InlineKeyboardButton[][] = [[{ text: "🛒 Перейти в корзину", callback_data: encodeCb("view_cart") }]];
        await bot.editMessageText(`❌ Ошибка при оформлении заказа.\n${msgErr.includes("Insufficient stock") ? "Недостаточно товара. Пожалуйста, обновите корзину." : "Попробуйте снова."}`, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: warnKb }, parse_mode: "HTML" });
        return;
      }
      await confirmOrder(order.order_id);
      const couriers = await getActiveCouriers();
      const rows: TelegramBot.InlineKeyboardButton[][] = couriers.map((c) => [{ text: `${c.name} · ${c.last_delivery_interval}`, callback_data: encodeCb(`choose_courier:${order.order_id}|${c.tg_id}`) }]);
      rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
      await bot.editMessageText(`✅ Оформление\n\n📦 Корзина:\n${renderCart(items, await getProducts())}\n\n💰 Итого: ${(await previewTotals(user_id, items)).total_with_discount.toFixed(2)} €\n\n🚗 Шаг 1: Курьер`, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
    } else if (data.startsWith("choose_courier:")) {
      const payload = data.substring("choose_courier:".length);
      const [orderIdStr, courierIdStr] = payload.split("|");
      const order_id = Number(orderIdStr);
      const courier_tg_id = Number(courierIdStr);
      await setOrderCourier(order_id, courier_tg_id);
      await setCourierAssigned(order_id, courier_tg_id);
      const st0 = userStates.get(user_id) || { state: "selecting_date", data: {}, lastActivity: Date.now() };
      st0.data = { ...(st0.data || {}), courier_id: courier_tg_id };
      st0.state = "selecting_date";
      st0.lastActivity = Date.now();
      userStates.set(user_id, st0);
      const today = formatDate(new Date());
      const tomorrow = formatDate(addDays(new Date(), 1));
      const dayAfter = formatDate(addDays(new Date(), 2));
      const rowsDates: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: `Сегодня (${today})`, callback_data: encodeCb(`select_date:${order_id}|${today}`) }],
        [{ text: `Завтра (${tomorrow})`, callback_data: encodeCb(`select_date:${order_id}|${tomorrow}`) }],
        [{ text: `Послезавтра (${dayAfter})`, callback_data: encodeCb(`select_date:${order_id}|${dayAfter}`) }],
        [{ text: "⬅️ Назад", callback_data: encodeCb(`back:choose_courier:${order_id}`) }],
        [{ text: "🏠 Главное меню", callback_data: encodeCb("back:main") }]
      ];
      await bot.editMessageText(`📅 Шаг 2: День`, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: rowsDates }, parse_mode: "HTML" });
    } else if (data.startsWith("back:choose_courier:")) {
      const order_id = Number(data.split(":")[2]);
      const couriers = await getActiveCouriers();
      const rows: TelegramBot.InlineKeyboardButton[][] = couriers.map((c) => [{ text: `${c.name} · ${c.last_delivery_interval}`, callback_data: `choose_courier:${order_id}|${c.tg_id}` }]);
      rows.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
      await bot.editMessageText(`<b>Курьер</b>`, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: rows }, parse_mode: "HTML" });
    } else if (data.startsWith("select_date:")) {
      const [orderIdStr, dateStr] = data.substring("select_date:".length).split("|");
      const order_id = Number(orderIdStr);
      const orderAssigned = await getOrderById(order_id);
      const couriers = await getActiveCouriers();
      const chosen = couriers.find((c) => c.tg_id === (orderAssigned?.courier_id || -1));
      const interval = chosen?.last_delivery_interval || "14-16";
      const slots = generateTimeSlots(interval);
      const occupied = chosen ? getOccupiedSlots(chosen.tg_id, dateStr) : new Set<string>();
      const st1 = userStates.get(user_id) || { state: "selecting_slot", data: {}, lastActivity: Date.now() };
      st1.data = { ...(st1.data || {}), delivery_date: dateStr };
      st1.state = "selecting_slot";
      st1.lastActivity = Date.now();
      userStates.set(user_id, st1);
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      for (let i = 0; i < Math.min(slots.length, 21); i += 3) {
        const row: TelegramBot.InlineKeyboardButton[] = [];
        for (let j = i; j < Math.min(i + 3, slots.length); j++) {
          const mark = occupied.has(slots[j]) ? "🔴" : "🟢";
          row.push({ text: `${mark} ${slots[j]}`, callback_data: encodeCb(`select_slot:${order_id}|${slots[j]}|${dateStr}`) });
        }
        keyboard.push(row);
      }
      const backRow: TelegramBot.InlineKeyboardButton[][] = [[{ text: "⬅️ Назад", callback_data: encodeCb(`back:choose_courier:${order_id}`) }], [{ text: "🏠 Главное меню", callback_data: encodeCb("back:main") }]];
      await bot.editMessageText(`⏱️ Шаг 3: Время\nДень: ${dateStr}`, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: keyboard.concat(backRow) }, parse_mode: "HTML" });
    } else if (data.startsWith("select_slot:")) {
      const payload = data.substring("select_slot:".length);
      const [orderIdStr, time, dateStr] = payload.split("|");
      const order_id = Number(orderIdStr);
      const couriers = await getActiveCouriers();
      const orderAssigned = await getOrderById(order_id);
      const chosen = couriers.find((c) => c.tg_id === (orderAssigned?.courier_id || -1));
      const interval = chosen?.last_delivery_interval || couriers[0]?.last_delivery_interval || "14:00-16:00";
      const ok = validateSlot(interval, time);
      if (!ok) {
        await bot.editMessageText("<b>Слот недоступен</b>", { chat_id: chatId, message_id: messageId, parse_mode: "HTML" });
        return;
      }
      const isFree = chosen ? !getOccupiedSlots(chosen.tg_id, dateStr).has(time) : true;
      if (!isFree) {
        const occ = chosen ? getOccupiedSlots(chosen.tg_id, dateStr) : new Set<string>();
        const slots2 = generateTimeSlots(interval);
        const keyboard2: TelegramBot.InlineKeyboardButton[][] = [];
        for (let i = 0; i < Math.min(slots2.length, 21); i += 3) {
          const row: TelegramBot.InlineKeyboardButton[] = [];
          for (let j = i; j < Math.min(i + 3, slots2.length); j++) {
            const mark = occ.has(slots2[j]) ? "🔴" : "🟢";
            row.push({ text: `${mark} ${slots2[j]}`, callback_data: encodeCb(`select_slot:${order_id}|${slots2[j]}|${dateStr}`) });
          }
          keyboard2.push(row);
        }
        const backRow2: TelegramBot.InlineKeyboardButton[][] = [[{ text: "⬅️ Назад", callback_data: encodeCb(`select_date:${order_id}|${dateStr}`) }], [{ text: "🏠 Главное меню", callback_data: encodeCb("back:main") }]];
        await bot.editMessageText(`<b>Слот занят</b>`, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: keyboard2.concat(backRow2) }, parse_mode: "HTML" });
        return;
      }
      await setDeliverySlot(order_id, interval, time, dateStr);
      const st2 = userStates.get(user_id) || { state: "selecting_payment", data: {}, lastActivity: Date.now() };
      st2.data = { ...(st2.data || {}), delivery_time: time };
      st2.state = "selecting_payment";
      st2.lastActivity = Date.now();
      userStates.set(user_id, st2);
      const payKb: TelegramBot.InlineKeyboardButton[][] = [
        [{ text: "💵 Наличные", callback_data: encodeCb(`pay:${order_id}|cash`) }],
        [{ text: "💳 Оплата картой", callback_data: encodeCb(`pay:${order_id}|card`) }]
      ];
      await bot.editMessageText(`💳 Шаг 4: Оплата\n⏱️ ${time}`, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: payKb }, parse_mode: "HTML" });
      const order = await getOrderById(order_id);
      const products = await getProducts();
      const lines = (order?.items || []).map((i) => {
        const p = products.find((x) => x.product_id === i.product_id);
        const t = p ? `${p.brand ? `${String(p.brand).toUpperCase()} · ` : ""}${p.title}` : `#${i.product_id}`;
        return `${t} x${i.qty} · ${(i.price).toFixed(2)} €`;
      }).join("\n");
      const orderAssigned2 = await getOrderById(order_id);
      const notifyTgId = orderAssigned2?.courier_id || null;
      if (notifyTgId) {
      const courierKeyboard: TelegramBot.InlineKeyboardButton[][] = [[
        { text: `📦 Выдано #${order_id}`, callback_data: encodeCb(`courier_issue:${order_id}`) },
        { text: `❗ Не выдано #${order_id}`, callback_data: encodeCb(`courier_not_issued:${order_id}`) }
      ]];
        try {
          const uname = q.from.username ? `@${q.from.username}` : `${q.from.first_name || "Клиент"}`;
          let promoMark = "";
          try {
            const ord = await getOrderById(order_id);
            const { isOrderInPromo } = await import("../../domain/promo/PromoService");
            if (ord && isOrderInPromo(ord.reserve_timestamp)) promoMark = " · скидка 10%";
          } catch {}
          await bot.sendMessage(notifyTgId, `📦 Новый заказ #${order_id} (не выдан${promoMark})\nКлиент: ${uname}\nДень: ${dateStr}\nИнтервал: ${interval}\nВремя: ${time}\n\n${lines}`, { reply_markup: { inline_keyboard: courierKeyboard }, parse_mode: "HTML" });
        } catch {}
      }
      // Контакт для локации будет отправлен после выбора оплаты
    } else if (data.startsWith("pay:")) {
      const [orderIdStr, method] = data.substring(4).split("|");
      const order_id = Number(orderIdStr);
      const st = userStates.get(user_id);
      if (!st || !st.data || !st.data.courier_id || !st.data.delivery_date || !st.data.delivery_time) {
        await bot.editMessageText("❌ Упс! Произошла ошибка. Попробуйте оформить заказ заново через /start", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [[{ text: "🏠 На главную", callback_data: "start" }]] }, parse_mode: "HTML" });
        return;
      }
      await setPaymentMethod(order_id, method === "card" ? "card" : "cash");
      carts.delete(user_id);
      const orderNow = await getOrderById(order_id);
      try {
        const backend = (await import("../../infra/backend")).getBackend();
        await backend.updateOrderDetails?.(order_id, {
          courier_id: st.data.courier_id,
          slot_time: st.data.delivery_time,
          delivery_date: st.data.delivery_date,
          payment_method: method,
          items: JSON.stringify(orderNow?.items || [])
        } as any);
      } catch {}
      try {
        await finalDeduction(orderNow?.items || []);
        await refreshProductsCache();
      } catch {}
      const productsAll = await getProducts();
      const { formatProductName } = await import("../../utils/products");
      const itemsList = (orderNow?.items || []).map((i) => {
        const p = productsAll.find((x) => x.product_id === i.product_id);
        const name = p ? formatProductName(p as any) : `#${i.product_id}`;
        return `• ${name} × ${i.qty}`;
      }).join("\n");
      const couriersAll = await getActiveCouriers();
      const courier = couriersAll.find((c) => c.tg_id === (orderNow?.courier_id || -1));
      const paymentText = method === "card" ? "карта" : "наличные";
      try { console.log("🔍 Order confirmation for:", { orderId: order_id, items: orderNow?.items, itemsType: typeof (orderNow as any)?.items }); } catch {}
      const message = `✅ <b>Заказ #${order_id} оформлен!</b>\n\n📦 <b>Твой заказ:</b>\n${itemsList}\n\n💰 <b>Сумма: ${(orderNow?.total_with_discount || 0).toFixed(2)} €</b>\n💳 <b>Оплата: ${paymentText}</b>\n⏰ <b>Время: ${st.data.delivery_time}</b>\n📅 <b>День: ${st.data.delivery_date}</b>\n\n━━━━━━━━━━━━━━━━\n\n👤 <b>Твой курьер:</b> ${courier?.name || "Курьер"}\n\n<b>Что делать дальше:</b>\n1️⃣ Напиши курьеру (кнопка ниже)\n2️⃣ Скажи что сделал заказ #${order_id}\n3️⃣ Попроси локацию точки выдачи\n4️⃣ Приходи в назначенное время\n\nСпасибо за заказ! 🔥`;
      const order3 = await getOrderById(order_id);
      const notifyTgId2 = order3?.courier_id || null;
      const prefill = `Привет! Я сделал заказ #${order_id}\n\n📅 Дата: ${st.data.delivery_date}\n⏰ Время: ${st.data.delivery_time}\n\nЗаказал:\n${itemsList}\n\n💰 К оплате: ${(orderNow?.total_with_discount || 0).toFixed(2)}€\n\nГде встретимся?`;
      const contactKeyboard: TelegramBot.InlineKeyboardButton[][] = [];
      try {
        const dbx = getDb();
        const userRow = dbx.prepare("SELECT username FROM users WHERE user_id = ?").get(notifyTgId2 || 0) as any;
        const uname = String(userRow?.username || "");
        if (uname) {
          contactKeyboard.push([{ text: "💬 Написать курьеру", url: `tg://resolve?domain=${uname.replace("@","")}` }]);
        } else if (notifyTgId2) {
          contactKeyboard.push([{ text: "💬 Написать курьеру", url: `tg://user?id=${notifyTgId2}` }]);
        }
      } catch {}
      contactKeyboard.push([{ text: "🏠 Главное меню", callback_data: encodeCb("back:main") }]);
      await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: contactKeyboard }, parse_mode: "HTML" });
      try { userStates.delete(user_id); userRerollCount.delete(user_id); } catch {}
    } else if (data.startsWith("gam_upsell_add:")) {
      const pid = Number(data.split(":")[1]);
      const products = await getProducts();
      const p = products.find((x) => x.product_id === pid);
      if (!p) return;
      const itemsBefore = carts.get(user_id) || [];
      const currentQty = (itemsBefore.find((x) => x.product_id === pid)?.qty || 0);
      if (!p.active || p.qty_available <= currentQty) {
        await bot.answerCallbackQuery({ callback_query_id: q.id, text: "❌ Товар закончился" }).catch(()=>{});
        return;
      }
      const price = p.category === "liquids" ? (await currentUnitPrice(user_id, products)) : p.price;
      addToCart(user_id, p, true, price);
      try {
        const dbx = getDb();
        dbx.prepare("INSERT INTO upsell_events(user_id, product_id, event_type, timestamp) VALUES (?,?,?,?)").run(user_id, pid, "accepted", Date.now());
      } catch {}
      const items = carts.get(user_id) || [];
      const totals = await previewTotals(user_id, items);
      const savingsNow = await computeSavings(items, products);
      const msg = `✅ ${p.title} добавлен!\n\n💰 Итог: ${totals.total_with_discount.toFixed(2)} €${savingsNow>0?`\n💚 Экономия: ${savingsNow.toFixed(2)} €`:''}\n\n━━━━━━━━━━━━━━━━`;
      try { await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "HTML" }); } catch {}
      // reset rerolls and show next upsell cycle (limit overall to 5)
      const totalUpsells = items.reduce((s,i)=>s+(i.is_upsell?i.qty:0),0);
      upsellRerolls.set(user_id, 0);
      const exclude = new Set(items.map(i=>i.product_id));
      if (p.category === "liquids" && totalUpsells < 5) {
        try { await showGamifiedUpsellInline(bot, chatId, messageId, user_id, "liquids", exclude); } catch {}
      }
    } else if (data.startsWith("gam_upsell_reroll:") || data.startsWith("fortune_reroll:")) {
      const category = data.split(":")[1] as "liquids" | "electronics";
      const cur = upsellRerolls.get(user_id) || 0;
      upsellRerolls.set(user_id, cur + 1);
      try { getDb().prepare("INSERT INTO upsell_events(user_id, product_id, event_type, timestamp) VALUES (?,?,?,?)").run(user_id, 0, "reroll", Date.now()); } catch {}
      const products2 = await getProducts();
      const items2 = carts.get(user_id) || [];
      const totals2 = await previewTotals(user_id, items2);
      const savings2 = await computeSavings(items2, products2);
      const spin = `✅ Корзина:\n${renderCart(items2, products2)}\n\n💰 Итог: ${totals2.total_with_discount.toFixed(2)} €${savings2>0?`\n💚 Экономия: ${savings2.toFixed(2)} €`:''}\n\n━━━━━━━━━━━━━━━━\n🎰 Крутим фортуну...\n\n⏳ Подбираем новые вкусы для тебя...`;
      try { await bot.editMessageText(spin, { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: { inline_keyboard: [] } }); } catch {}
      setTimeout(async () => {
        const st = userStates.get(user_id);
        const prevEx = Array.isArray(st?.data?.excludeSkus) ? st.data.excludeSkus : [];
        const prevShown = Array.isArray(st?.data?.shown) ? st.data.shown : [];
        const allEx = Array.from(new Set<number>([...prevEx, ...prevShown]));
        await showHybridUpsellWithGuidance(bot, chatId, messageId, user_id, category, allEx);
      }, 800);
    } else if (data.startsWith("fortune_add:")) {
      const pid = Number(data.split(":")[1]);
      const products = await getProducts();
      const p = products.find((x) => x.product_id === pid);
      if (!p) return;
      const items3 = carts.get(user_id) || [];
      const currentQty3 = (items3.find((x) => x.product_id === pid)?.qty || 0);
      if (!p.active || p.qty_available <= currentQty3) {
        await bot.answerCallbackQuery({ callback_query_id: q.id, text: "❌ Товар закончился" }).catch(()=>{});
        return;
      }
      const itemsFortune = carts.get(user_id) || [];
      let liquCount3 = 0; for (const it of itemsFortune) { const ip = products.find((x) => x.product_id === it.product_id); if (ip && ip.category === "liquids") liquCount3 += it.qty; }
      const price3 = p.category === "liquids" ? (liquCount3 >= 2 ? 15 : 16) : p.price;
      addToCart(user_id, p, true, price3);
      try { getDb().prepare("INSERT INTO upsell_events(user_id, product_id, event_type, timestamp) VALUES (?,?,?,?)").run(user_id, pid, "accepted", Date.now()); } catch {}
      upsellRerolls.set(user_id, 0);
      const st3 = userStates.get(user_id);
      const prevEx3 = Array.isArray(st3?.data?.excludeSkus) ? st3.data.excludeSkus : [];
      await showHybridUpsellWithGuidance(bot, chatId, messageId, user_id, p.category, Array.from(new Set<number>([...prevEx3, pid])));
    } else if (data.startsWith("catalog_add:")) {
      const pid = Number(data.split(":")[1]);
      const products = await getProducts();
      try { console.log("🔍 Callback(catalog_add):", data, "pid:", pid, "type:", typeof pid); } catch {}
      const p = products.find((x) => x.product_id === pid);
      try { console.log("🔍 Found product:", p ? { id: p.product_id, name: p.title, category: p.category } : "NOT FOUND"); } catch {}
      if (!p) return;
      const items4 = carts.get(user_id) || [];
      const currentQty4 = (items4.find((x) => x.product_id === pid)?.qty || 0);
      if (!p.active || p.qty_available <= currentQty4) {
        await bot.answerCallbackQuery({ callback_query_id: q.id, text: "❌ Товар закончился" }).catch(()=>{});
        return;
      }
      const itemsCatAdd = carts.get(user_id) || [];
      let liquCount4 = 0; for (const it of itemsCatAdd) { const ip = products.find((x) => x.product_id === it.product_id); if (ip && ip.category === "liquids") liquCount4 += it.qty; }
      const price4 = p.category === "liquids" ? (liquCount4 >= 2 ? 15 : 16) : p.price;
      addToCart(user_id, p, true, price4);
      try { getDb().prepare("INSERT INTO upsell_events(user_id, product_id, event_type, timestamp) VALUES (?,?,?,?)").run(user_id, pid, "accepted", Date.now()); } catch {}
      upsellRerolls.set(user_id, 0);
      const st4 = userStates.get(user_id);
      const prevEx4 = Array.isArray(st4?.data?.excludeSkus) ? st4.data.excludeSkus : [];
      await showHybridUpsellWithGuidance(bot, chatId, messageId, user_id, p.category, Array.from(new Set<number>([...prevEx4, pid])));
    } else if (data.startsWith("upsell_catalog:")) {
      const [, category, priceStr] = data.split(":");
      const price = Number(priceStr);
      await showUpsellCatalog(bot, chatId, messageId, user_id, category as "liquids" | "electronics", price);
    }
  });
}
function couriersByTgId(ids: number[], list: { tg_id: number }[]) {
  const set = new Set(ids);
  return list.filter((c) => set.has(c.tg_id));
}

async function showCart(bot: TelegramBot, chatId: number, user_id: number, messageId?: number) {
  const items = carts.get(user_id) || [];
  const products = await getProducts();
  const totals = await previewTotals(user_id, items);
  let savings = 0;
  for (const i of items) {
    const p = products.find((x) => x.product_id === i.product_id);
    if (p && p.category === "liquids" && i.price < 18) savings += (18 - i.price) * i.qty;
  }
  savings = Math.round(savings * 100) / 100;
  let liquCount = 0;
  for (const it of items) {
    const p = products.find((x) => x.product_id === it.product_id);
    if (p && p.category === "liquids") liquCount += it.qty;
  }
  const offer = (async () => {
    if (liquCount === 0) return "";
    if (liquCount === 1) {
      const unit2 = await getLiquidUnitPrice(2, shopConfig.cityCode);
      const unit1 = await getLiquidUnitPrice(1, shopConfig.cityCode);
      const total2 = unit2 * 2;
      const save = Math.max(0, Math.round((unit1 * 2 - total2)));
      return `Добавьте ещё 1 для <b>${total2.toFixed(2)} €</b> (экономия ${save} €)`;
    }
    if (liquCount === 2) {
      const unit3 = await getLiquidUnitPrice(3, shopConfig.cityCode);
      const unit1 = await getLiquidUnitPrice(1, shopConfig.cityCode);
      const total3 = unit3 * 3;
      const save = Math.max(0, Math.round((unit1 * 3 - total3)));
      return `Добавьте ещё 1 для <b>${total3.toFixed(2)} €</b> (экономия ${save} €)`;
    }
    const unitN = await getLiquidUnitPrice(liquCount, shopConfig.cityCode);
    return `Цена за жидкость: <b>${unitN.toFixed(2)} €</b>`;
  })();
  const lines = items.map((i) => {
    const p = products.find((x) => x.product_id === i.product_id);
    const t = p ? p.title : `#${i.product_id}`;
    const icon = p && p.category === "electronics" ? "💨" : "💧";
    return `${icon} ${t} · ${i.price.toFixed(2)} € x${i.qty}`;
  }).join("\n") || "Корзина пустая";
  const kb: TelegramBot.InlineKeyboardButton[][] = [];
  for (const i of items.slice(0, 10)) {
    kb.push([
      { text: `➖1`, callback_data: encodeCb(`cart_sub:${i.product_id}:1`) },
      { text: `➖2`, callback_data: encodeCb(`cart_sub:${i.product_id}:2`) },
      { text: `➕1`, callback_data: encodeCb(`cart_add:${i.product_id}:1`) },
      { text: `➕2`, callback_data: encodeCb(`cart_add:${i.product_id}:2`) },
      { text: `🗑️`, callback_data: encodeCb(`cart_del:${i.product_id}`) }
    ]);
  }
  try {
    const pool = products.filter((x) => x.active && x.category === "liquids" && !items.find((i) => i.product_id === x.product_id));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const pick = pool.slice(0, 2);
    const unitNext = await getLiquidUnitPrice(liquCount + 1, shopConfig.cityCode);
    kb.unshift(pick.map((p) => ({ text: `🔥 ${p.title}${p.qty_available>0&&p.qty_available<=3?` (только ${p.qty_available}❗️)`:''} — ${unitNext.toFixed(2)} €`, callback_data: encodeCb(`add_upsell:${p.product_id}`) })));
  } catch {}
  kb.push([{ text: `✅ Оформить заказ · ${totals.total_with_discount.toFixed(2)} €`, callback_data: encodeCb("confirm_order_start") }]);
  kb.push([{ text: "⬅️ Назад", callback_data: encodeCb("back:main") }]);
  const text = `<b>Корзина</b> 🛒\n${lines}\n\nИтого: <b>${totals.total_with_discount.toFixed(2)} €</b>${savings > 0 ? `\nЭкономия: <b>${savings.toFixed(2)} €</b>` : ""}${offer ? `\n\n${await offer}` : ""}`;
  if (typeof messageId === "number") await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: kb }, parse_mode: "HTML" });
  else await bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: kb }, parse_mode: "HTML" });
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

async function showGamifiedUpsellInline(bot: TelegramBot, chatId: number, messageId: number, user_id: number, category: string, exclude: Set<number>) {
  const rerollCount = upsellRerolls.get(user_id) || 0;
  if (rerollCount >= 3) {
    const kb: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "✅ Оформить заказ", callback_data: encodeCb("confirm_order") }],
      [{ text: "🛒 Корзина", callback_data: encodeCb("cart_open") }]
    ];
    await bot.editMessageText("🔥 Отличный выбор!", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: kb } });
    return;
  }
  const all = await refreshProductsCache();
  const items = carts.get(user_id) || [];
  const inCart = new Set(items.map(i=>i.product_id));
  const pool = all.filter(p => p.active && p.category === category && !inCart.has(p.product_id) && !exclude.has(p.product_id));
  if (pool.length < 2) {
    const kb: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "✅ Оформить заказ", callback_data: encodeCb("confirm_order") }],
      [{ text: "🛒 Корзина", callback_data: encodeCb("cart_open") }]
    ];
    await bot.editMessageText("🔥 Отличный выбор!", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: kb } });
    return;
  }
  const pick = shuffle(pool).slice(0, 2);
  const shown = upsellShown.get(user_id) || new Set<number>();
  for (const s of pick) shown.add(s.product_id);
  upsellShown.set(user_id, shown);
  try {
    const dbx = getDb();
    for (const s of pick) dbx.prepare("INSERT INTO upsell_events(user_id, product_id, event_type, timestamp) VALUES (?,?,?,?)").run(user_id, s.product_id, "offered", Date.now());
  } catch {}
  const rerollsLeft = 3 - rerollCount;
  const totals = await previewTotals(user_id, items);
  const savingsNow = await computeSavings(items, all);
  let liquCount = 0;
  for (const it of items) {
    const p = all.find((x)=>x.product_id===it.product_id);
    if (p && p.category === "liquids") liquCount += it.qty;
  }
  const nextUnitDyn = await getLiquidUnitPrice(liquCount + 1, shopConfig.cityCode);
  const base1 = await getLiquidUnitPrice(1, shopConfig.cityCode);
  const p3 = await getLiquidUnitPrice(3, shopConfig.cityCode);
  const motivation = liquCount === 0
    ? `🔥 Следующий вкус — всего ${nextUnitDyn.toFixed(2)} € (вместо ${base1.toFixed(2)} €)`
    : (liquCount === 1 ? `🔥 Следующий вкус — всего ${nextUnitDyn.toFixed(2)} € (вместо ${base1.toFixed(2)} €)`
    : (liquCount === 2 ? `🔥 От 3 шт — по ${p3.toFixed(2)} € каждая!`
    : `🔥 Все вкусы по ${p3.toFixed(2)} €!`));
  const cartLines = renderCart(items, all);
  const header = `${cartLines}\n\n💰 Итог: ${totals.total_with_discount.toFixed(2)} €${savingsNow>0?`\n💚 Экономия: ${savingsNow.toFixed(2)} €`:''}\n${motivation}\n\n━━━━━━━━━━━━━━━━`;
  const msg = `${header}\n🎲 Попробуй эти вкусы:\n🎰 Рероллов осталось: ${rerollsLeft}`;
  const unitNext = (await getLiquidUnitPrice(liquCount + 1, shopConfig.cityCode)).toFixed(2) + " €";
  const kb: TelegramBot.InlineKeyboardButton[][] = [
    [{ text: `💧 ${pick[0].title} — ${category==="liquids"?unitNext:fmtMoney(pick[0].price)}`, callback_data: encodeCb(`gam_upsell_add:${pick[0].product_id}`) }],
    [{ text: `💧 ${pick[1].title} — ${category==="liquids"?unitNext:fmtMoney(pick[1].price)}`, callback_data: encodeCb(`gam_upsell_add:${pick[1].product_id}`) }]
  ];
  if (rerollCount < 3) kb.push([{ text: "🎲 Реролл (другие вкусы)", callback_data: encodeCb(`gam_upsell_reroll:${category}`) }]);
  kb.push([{ text: "✅ Оформить заказ", callback_data: encodeCb("confirm_order") }]);
  kb.push([{ text: "🛒 Корзина", callback_data: encodeCb("cart_open") }]);
  await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: kb } });
}

async function currentUnitPrice(user_id: number, products: Product[]): Promise<number> {
  const items = carts.get(user_id) || [];
  let liquCount = 0;
  for (const it of items) {
    const p = products.find((x)=>x.product_id===it.product_id);
    if (p && p.category === "liquids") liquCount += it.qty;
  }
  let base = await getLiquidUnitPrice(liquCount, shopConfig.cityCode);
  const seg = getUserSegment(user_id);
  if (seg === "sale10") base = Math.round(base * 0.9 * 100) / 100;
  return base;
}

async function computeSavings(items: OrderItem[], products: Product[]): Promise<number> {
  const baseline = await getLiquidUnitPrice(1, shopConfig.cityCode);
  let s = 0;
  for (const it of items) {
    const ip = products.find((x)=>x.product_id===it.product_id);
    if (ip && ip.category === "liquids" && it.price < baseline) s += (baseline - it.price) * it.qty;
  }
  return Math.round(s * 100) / 100;
}
