import React from 'react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { Minus, Plus, Trash2, Truck, Store } from 'lucide-react';
import { cartAPI, couriersAPI } from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { useAnalytics } from '../hooks/useAnalytics';
import { GlassCard, PrimaryButton, SecondaryButton, SectionDivider, theme } from '../ui';
import { useToastStore } from '../store/useToastStore';
import { formatCurrency } from '../lib/currency';
import { useCityStore } from '../store/useCityStore';
import { useConfigStore } from '../store/useConfigStore';
import { blurStyle } from '../ui/blur';

type Fulfillment = 'delivery' | 'pickup';

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { cart, setCart } = useCartStore();
  const { trackRemoveFromCart, trackCheckout } = useAnalytics();
  const [loading, setLoading] = React.useState(true);
  const { city } = useCityStore();
  const { config } = useConfigStore();
  const ultraLite = (() => {
    try {
      const el = document.documentElement;
      return el.classList.contains('tg-webview') && el.classList.contains('tg-ios');
    } catch {
      return false;
    }
  })();
  const pickupPoints = (config?.pickupPoints || []).map((p) => p.address);
  const [promoCode, setPromoCode] = React.useState('');
  const [fulfillment, setFulfillment] = React.useState<Fulfillment>('pickup');
  const [pickup, setPickup] = React.useState('');
  const [couriers, setCouriers] = React.useState<Array<{ courier_id: string; name: string; tg_id: string; time_from?: string; time_to?: string }>>([]);
  const [courierId, setCourierId] = React.useState('');
  const [deliveryTime, setDeliveryTime] = React.useState('');

  React.useEffect(() => {
    if (!pickup && pickupPoints.length) setPickup(pickupPoints[0]);
  }, [pickup, pickupPoints.length]);

  React.useEffect(() => {
    (async () => {
      try {
        if (!city) return;
        const resp = await couriersAPI.list(city);
        const list = resp.data.couriers || [];
        setCouriers(list);
        if (!courierId && list.length) setCourierId(String(list[0].courier_id || ''));
      } catch {
        setCouriers([]);
      }
    })();
  }, [city]);

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
    for (let m = fm; m <= tm - 30; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      out.push(`${hh}:${mm}`);
    }
    return out;
  }, [courierId, couriers]);

  React.useEffect(() => {
    if (!deliveryTime && timeOptions.length) setDeliveryTime(timeOptions[0]);
  }, [deliveryTime, timeOptions.length]);

  const load = async () => {
    try {
      setLoading(true);
      if (!city) {
        toast.push('Выберите город', 'error');
        return;
      }
      const resp = await cartAPI.getCart(city);
      setCart(resp.data.cart);
    } catch (e) {
      console.error('Failed to load cart:', e);
      try {
        WebApp.showAlert('Ошибка загрузки корзины');
      } catch {
        toast.push('Ошибка загрузки корзины', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, [city]);

  const setQty = async (itemId: string, nextQty: number) => {
    if (nextQty <= 0) return;
    try {
      if (!city) {
        toast.push('Выберите город', 'error');
        return;
      }
      await cartAPI.updateItem(itemId, nextQty);
      const resp = await cartAPI.getCart(city);
      setCart(resp.data.cart);
    } catch (e) {
      console.error('Failed to update qty:', e);
      const status = (e as any)?.response?.status;
      if (status === 409) toast.push('Недостаточно товара на складе', 'error');
      else toast.push('Ошибка изменения количества', 'error');
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      if (!city) {
        toast.push('Выберите город', 'error');
        return;
      }
      const item = cart?.items.find((i) => i.id === itemId);
      if (item) trackRemoveFromCart(item.productId, item.name, item.price, item.quantity);
      await cartAPI.removeItem(itemId);
      const resp = await cartAPI.getCart(city);
      setCart(resp.data.cart);
      toast.push('Товар удалён', 'success');
    } catch (e) {
      console.error('Failed to remove item:', e);
      toast.push('Ошибка удаления товара', 'error');
    }
  };

  const canCheckout = Boolean(
    cart?.items?.length &&
      city &&
      (fulfillment === 'pickup' ? Boolean(pickup) : Boolean(courierId && deliveryTime))
  );

  const goCheckout = () => {
    if (!cart?.items?.length) return;
    if (!canCheckout) {
      toast.push(fulfillment === 'pickup' ? 'Выберите точку самовывоза' : 'Выберите курьера и время', 'error');
      return;
    }
    trackCheckout(cart.items, cart.total);
    const today = new Date().toISOString().slice(0, 10);
    navigate('/checkout', { state: { fulfillment, pickup, promoCode, courierId, deliveryTime, deliveryDate: today } });
  };

  // Calculate pricing with quantity discounts
  const calculatePricing = () => {
    if (!cart) return { subtotal: 0, discount: 0, total: 0, quantityDiscount: 0 };
    const serverPricing = (cart as any).pricing;
    if (serverPricing && typeof serverPricing.total === 'number') {
      return {
        subtotal: Number(serverPricing.subtotal || 0),
        discount: Number(serverPricing.discount || 0),
        total: Number(serverPricing.total || 0),
        quantityDiscount: Number(serverPricing.discount || 0),
      };
    }
    
    const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return { subtotal, discount: 0, total: subtotal, quantityDiscount: 0 };
  };

  const pricing = calculatePricing();

  const handleDecrement = (item: { id: string; quantity: number }) => {
    if (item.quantity <= 1) {
      toast.push('Используйте 🗑 для удаления товара', 'info');
      return;
    }
    setQty(item.id, item.quantity - 1);
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
    list: {
      padding: `0 ${theme.padding.screen}`,
      display: 'grid',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    itemCard: {
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(12, 10, 26, 0.62)',
      ...blurStyle(theme.blur.glass),
      boxShadow: theme.shadow.card,
      padding: theme.spacing.md,
      position: 'relative' as const,
    },
    sale: {
      position: 'absolute' as const,
      top: theme.spacing.md,
      left: theme.spacing.md,
      background: theme.colors.dark.accentRed,
      color: '#fff',
      borderRadius: 999,
      padding: '4px 10px',
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
    },
    trash: {
      position: 'absolute' as const,
      top: theme.spacing.md,
      right: theme.spacing.md,
    },
    row: {
      display: 'flex',
      gap: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.lg,
    },
    avatar: (img: string) => ({
      width: 64,
      height: 64,
      borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.14)',
      background: `linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.65) 100%), url(${img}) center/cover`,
      flex: '0 0 auto',
      boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
    }),
    name: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      marginBottom: 6,
    },
    pricePill: {
      background: 'rgba(255,255,255,0.92)',
      color: '#000',
      borderRadius: 999,
      padding: '6px 12px',
      fontWeight: theme.typography.fontWeight.bold,
      boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
      whiteSpace: 'nowrap' as const,
    },
    qtyWrap: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginLeft: 'auto',
    },
    qtyBtn: {
      width: 34,
      height: 34,
      borderRadius: 999,
      background: '#f59e0b',
      border: 'none',
      color: '#1b1405',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 12px 24px rgba(0,0,0,0.35)',
    },
    flavor: {
      marginTop: theme.spacing.sm,
      borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.06)',
      padding: '8px 12px',
      color: 'rgba(255,255,255,0.80)',
      fontSize: theme.typography.fontSize.sm,
      overflow: 'hidden',
      textOverflow: 'ellipsis' as const,
      whiteSpace: 'nowrap' as const,
    },
    edit: {
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.md,
    },
    toggles: {
      padding: `0 ${theme.padding.screen}`,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    promoRow: {
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.md,
    },
    promoBox: {
      borderRadius: theme.radius.lg,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.06)',
      ...blurStyle(theme.blur.glass),
      boxShadow: theme.shadow.card,
      padding: theme.spacing.md,
      display: 'grid',
      gap: theme.spacing.sm,
    },
    promoLabel: {
      fontSize: theme.typography.fontSize.xs,
      letterSpacing: '0.14em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.55)',
    },
    promoInput: {
      width: '100%',
      borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(0,0,0,0.25)',
      color: theme.colors.dark.text,
      padding: '10px 14px',
      outline: 'none',
    },
    pickupCard: {
      margin: `0 ${theme.padding.screen} ${theme.spacing.md}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.14)',
      background: ultraLite
        ? `linear-gradient(135deg, rgba(255,214,10,0.10) 0%, rgba(124,58,237,0.18) 100%)`
        : `linear-gradient(135deg, rgba(255,214,10,0.10) 0%, rgba(124,58,237,0.18) 100%), url(/assets/elfcherry/banners/banner-1.jpg) center/cover`,
      boxShadow: theme.shadow.card,
    },
    pickupInner: {
      padding: theme.spacing.lg,
      background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.70) 100%)',
      ...blurStyle(theme.blur.glass),
    },
    pickupTitle: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      marginBottom: theme.spacing.sm,
    },
    pickupSelect: {
      width: '100%',
      borderRadius: theme.radius.md,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.10)',
      color: theme.colors.dark.text,
      padding: '10px 12px',
      outline: 'none',
      marginBottom: theme.spacing.md,
    },
    courierBox: {
      margin: `0 ${theme.padding.screen} ${theme.spacing.md}`,
      borderRadius: theme.radius.lg,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(12, 10, 26, 0.62)',
      ...blurStyle(theme.blur.glass),
      boxShadow: theme.shadow.card,
      padding: theme.spacing.lg,
    },
    courierSelect: {
      width: '100%',
      borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.06)',
      color: theme.colors.dark.text,
      padding: '10px 14px',
      outline: 'none',
    },
    checkout: {
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.xl,
    },
  };

  if (loading) {
    return (
      <div style={{ padding: theme.padding.screen }}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ height: 220 }} className="animate-pulse" />
        </GlassCard>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
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
    <div>
      <div style={styles.title}>Корзина</div>

      <div style={styles.list}>
        {cart.items.map((item) => (
          <div key={item.id} style={styles.itemCard}>
            <div style={styles.trash}>
              <button
                onClick={() => removeItem(item.id)}
                style={{ background: 'transparent', border: 'none', color: theme.colors.dark.text, cursor: 'pointer' }}
                aria-label="remove"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div style={styles.row}>
              <div style={styles.avatar(item.image)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.name}>{item.name}</div>
                  </div>
                  <div style={styles.pricePill}>{formatCurrency(item.price)}</div>
                </div>
                {item.variant ? <div style={styles.flavor}>{item.variant}</div> : null}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginTop: theme.spacing.md }}>
              <div style={styles.qtyWrap}>
                <button style={styles.qtyBtn} onClick={() => handleDecrement(item)} aria-label="minus">
                  <Minus size={18} />
                </button>
                <div style={{ width: 28, textAlign: 'center', fontWeight: theme.typography.fontWeight.bold }}>{item.quantity}</div>
                <button style={styles.qtyBtn} onClick={() => setQty(item.id, item.quantity + 1)} aria-label="plus">
                  <Plus size={18} />
                </button>
              </div>
              <div style={{ marginLeft: 'auto', color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                {formatCurrency(item.price * item.quantity)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.edit}>
        <SecondaryButton fullWidth onClick={() => navigate('/catalog')} style={{ borderRadius: 999, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Редактировать заказ
        </SecondaryButton>
      </div>

      <SectionDivider title="Оформление заказа" />

      <div style={styles.toggles}>
        {fulfillment === 'delivery' ? (
          <PrimaryButton fullWidth onClick={() => setFulfillment('delivery')} style={{ borderRadius: 999, opacity: 1 }}>
            <Truck size={18} />
            Доставка
          </PrimaryButton>
        ) : (
          <SecondaryButton fullWidth onClick={() => setFulfillment('delivery')} style={{ borderRadius: 999, opacity: 0.5 }}>
            <Truck size={18} />
            Доставка
          </SecondaryButton>
        )}
        {fulfillment === 'pickup' ? (
          <PrimaryButton fullWidth onClick={() => setFulfillment('pickup')} style={{ borderRadius: 999, opacity: 1 }}>
            <Store size={18} />
            Самовывоз
          </PrimaryButton>
        ) : (
          <SecondaryButton fullWidth onClick={() => setFulfillment('pickup')} style={{ borderRadius: 999, opacity: 0.5 }}>
            <Store size={18} />
            Самовывоз
          </SecondaryButton>
        )}
      </div>

      <div style={styles.promoRow}>
        <div style={styles.promoBox}>
          <div style={styles.promoLabel}>Промокод:</div>
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Введите промокод"
            style={styles.promoInput}
          />
        </div>
      </div>

      {fulfillment === 'pickup' ? (
        <div style={styles.pickupCard}>
          <div style={styles.pickupInner}>
            <div style={styles.pickupTitle}>Самовывоз</div>
            <div style={{ color: theme.colors.dark.textSecondary, marginBottom: theme.spacing.sm }}>Выберите точку самовывоза</div>
            <select value={pickup} onChange={(e) => setPickup(e.target.value)} style={styles.pickupSelect}>
              {pickupPoints.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {fulfillment !== 'pickup' ? (
        <div style={styles.courierBox}>
          <div style={styles.pickupTitle}>Курьер и время</div>
          <div style={{ color: theme.colors.dark.textSecondary, marginBottom: theme.spacing.sm }}>Выберите курьера и слот доставки</div>
          <div style={{ display: 'grid', gap: theme.spacing.sm }}>
            <select value={courierId} onChange={(e) => setCourierId(e.target.value)} style={styles.courierSelect}>
              <option value="">Выберите курьера</option>
              {couriers.map((c) => (
                <option key={c.courier_id} value={c.courier_id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} style={styles.courierSelect} disabled={!courierId}>
              <option value="">Выберите время</option>
              {timeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {/* Total and Pricing */}
      <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.md }}>
        <GlassCard padding="md" variant="elevated">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
            <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>Товары:</span>
            <span style={{ fontSize: theme.typography.fontSize.sm }}>{formatCurrency(pricing.subtotal)}</span>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: theme.spacing.sm,
            paddingTop: theme.spacing.sm,
            borderTop: '1px solid rgba(255,255,255,0.1)'
          }}>
            <span style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold }}>Итого:</span>
            <span style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, color: '#7c3aed' }}>
              {formatCurrency(pricing.total)}
            </span>
          </div>
        </GlassCard>
      </div>

      <div style={styles.checkout}>
        <PrimaryButton fullWidth onClick={goCheckout} disabled={!canCheckout}>
          Оформление заказа
        </PrimaryButton>
      </div>
    </div>
  );
};

export default Cart;
