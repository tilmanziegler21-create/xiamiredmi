import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { Truck, Store, X } from 'lucide-react';
import { bonusesAPI, cartAPI, couriersAPI, orderAPI } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { useAnalytics } from '../hooks/useAnalytics';
import { GlassCard, PrimaryButton, SecondaryButton, SectionDivider, theme } from '../ui';
import { useToastStore } from '../store/useToastStore';
import { formatCurrency } from '../lib/currency';
import { useCityStore } from '../store/useCityStore';
import { useConfigStore } from '../store/useConfigStore';

type DeliveryMethod = 'courier' | 'pickup';

type LocationState = {
  fulfillment?: 'delivery' | 'pickup';
  pickup?: string;
  promoCode?: string;
  courierId?: string;
  deliveryTime?: string;
  deliveryDate?: string;
};

type PaymentMethod = 'cash' | 'card';

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const loc = useLocation();
  const toast = useToastStore();
  const { user } = useAuthStore();
  const { cart, setCart, isLoading: cartLoading, setLoading: setCartLoading } = useCartStore();
  const { trackCheckout, trackOrderComplete } = useAnalytics();

  const state = (loc.state || {}) as LocationState;
  const { city } = useCityStore();
  const { config } = useConfigStore();
  const [loading, setLoading] = React.useState(false);
  const [deliveryMethod, setDeliveryMethod] = React.useState<DeliveryMethod>(state.fulfillment === 'pickup' ? 'pickup' : 'courier');
  const [pickupPoint, setPickupPoint] = React.useState(state.pickup || '');
  const [promoCode, setPromoCode] = React.useState(state.promoCode || '');
  const [comment, setComment] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('cash');

  const idempotencyKeyRef = React.useRef<string>('');
  React.useEffect(() => {
    idempotencyKeyRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, []);

  const [address, setAddress] = React.useState('');
  const [couriers, setCouriers] = React.useState<Array<{ courier_id: string; name: string; tg_id: string; time_from?: string; time_to?: string; meeting_place?: string }>>([]);
  const [courierId, setCourierId] = React.useState(state.courierId || '');
  const [deliveryDate, setDeliveryDate] = React.useState(state.deliveryDate || new Date().toISOString().slice(0, 10));
  const [deliveryTime, setDeliveryTime] = React.useState(state.deliveryTime || '');

  const [bonusBalance, setBonusBalance] = React.useState(0);
  const [bonusWant, setBonusWant] = React.useState('');

  const [supportUrl, setSupportUrl] = React.useState<string>('');

  React.useEffect(() => {
    const url = String(config?.support?.supportUrl || config?.groupUrl || config?.reviewsUrl || '');
    setSupportUrl(url);
  }, [config?.support?.supportUrl, config?.groupUrl, config?.reviewsUrl]);

  React.useEffect(() => {
    if (pickupPoint) return;
    const first = config?.pickupPoints?.[0]?.address;
    if (first) setPickupPoint(first);
  }, [config?.pickupPoints, pickupPoint]);

  React.useEffect(() => {
    (async () => {
      try {
        setCartLoading(true);
        if (!city) {
          toast.push('Выберите город', 'error');
          return;
        }
        const resp = await cartAPI.getCart(city);
        setCart(resp.data.cart);
      } catch (e) {
        console.error('Checkout cart load failed:', e);
        toast.push('Ошибка загрузки корзины', 'error');
      } finally {
        setCartLoading(false);
      }
    })();
  }, [city]);

  React.useEffect(() => {
    (async () => {
      try {
        const resp = await bonusesAPI.balance();
        setBonusBalance(Number(resp.data.balance || 0));
      } catch {
        setBonusBalance(0);
      }
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        if (!city) return;
        const resp = await couriersAPI.list(city);
        setCouriers(resp.data.couriers || []);
      } catch {
        setCouriers([]);
      }
    })();
  }, [city]);

  React.useEffect(() => {
    if (courierId) return;
    const first = couriers[0]?.courier_id;
    if (first) setCourierId(first);
  }, [courierId, couriers]);

  const timeOptions = React.useMemo(() => {
    const c = couriers.find((x) => x.courier_id === courierId);
    const from = String(c?.time_from || '').trim();
    const to = String(c?.time_to || '').trim();
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map((x) => Number(x));
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return h * 60 + m;
    };
    const fm = toMin(from);
    const tm = toMin(to);
    if (fm == null || tm == null || tm <= fm) return [];
    const out: string[] = [];
    for (let m = fm; m <= tm - 10; m += 10) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      out.push(`${hh}:${mm}`);
    }
    return out;
  }, [courierId, couriers]);

  const courierMeetingPlace = React.useMemo(() => {
    const c = couriers.find((x) => x.courier_id === courierId);
    return String((c as any)?.meeting_place || '').trim();
  }, [courierId, couriers]);

  React.useEffect(() => {
    if (deliveryMethod !== 'courier') return;
    if (!courierMeetingPlace) return;
    if (address.trim()) return;
    setAddress(courierMeetingPlace);
  }, [deliveryMethod, courierMeetingPlace, address]);

  React.useEffect(() => {
    if (deliveryTime) return;
    if (timeOptions.length) setDeliveryTime(timeOptions[0]);
  }, [deliveryTime, timeOptions]);

  const createOrder = async () => {
    if (!cart?.items?.length) {
      toast.push('Корзина пуста', 'error');
      return;
    }

    const errors: string[] = [];
    if (deliveryMethod === 'pickup') {
      if (!pickupPoint.trim()) errors.push('Выбери точку самовывоза');
    } else {
      if (!address.trim()) errors.push('Укажи адрес доставки');
      if (!courierId) errors.push('Выбери курьера');
      if (!deliveryTime) errors.push('Выбери время');
    }
    const wantBonusRaw = Number(String(bonusWant || '').replace(',', '.')) || 0;
    const wantBonus = Math.max(0, Math.min(wantBonusRaw, bonusBalance));
    if (wantBonusRaw !== wantBonus) {
      errors.push('Бонусов больше, чем на балансе');
    }
    if (errors.length) {
      toast.push(errors.join(' • '), 'error');
      return;
    }

    setLoading(true);
    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      }

      trackCheckout(cart.items, cart.total);

      const orderData = {
        city,
        items: cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity, variant: item.variant || '' })),
        promoCode: String(promoCode || '').trim(),
      };

      const createResp = await orderAPI.createOrder(orderData, idempotencyKeyRef.current);
      const { orderId, orderText, totalAmount } = createResp.data;

      let applied = 0;
      const want = wantBonus;
      if (want > 0) {
        try {
          const resp = await bonusesAPI.apply(want);
          applied = Number(resp.data.applied || 0);
        } catch (e) {
          console.error('Bonuses apply failed:', e);
          toast.push('Не удалось применить бонусы', 'error');
          return;
        }
      }

      await orderAPI.confirmOrder({
        orderId,
        deliveryMethod,
        city,
        promoCode: String(promoCode || '').trim(),
        courier_id: deliveryMethod === 'courier' ? courierId : '',
        delivery_date: deliveryMethod === 'courier' ? deliveryDate : '',
        delivery_time: deliveryMethod === 'courier' ? deliveryTime : '',
        courierData: {
          address: deliveryMethod === 'pickup' ? pickupPoint : address,
          comment: String(comment || '').slice(0, 500),
          user: {
            tgId: user?.tgId || '',
            username: user?.username || '',
          },
        },
      });

      await orderAPI.processPayment({ orderId, paymentMethod, city, bonusApplied: applied });
      trackOrderComplete(orderId, Number(totalAmount || cart.total), cart.items);

      await cartAPI.clear(city);
      const refreshed = await cartAPI.getCart(city);
      setCart(refreshed.data.cart);

      toast.push(`Заказ ${orderId} оформлен`, 'success');

      const msg = String(orderText || '').trim();
      try {
        if (supportUrl && WebApp.openTelegramLink && /^https:\/\/t\.me\//i.test(supportUrl)) {
          WebApp.openTelegramLink(supportUrl);
        }
      } catch (e) {
        console.error('Open chat failed:', e);
        toast.push('Не удалось открыть чат', 'error');
      }

      navigate('/orders');
      idempotencyKeyRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    } catch (e) {
      console.error('Failed to create order:', e);
      try {
        WebApp.showAlert('Ошибка создания заказа');
      } catch {
        toast.push('Ошибка создания заказа', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    title: {
      textAlign: 'center' as const,
      padding: `0 ${theme.padding.screen}`,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.md,
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    },
    row: {
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.md,
    },
    input: {
      width: '100%',
      borderRadius: theme.radius.md,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.06)',
      color: theme.colors.dark.text,
      padding: '10px 12px',
      outline: 'none',
    },
    pillRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.md,
    },
    label: {
      fontSize: theme.typography.fontSize.xs,
      letterSpacing: '0.14em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.55)',
      marginBottom: theme.spacing.xs,
    },
    summary: {
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.md,
    },
    summaryRow: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      color: theme.colors.dark.text,
      fontSize: theme.typography.fontSize.sm,
    },
    muted: {
      color: theme.colors.dark.textSecondary,
    },
  };

  const pricing = (() => {
    const p = (cart as any)?.pricing;
    if (p && typeof p.total === 'number') {
      return { subtotal: Number(p.subtotal || 0), discount: Number(p.discount || 0), total: Number(p.total || 0) };
    }
    const subtotal = (cart?.items || []).reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
    return { subtotal, discount: 0, total: subtotal };
  })();

  const canSubmit = (() => {
    if (loading) return false;
    if (!cart?.items?.length) return false;
    if (!city) return false;
    const wantBonus = Math.max(0, Number(String(bonusWant || '').replace(',', '.')) || 0);
    if (wantBonus > bonusBalance) return false;
    if (deliveryMethod === 'pickup') return Boolean(pickupPoint.trim());
    if (!address.trim()) return false;
    if (!courierId || !deliveryTime) return false;
    return true;
  })();

  if (cartLoading) {
    return (
      <div style={{ padding: theme.padding.screen }}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ height: 64, borderRadius: theme.radius.md, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }} />
        </GlassCard>
      </div>
    );
  }

  if (!cart?.items?.length) {
    return (
      <div style={{ padding: theme.padding.screen }}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ textAlign: 'center', color: theme.colors.dark.textSecondary, marginBottom: theme.spacing.md }}>Корзина пуста</div>
          <PrimaryButton fullWidth onClick={() => navigate('/catalog')}>
            Перейти в каталог
          </PrimaryButton>
        </GlassCard>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: theme.spacing.xl }}>
      <div style={styles.title}>Оформление заказа</div>

      <SectionDivider title="Способ получения" />

      <div style={styles.pillRow}>
        {deliveryMethod === 'courier' ? (
          <PrimaryButton fullWidth onClick={() => setDeliveryMethod('courier')} style={{ borderRadius: 999 }}>
            <Truck size={18} />
            Доставка
          </PrimaryButton>
        ) : (
          <SecondaryButton fullWidth onClick={() => setDeliveryMethod('courier')} style={{ borderRadius: 999, opacity: 0.7 }}>
            <Truck size={18} />
            Доставка
          </SecondaryButton>
        )}
        {deliveryMethod === 'pickup' ? (
          <PrimaryButton fullWidth onClick={() => setDeliveryMethod('pickup')} style={{ borderRadius: 999 }}>
            <Store size={18} />
            Самовывоз
          </PrimaryButton>
        ) : (
          <SecondaryButton fullWidth onClick={() => setDeliveryMethod('pickup')} style={{ borderRadius: 999, opacity: 0.7 }}>
            <Store size={18} />
            Самовывоз
          </SecondaryButton>
        )}
      </div>

      <div style={styles.row}>
        <GlassCard padding="lg" variant="elevated">
          {deliveryMethod === 'pickup' ? (
            <>
              <div style={styles.label}>Точка самовывоза</div>
              <select value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} style={styles.input}>
                {(config?.pickupPoints || []).map((p) => (
                  <option key={p.id} value={p.address}>
                    {p.title}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <div style={styles.label}>{courierMeetingPlace ? 'Место встречи' : 'Адрес доставки *'}</div>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={courierMeetingPlace ? 'Место встречи задано курьером' : 'Введите адрес'}
                style={{ ...styles.input, opacity: courierMeetingPlace ? 0.85 : 1 }}
                disabled={Boolean(courierMeetingPlace)}
              />
            </>
          )}

          {deliveryMethod === 'courier' ? (
            <>
              <div style={{ height: theme.spacing.md }} />

              <div style={styles.label}>Курьер</div>
              <select value={courierId} onChange={(e) => setCourierId(e.target.value)} style={styles.input}>
                <option value="">Выберите курьера</option>
                {couriers.map((c) => (
                  <option key={c.courier_id} value={c.courier_id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div style={{ height: theme.spacing.md }} />

              <div style={styles.label}>Время</div>
              <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} style={styles.input} disabled={!courierId}>
                <option value="">Выберите</option>
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </GlassCard>
      </div>

      <SectionDivider title="Промокод" />

      <div style={styles.row}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
            <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Введите промокод" style={{ ...styles.input, borderRadius: 999 }} />
            {promoCode ? (
              <SecondaryButton onClick={() => setPromoCode('')} style={{ borderRadius: 999, padding: '10px 12px' }}>
                <X size={18} />
              </SecondaryButton>
            ) : null}
          </div>
        </GlassCard>
      </div>

      <SectionDivider title="Бонусы" />

      <div style={styles.row}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ ...styles.summaryRow, marginBottom: theme.spacing.sm }}>
            <span style={styles.muted}>Баланс</span>
            <span>{bonusBalance.toLocaleString()} 🍒</span>
          </div>
          <div style={styles.label}>Сколько списать</div>
          <input
            value={bonusWant}
            onChange={(e) => setBonusWant(e.target.value)}
            onBlur={() => {
              const raw = Number(String(bonusWant || '').replace(',', '.')) || 0;
              const clamped = Math.max(0, Math.min(raw, bonusBalance));
              setBonusWant(clamped ? String(clamped) : '');
            }}
            placeholder="0"
            style={styles.input}
            inputMode="decimal"
          />
        </GlassCard>
      </div>

      <SectionDivider title="Комментарий" />

      <div style={styles.row}>
        <GlassCard padding="lg" variant="elevated">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="Комментарий к заказу" style={{ ...styles.input, minHeight: 90, resize: 'none' }} />
          <div style={{ height: theme.spacing.md }} />
          <div style={styles.label}>Телефон</div>
          <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
            Телефон не требуется
          </div>
        </GlassCard>
      </div>

      <SectionDivider title="Оплата" />
      <div style={styles.pillRow}>
        {paymentMethod === 'cash' ? (
          <PrimaryButton fullWidth onClick={() => setPaymentMethod('cash')} disabled={loading} style={{ borderRadius: 999 }}>
            Наличные
          </PrimaryButton>
        ) : (
          <SecondaryButton fullWidth onClick={() => setPaymentMethod('cash')} disabled={loading} style={{ borderRadius: 999, opacity: 0.7 }}>
            Наличные
          </SecondaryButton>
        )}
        {paymentMethod === 'card' ? (
          <PrimaryButton fullWidth onClick={() => setPaymentMethod('card')} disabled={loading} style={{ borderRadius: 999 }}>
            Карта / Онлайн
          </PrimaryButton>
        ) : (
          <SecondaryButton fullWidth onClick={() => setPaymentMethod('card')} disabled={loading} style={{ borderRadius: 999, opacity: 0.7 }}>
            Карта / Онлайн
          </SecondaryButton>
        )}
      </div>

      <SectionDivider title="Итоги" />

      <div style={styles.summary}>
        <GlassCard padding="lg" variant="elevated">
          <div style={styles.summaryRow}>
            <span style={styles.muted}>Подытог</span>
            <span>{formatCurrency(pricing.subtotal)}</span>
          </div>
          {pricing.discount ? (
            <>
              <div style={{ height: theme.spacing.sm }} />
              <div style={styles.summaryRow}>
                <span style={styles.muted}>Скидка</span>
                <span>−{formatCurrency(pricing.discount)}</span>
              </div>
            </>
          ) : null}
          <div style={{ height: theme.spacing.sm }} />
          <div style={{ ...styles.summaryRow, fontWeight: theme.typography.fontWeight.bold }}>
            <span>К оплате</span>
            <span>{formatCurrency(pricing.total)}</span>
          </div>
        </GlassCard>
      </div>

      <div style={{ padding: `0 ${theme.padding.screen}` }}>
        <PrimaryButton fullWidth onClick={createOrder} disabled={!canSubmit}>
          {loading ? 'Оформление…' : 'Оформление заказа'}
        </PrimaryButton>
      </div>
    </div>
  );
};

export default Checkout;
