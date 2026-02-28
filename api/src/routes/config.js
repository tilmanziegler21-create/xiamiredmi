import express from 'express';
import db from '../services/database.js';

const router = express.Router();

function listCities() {
  const raw = String(process.env.CITY_CODES || '').trim();
  if (!raw) return ['MU'];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function currencySymbol() {
  const fromEnv = String(process.env.CURRENCY_SYMBOL || '').trim();
  if (fromEnv) return fromEnv;
  const c = String(process.env.CURRENCY || '').trim().toUpperCase();
  if (c === 'EUR') return '€';
  if (c === 'PLN') return 'zł';
  if (c === 'USD') return '$';
  if (c === 'GBP') return '£';
  return '₽';
}

function pickupPoints() {
  try {
    const raw = String(process.env.PICKUP_POINTS_JSON || '').trim();
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((p, i) => ({
            id: String(p?.id || `p${i + 1}`),
            title: String(p?.title || p?.address || ''),
            address: String(p?.address || p?.title || ''),
          }))
          .filter((p) => p.title && p.address);
      }
    }
  } catch {
  }
  return [
    { id: 'p1', title: 'ul. Krucza 03, Śródmieście', address: 'ul. Krucza 03, Śródmieście' },
    { id: 'p2', title: 'ul. Optyków 7A, Praga-Południe', address: 'ul. Optyków 7A, Praga-Południe' },
    { id: 'p3', title: "ul. Tagore'a 1, Mokotów", address: "ul. Tagore'a 1, Mokotów" },
    { id: 'p4', title: 'ul. Ordona-WSA, Wola', address: 'ul. Ordona-WSA, Wola' },
  ];
}

router.get('/', (_req, res) => {
  const codes = listCities();
  const supportUrl = process.env.GROUP_URL || process.env.REVIEWS_URL || '';
  const bonusMultiplier = Number(process.env.BONUS_MULTIPLIER || 4);
  const quantityDiscount = {
    minQty: Number(process.env.QTY_DISCOUNT_MIN || process.env.QUANTITY_DISCOUNT_MIN_QTY || 3),
    unitPrice: Number(process.env.QTY_DISCOUNT_PRICE || process.env.QUANTITY_DISCOUNT_UNIT_PRICE || 40),
  };
  const now = Date.now();
  const promos = db.getPromos().filter((p) => {
    if (!p || !p.active) return false;
    const s = p.startsAt ? Date.parse(String(p.startsAt)) : NaN;
    const e = p.endsAt ? Date.parse(String(p.endsAt)) : NaN;
    if (Number.isFinite(s) && s > now) return false;
    if (Number.isFinite(e) && e < now) return false;
    return true;
  });
  res.json({
    cities: codes.map((code) => ({
      code,
      title: code,
      currencySymbol: currencySymbol(),
      managerChatUrl: supportUrl,
    })),
    cityCodes: codes,
    currency: process.env.CURRENCY || 'RUB',
    currencySymbol: currencySymbol(),
    groupUrl: process.env.GROUP_URL || '',
    reviewsUrl: process.env.REVIEWS_URL || '',
    reservationTtlMs: Number(process.env.RESERVATION_TTL_MS || 30 * 60 * 1000),
    support: {
      managerUsername: process.env.MANAGER_USERNAME || '',
      managerPhone: process.env.MANAGER_PHONE || '',
      supportUrl,
      faqBlocks: [
        { title: 'Доставка', text: 'Доставка 24/7 (при наличии курьеров). Если курьеров нет — самовывоз.' },
        { title: 'Оплата', text: 'Оплата наличными или переводом (уточняйте у менеджера).' },
        { title: 'Возврат', text: 'По вопросам возврата и брака — напишите менеджеру.' },
      ],
    },
    banners: [
      {
        title: 'НОВИНКИ В НАЛИЧИИ',
        subtitle: 'ELFCHERRY • 24/7',
        gradient: 'linear-gradient(135deg, rgba(255,45,85,0.90) 0%, rgba(176,0,58,0.78) 100%)',
        imageUrl: '/assets/elfcherry/banners/banner-1.jpg',
        linkType: 'category',
        linkTarget: 'Новинки',
      },
      {
        title: 'ЖИДКОСТИ',
        subtitle: 'Подборка вкусов • 24/7',
        gradient: 'linear-gradient(135deg, rgba(255,45,85,0.78) 0%, rgba(15,12,26,0.82) 100%)',
        imageUrl: '/assets/elfcherry/categories/category-liquids.jpg',
        linkType: 'category',
        linkTarget: 'Жидкости',
      },
      {
        title: 'ХИТЫ НЕДЕЛИ',
        subtitle: 'Топ продаж и рекомендации',
        gradient: 'linear-gradient(135deg, rgba(255,168,0,0.55) 0%, rgba(255,45,85,0.78) 100%)',
        imageUrl: '/assets/elfcherry/banners/banner-2.jpg',
        linkType: 'category',
        linkTarget: 'Хиты',
      },
      {
        title: 'ОДНОРАЗКИ',
        subtitle: 'Готовые устройства • в наличии',
        gradient: 'linear-gradient(135deg, rgba(176,0,58,0.72) 0%, rgba(0,0,0,0.82) 100%)',
        imageUrl: '/assets/elfcherry/categories/category-disposables.jpg',
        linkType: 'category',
        linkTarget: 'Одноразки',
      },
      {
        title: 'ПОДДЕРЖКА',
        subtitle: 'Менеджер ответит в чате',
        gradient: 'linear-gradient(135deg, rgba(255,77,109,0.86) 0%, rgba(255,45,85,0.72) 100%)',
        imageUrl: '/assets/elfcherry/banners/banner-3.jpg',
        linkType: 'url',
        linkTarget: supportUrl,
      },
    ],
    categoryTiles: [
      { slug: 'Жидкости', title: 'ЖИДКОСТИ', imageUrl: '/assets/elfcherry/categories/category-liquids.jpg', badgeText: 'NEW DROP' },
      { slug: 'Одноразки', title: 'ОДНОРАЗКИ', imageUrl: '/assets/elfcherry/categories/category-disposables.jpg', badgeText: 'HOT' },
      { slug: 'Поды', title: 'ПОДЫ', imageUrl: '/assets/elfcherry/categories/category-pods.jpg', badgeText: 'PREMIUM' },
      { slug: 'Картриджи', title: 'КАРТРИДЖИ', imageUrl: '/assets/elfcherry/categories/category-cartridges.jpg', badgeText: 'TOP' },
    ],
    pickupPoints: pickupPoints(),
    referralRules: {
      title: 'ПРИГЛАСИТЕ 2 РЕФЕРАЛА',
      description: 'За каждых двух друзей, которые совершают покупку, вы получите бонус на баланс.',
      ctaText: 'ПРИГЛАСИТЬ ДРУГА',
    },
    bonusMultiplier,
    quantityDiscount,
    promos: promos.map((p) => ({
      id: String(p.id || ''),
      title: String(p.title || ''),
      description: String(p.description || ''),
      type: String(p.type || ''),
      value: Number(p.value || 0),
      minTotal: Number(p.minTotal || 0),
      startsAt: String(p.startsAt || ''),
      endsAt: String(p.endsAt || ''),
    })),
    contests: [
      {
        id: 'WHEEL',
        title: 'КОЛЕСО ФОРТУНЫ',
        description: 'Крутите колесо и получайте бонусы на баланс.',
        ctaText: 'Крутить',
        route: '/fortune',
      },
    ],
  });
});

export default router;
