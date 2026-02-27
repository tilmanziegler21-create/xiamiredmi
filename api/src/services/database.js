// Simple in-memory database for development
import fs from 'fs';
import path from 'path';

class InMemoryDB {
  constructor() {
    this.users = new Map();
    this.carts = new Map();
    this.cartItems = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.products = new Map();
    this.reservations = new Map();
    this.favorites = new Map();
    this.bonusLedger = [];
    this.analyticsEvents = [];
    this.promos = new Map();

    this.dataFilePath = path.resolve(process.cwd(), 'api/.data/mockdb.json');
    
    this.ensureDataDir();
    // Initialize with mock data
    this.initMockData();
    this.loadPersistedState();
  }

  ensureDataDir() {
    try {
      fs.mkdirSync(path.dirname(this.dataFilePath), { recursive: true });
    } catch {
      // ignore
    }
  }

  loadPersistedState() {
    try {
      if (!fs.existsSync(this.dataFilePath)) return;
      const raw = fs.readFileSync(this.dataFilePath, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      const users = Array.isArray(parsed.users) ? parsed.users : [];
      for (const u of users) {
        if (!u?.tg_id) continue;
        this.users.set(String(u.tg_id), u);
      }
      const favorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];
      for (const f of favorites) {
        if (!f?.id || !f?.user_id || !f?.product_id) continue;
        this.favorites.set(String(f.id), f);
      }
      const bonusLedger = Array.isArray(parsed.bonusLedger) ? parsed.bonusLedger : [];
      this.bonusLedger = bonusLedger;

      const orders = Array.isArray(parsed.orders) ? parsed.orders : [];
      for (const o of orders) {
        if (!o?.id || !o?.user_id) continue;
        this.orders.set(String(o.id), o);
      }
      const orderItems = Array.isArray(parsed.orderItems) ? parsed.orderItems : [];
      for (const oi of orderItems) {
        if (!oi?.id || !oi?.order_id) continue;
        this.orderItems.set(String(oi.id), oi);
      }

      const carts = Array.isArray(parsed.carts) ? parsed.carts : [];
      for (const c of carts) {
        if (!c?.id || !c?.user_id || !c?.city) continue;
        this.carts.set(String(c.id), c);
      }
      const cartItems = Array.isArray(parsed.cartItems) ? parsed.cartItems : [];
      for (const ci of cartItems) {
        if (!ci?.id || !ci?.cart_id || !ci?.product_id) continue;
        this.cartItems.set(String(ci.id), ci);
      }
      const reservations = Array.isArray(parsed.reservations) ? parsed.reservations : [];
      for (const r of reservations) {
        if (!r?.id || !r?.order_id || !r?.product_id) continue;
        this.reservations.set(String(r.id), r);
      }

      const promos = Array.isArray(parsed.promos) ? parsed.promos : [];
      for (const p of promos) {
        if (!p?.id) continue;
        this.promos.set(String(p.id), p);
      }
    } catch {
      // ignore
    }
  }

  persistState() {
    try {
      this.ensureDataDir();
      const payload = {
        users: Array.from(this.users.values()),
        favorites: Array.from(this.favorites.values()),
        bonusLedger: this.bonusLedger,
        orders: Array.from(this.orders.values()),
        orderItems: Array.from(this.orderItems.values()),
        carts: Array.from(this.carts.values()),
        cartItems: Array.from(this.cartItems.values()),
        reservations: Array.from(this.reservations.values()),
        promos: Array.from(this.promos.values()),
      };
      fs.writeFileSync(this.dataFilePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }

  initMockData() {
    // Mock products
    const mockProducts = [
      {
        id: '1',
        name: 'Elf Bar BC5000',
        category: 'Одноразки',
        brand: 'Elf Bar',
        price: 1299,
        qtyAvailable: 25,
        active: true,
        tasteProfile: JSON.stringify({
          sweetness: 4,
          coolness: 3,
          fruitiness: 5,
          strength: 4
        }),
        description: 'Одноразовая электронная сигарета с 5000 затяжками',
        image: 'https://via.placeholder.com/300x300'
      },
      {
        id: '2',
        name: 'HQD Cuvie Plus',
        category: 'Одноразки',
        brand: 'HQD',
        price: 1099,
        qtyAvailable: 18,
        active: true,
        tasteProfile: JSON.stringify({
          sweetness: 3,
          coolness: 2,
          fruitiness: 4,
          strength: 3
        }),
        description: 'Компактная одноразка с 1200 затяжками',
        image: 'https://via.placeholder.com/300x300'
      },
      {
        id: '3',
        name: 'SaltNic Жидкость',
        category: 'Жидкости',
        brand: 'SaltNic',
        price: 599,
        qtyAvailable: 50,
        active: true,
        tasteProfile: JSON.stringify({
          sweetness: 2,
          coolness: 1,
          fruitiness: 3,
          strength: 5
        }),
        description: 'Солевая жидкость 30мл, крепость 50mg',
        image: 'https://via.placeholder.com/300x300'
      },
      {
        id: '4',
        name: 'Voopoo Vinci',
        category: 'Аксессуары',
        brand: 'Voopoo',
        price: 2499,
        qtyAvailable: 8,
        active: true,
        tasteProfile: null,
        description: 'Под-система с регулировкой мощности',
        image: 'https://via.placeholder.com/300x300'
      }
    ];

    mockProducts.forEach(product => {
      this.products.set(product.id, product);
    });

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const promos = [
      {
        id: 'WELCOME10',
        title: 'WELCOME10',
        description: 'Скидка 10% на заказ',
        type: 'percent',
        value: 10,
        minTotal: 0,
        active: true,
        startsAt: new Date(now - day).toISOString(),
        endsAt: new Date(now + 30 * day).toISOString(),
      },
      {
        id: 'ELF20',
        title: 'ELF20',
        description: 'Скидка 20% на заказ от 50€',
        type: 'percent',
        value: 20,
        minTotal: 50,
        active: true,
        startsAt: new Date(now - day).toISOString(),
        endsAt: new Date(now + 30 * day).toISOString(),
      },
    ];
    for (const p of promos) this.promos.set(String(p.id), p);
  }

  prepare(query) {
    return {
      run: (...params) => this.executeRun(query, params),
      get: (...params) => this.executeGet(query, params),
      all: (...params) => this.executeAll(query, params)
    };
  }

  executeRun(query, params) {
    // Simple execution for INSERT/UPDATE/DELETE
    if (query.includes('INSERT OR IGNORE INTO users')) {
      const [tgId, username, firstName, lastName, ageVerified, status] = params;
      const existing = this.users.get(String(tgId));
      if (!existing) {
        this.users.set(String(tgId), {
          tg_id: String(tgId),
          username: String(username || ''),
          first_name: String(firstName || ''),
          last_name: String(lastName || ''),
          age_verified: Boolean(Number(ageVerified) ? 1 : 0),
          status: String(status || 'regular'),
          bonus_balance: 0,
          referred_by: '',
          referral_claimed_at: '',
          referral_conversions: 0,
          first_paid_order_at: '',
          fortune_date: '',
          fortune_used: 0,
          created_at: new Date().toISOString(),
        });
        this.persistState();
      }
    } else if (query.includes('UPDATE users SET username=?') && query.includes('WHERE tg_id=?')) {
      const [username, firstName, lastName, status, tgId] = params;
      const user = this.users.get(String(tgId));
      if (user) {
        user.username = String(username || user.username || '');
        user.first_name = String(firstName || user.first_name || '');
        user.last_name = String(lastName || user.last_name || '');
        user.status = String(status || user.status || 'regular');
        this.users.set(String(tgId), user);
        this.persistState();
      }
    } else if (query.includes('INSERT OR REPLACE INTO users')) {
      const [tgId, username, firstName, lastName, ageVerified, status] = params;
      const prev = this.users.get(tgId);
      this.users.set(tgId, {
        tg_id: tgId,
        username,
        first_name: firstName,
        last_name: lastName,
        age_verified: typeof ageVerified === 'undefined' ? Boolean(prev?.age_verified) : Boolean(ageVerified),
        status: String(status || prev?.status || 'regular'),
        bonus_balance: Number(prev?.bonus_balance || 0),
        referred_by: String(prev?.referred_by || ''),
        referral_claimed_at: String(prev?.referral_claimed_at || ''),
        referral_conversions: Number(prev?.referral_conversions || 0),
        first_paid_order_at: String(prev?.first_paid_order_at || ''),
        fortune_date: String(prev?.fortune_date || ''),
        fortune_used: Number(prev?.fortune_used || 0),
        created_at: String(prev?.created_at || new Date().toISOString())
      });
      this.persistState();
    } else if (query.includes('UPDATE users SET age_verified')) {
      const [ageVerified, tgId] = params;
      const user = this.users.get(tgId);
      if (user) {
        user.age_verified = ageVerified;
        this.persistState();
      }
    } else if (query.includes('UPDATE users SET bonus_balance')) {
      const [balance, tgId] = params;
      const user = this.users.get(String(tgId));
      if (user) {
        user.bonus_balance = Math.max(0, Number(balance || 0));
        this.users.set(String(tgId), user);
        this.persistState();
      }
    }
    return { changes: 1 };
  }

  executeGet(query, params) {
    if (query.includes('SELECT * FROM users WHERE tg_id = ?')) {
      const [tgId] = params;
      return this.users.get(tgId) || null;
    } else if (query.includes('SELECT * FROM carts WHERE user_id = ? AND city = ?')) {
      const [userId, city] = params;
      for (const cart of this.carts.values()) {
        if (cart.user_id === userId && cart.city === city) {
          return cart;
        }
      }
      return null;
    }
    return null;
  }

  executeAll(query, params) {
    if (query.includes('SELECT * FROM products')) {
      return Array.from(this.products.values()).filter(p => p.active && p.qtyAvailable > 0);
    } else if (query.includes('SELECT ci.*, p.name, p.category, p.brand, p.price as product_price, p.image')) {
      const [cartId] = params;
      const items = [];
      for (const item of this.cartItems.values()) {
        if (item.cart_id === cartId) {
          const product = this.products.get(item.product_id);
          if (product) {
            items.push({
              ...item,
              name: product.name,
              category: product.category,
              brand: product.brand,
              product_price: product.price,
              image: product.image
            });
          }
        }
      }
      return items;
    } else if (query.includes('SELECT o.*, COUNT(oi.id) as item_count')) {
      const [userId] = params;
      const orders = [];
      for (const order of this.orders.values()) {
        if (order.user_id === userId) {
          let itemCount = 0;
          for (const item of this.orderItems.values()) {
            if (item.order_id === order.id) {
              itemCount++;
            }
          }
          orders.push({
            ...order,
            item_count: itemCount
          });
        }
      }
      return orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return [];
  }

  // Helpers for reservations
  getActiveReservationsByProduct(productId) {
    const now = Date.now();
    const list = [];
    for (const r of this.reservations.values()) {
      if (r.product_id === productId && r.released === false && r.expiry_ms > now) {
        list.push(r);
      }
    }
    return list;
  }
  addReservation(orderId, productId, qty, ttlMs = 30 * 60 * 1000) {
    const id = Math.random().toString(36).substring(2, 15);
    const now = Date.now();
    this.reservations.set(id, {
      id,
      order_id: orderId,
      product_id: productId,
      qty,
      reserve_ms: now,
      expiry_ms: now + ttlMs,
      released: false,
    });
    this.persistState();
    return id;
  }
  releaseReservationsByOrder(orderId) {
    let changed = false;
    for (const r of this.reservations.values()) {
      if (r.order_id === orderId && r.released === false) {
        r.released = true;
        changed = true;
      }
    }
    if (changed) this.persistState();
  }


  exec(query) {
    // Schema initialization - no-op for in-memory
    console.log('Executing schema query:', query.substring(0, 50) + '...');
  }

  cleanupExpiredReservations() {
    const now = Date.now();
    const expiredOrders = new Set();
    let changed = false;
    for (const r of this.reservations.values()) {
      if (r.released === false && r.expiry_ms <= now) {
        r.released = true;
        expiredOrders.add(r.order_id);
        changed = true;
      }
    }
    if (changed) this.persistState();
    return { expiredOrders: Array.from(expiredOrders) };
  }

  getFavorites(tgId) {
    return Array.from(this.favorites.values()).filter((x) => x.user_id === tgId);
  }

  setFavorite(tgId, productId, enabled, snapshot) {
    const key = `${tgId}:${productId}`;
    if (!enabled) {
      this.favorites.delete(key);
      this.persistState();
      return;
    }
    const existing = this.favorites.get(key);
    this.favorites.set(key, {
      id: key,
      user_id: tgId,
      product_id: String(productId),
      created_at: existing?.created_at || new Date().toISOString(),
      snapshot: snapshot || existing?.snapshot || null,
    });
    this.persistState();
  }

  addBonusEvent(evt) {
    this.bonusLedger.push({ ...evt, id: Math.random().toString(36).substring(2, 15) });
    this.persistState();
  }

  getBonusHistory(tgId) {
    return this.bonusLedger.filter((x) => x.user_id === tgId).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  getPromos() {
    return Array.from(this.promos.values());
  }

  setPromoActive(promoId, active) {
    const p = this.promos.get(String(promoId));
    if (!p) return false;
    p.active = Boolean(active);
    this.promos.set(String(promoId), p);
    this.persistState();
    return true;
  }

  getPromoById(promoId) {
    const p = this.promos.get(String(promoId));
    return p || null;
  }

  deletePromo(promoId) {
    const ok = this.promos.delete(String(promoId));
    if (ok) this.persistState();
    return ok;
  }

  upsertPromo(promo) {
    const id = String(promo?.id || '').trim();
    if (!id) return false;
    const prev = this.promos.get(id) || {};
    const next = {
      ...prev,
      ...promo,
      id,
      title: String(promo?.title ?? prev?.title ?? id),
      description: String(promo?.description ?? prev?.description ?? ''),
      type: String(promo?.type ?? prev?.type ?? 'percent'),
      value: Number(promo?.value ?? prev?.value ?? 0),
      minTotal: Number(promo?.minTotal ?? prev?.minTotal ?? 0),
      startsAt: String(promo?.startsAt ?? prev?.startsAt ?? ''),
      endsAt: String(promo?.endsAt ?? prev?.endsAt ?? ''),
      active: Boolean(promo?.active ?? prev?.active ?? false),
    };
    this.promos.set(id, next);
    this.persistState();
    return true;
  }

  getUser(tgId) {
    return this.users.get(String(tgId)) || null;
  }

  setUser(tgId, patch) {
    const u = this.users.get(String(tgId));
    if (!u) return false;
    this.users.set(String(tgId), { ...u, ...patch });
    this.persistState();
    return true;
  }

  addBonusDelta(tgId, delta, type, meta) {
    const u = this.users.get(String(tgId));
    if (!u) return false;
    const next = Number(u.bonus_balance || 0) + Number(delta || 0);
    u.bonus_balance = Math.max(0, Math.round(next * 100) / 100);
    this.users.set(String(tgId), u);
    this.addBonusEvent({
      user_id: String(tgId),
      type: String(type || 'adjustment'),
      amount: Number(delta || 0),
      meta: meta || {},
      created_at: new Date().toISOString(),
    });
    this.persistState();
    return true;
  }

  claimReferral(tgId, refTgId) {
    const userId = String(tgId);
    const refId = String(refTgId || '').trim();
    if (!refId) return { ok: false, error: 'Invalid ref' };
    if (refId === userId) return { ok: false, error: 'Self ref' };
    const u = this.users.get(userId);
    const ref = this.users.get(refId);
    if (!u) return { ok: false, error: 'User not found' };
    if (!ref) return { ok: false, error: 'Referrer not found' };
    if (String(u.referred_by || '').trim()) return { ok: true, already: true };
    u.referred_by = refId;
    u.referral_claimed_at = new Date().toISOString();
    this.users.set(userId, u);
    this.persistState();
    return { ok: true, already: false };
  }

  getFortuneState(tgId, dateKey) {
    const u = this.users.get(String(tgId));
    if (!u) return null;
    const d = String(dateKey || '');
    const used = String(u.fortune_date || '') === d ? Number(u.fortune_used || 0) : 0;
    return { date: d, used };
  }

  setFortuneUsed(tgId, dateKey, used) {
    const u = this.users.get(String(tgId));
    if (!u) return false;
    u.fortune_date = String(dateKey || '');
    u.fortune_used = Number(used || 0);
    this.users.set(String(tgId), u);
    this.persistState();
    return true;
  }

  addAnalyticsEvent(evt) {
    this.analyticsEvents.push({ ...evt, id: Math.random().toString(36).substring(2, 15) });
  }
}

const db = new InMemoryDB();
export default db;
