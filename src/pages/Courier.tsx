import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import { courierAPI, couriersAPI } from '../services/api';
import { GlassCard, SectionDivider, PrimaryButton, SecondaryButton, theme } from '../ui';
import { useCityStore } from '../store/useCityStore';
import { useToastStore } from '../store/useToastStore';
import { useAuthStore } from '../store/useAuthStore';
import { formatCurrency } from '../lib/currency';
import { Package, MapPin, Clock, Phone, CheckCircle, XCircle, Truck, User } from 'lucide-react';

type CourierOrder = {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  status: 'pending' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
  totalAmount: number;
  payoutAmount?: number;
  courierId?: string;
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddress: string;
  createdAt: string;
  itemCount: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  notes?: string;
};

const Courier: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { city } = useCityStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<CourierOrder[]>([]);
  const [paidDates, setPaidDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<'today' | 'tomorrow' | 'day_after'>('today');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [prefTimeFrom, setPrefTimeFrom] = useState('');
  const [prefTimeTo, setPrefTimeTo] = useState('');
  const [prefPlace, setPrefPlace] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const timeOptions = React.useMemo(() => {
    const out: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        out.push(`${hh}:${mm}`);
      }
    }
    return out;
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      if (!city) {
        toast.push('Выберите город', 'error');
        setOrders([]);
        setPaidDates([]);
        return;
      }
      const resp = await courierAPI.orders(city);
      setOrders(resp.data.orders || []);
      setPaidDates(Array.isArray(resp.data?.paidDates) ? resp.data.paidDates : []);
    } catch (error) {
      console.error('Failed to load courier orders:', error);
      toast.push('Ошибка загрузки заказов', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [city]);

  useEffect(() => {
    (async () => {
      try {
        if (!city) return;
        const resp = await couriersAPI.list(city);
        const list = Array.isArray(resp.data?.couriers) ? resp.data.couriers : [];
        const me = list.find((c: any) => String(c?.tg_id || '') === String(user?.tgId || '') || String(c?.courier_id || '') === String(user?.tgId || ''));
        if (!me) return;
        setPrefTimeFrom(String(me?.time_from || '').trim());
        setPrefTimeTo(String(me?.time_to || '').trim());
        setPrefPlace(String(me?.meeting_place || '').trim());
      } catch {
      }
    })();
  }, [city, user?.tgId]);

  const savePrefs = async () => {
    if (!city) return;
    setSavingPrefs(true);
    try {
      await courierAPI.updatePreferences({
        city,
        time_from: prefTimeFrom.trim(),
        time_to: prefTimeTo.trim(),
        meeting_place: prefPlace.trim(),
      });
      toast.push('Настройки сохранены', 'success');
      const resp = await couriersAPI.list(city);
      const list = Array.isArray(resp.data?.couriers) ? resp.data.couriers : [];
      const me = list.find((c: any) => String(c?.tg_id || '') === String(user?.tgId || '') || String(c?.courier_id || '') === String(user?.tgId || ''));
      if (me) {
        setPrefTimeFrom(String(me?.time_from || '').trim());
        setPrefTimeTo(String(me?.time_to || '').trim());
        setPrefPlace(String(me?.meeting_place || '').trim());
      }
    } catch (e) {
      const msg = String((e as any)?.response?.data?.error || '').trim();
      toast.push(msg || 'Не удалось сохранить', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: CourierOrder['status']) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      try {
        WebApp.showConfirm(`Изменить статус на "${getStatusText(newStatus)}"?`, (ok) => resolve(Boolean(ok)));
      } catch {
        resolve(window.confirm(`Изменить статус на "${getStatusText(newStatus)}"?`));
      }
    });
    if (!confirmed) return;
    let reason = '';
    if (newStatus === 'cancelled') {
      try {
        reason = String(window.prompt('Короткая причина (не выдано):', '') || '').trim();
      } catch {
        reason = '';
      }
    }
    try {
      await courierAPI.updateOrderStatus(orderId, newStatus, city, reason || undefined);
      toast.push('Статус заказа обновлен', 'success');
      loadOrders(); // Refresh orders
    } catch (error) {
      console.error('Failed to update order status:', error);
      toast.push('Ошибка обновления статуса', 'error');
    }
  };

  const getStatusColor = (status: CourierOrder['status']) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'assigned': return theme.colors.dark.primary;
      case 'picked_up': return 'rgba(255,45,85,0.75)';
      case 'delivered': return '#4caf50';
      case 'cancelled': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getStatusText = (status: CourierOrder['status']) => {
    switch (status) {
      case 'pending': return 'Ожидает';
      case 'assigned': return 'Назначен';
      case 'picked_up': return 'В пути';
      case 'delivered': return 'Доставлен';
      case 'cancelled': return 'Отменен';
      default: return 'Неизвестно';
    }
  };

  const filterOrdersByDate = (orders: CourierOrder[]) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    return orders.filter(order => {
      const orderDate = new Date(order.deliveryDate);
      switch (selectedDate) {
        case 'today':
          return orderDate.toDateString() === today.toDateString();
        case 'tomorrow':
          return orderDate.toDateString() === tomorrow.toDateString();
        case 'day_after':
          return orderDate.toDateString() === dayAfter.toDateString();
        default:
          return true;
      }
    });
  };

  const filteredOrders = filterOrdersByDate(orders);
  const visibleOrders = filteredOrders.filter((o) => (showCompleted ? true : o.status !== 'delivered' && o.status !== 'cancelled'));
  const normDate = (v: any) => String(v || '').slice(0, 10);
  const selectedDateKey = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (selectedDate === 'tomorrow') d.setDate(d.getDate() + 1);
    if (selectedDate === 'day_after') d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  })();
  const deliveredOrders = filteredOrders.filter((o) => o.status === 'delivered' && !paidDates.includes(normDate(o.deliveryDate || selectedDateKey)));
  const cancelledOrders = filteredOrders.filter((o) => o.status === 'cancelled');
  const dayRevenue = deliveredOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const dayPayout = deliveredOrders.reduce((s, o) => s + Number(o.payoutAmount ?? (Math.round(Number(o.totalAmount || 0) * 0.2 * 100) / 100)), 0);
  const paidForDay = paidDates.includes(selectedDateKey);

  const styles = {
    container: {
      minHeight: '100vh',
      color: theme.colors.dark.text,
      fontFamily: theme.typography.fontFamily,
      paddingBottom: theme.spacing.xl,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.md,
    },
    title: {
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    },
    dateSelector: {
      display: 'flex',
      gap: theme.spacing.sm,
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.lg,
    },
    dateButton: (active: boolean) => ({
      padding: '8px 16px',
      borderRadius: theme.radius.md,
      border: '1px solid rgba(255,255,255,0.14)',
      background: active ? 'rgba(255,45,85,0.18)' : 'rgba(255,255,255,0.06)',
      color: active ? theme.colors.dark.primary : theme.colors.dark.text,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: active ? theme.typography.fontWeight.bold : theme.typography.fontWeight.medium,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
    orderCard: {
      marginBottom: theme.spacing.md,
      position: 'relative' as const,
    },
    orderHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.md,
    },
    orderId: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    },
    statusBadge: (status: CourierOrder['status']) => ({
      background: getStatusColor(status),
      color: '#ffffff',
      padding: '4px 8px',
      borderRadius: theme.radius.sm,
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
    }),
    customerInfo: {
      marginBottom: theme.spacing.md,
    },
    infoRow: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.dark.textSecondary,
    },
    address: {
      color: theme.colors.dark.text,
      fontWeight: theme.typography.fontWeight.medium,
    },
    itemsList: {
      marginBottom: theme.spacing.md,
    },
    item: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    },
    itemName: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.dark.text,
    },
    itemQuantity: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.dark.textSecondary,
    },
    totalAmount: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
      paddingTop: theme.spacing.md,
      borderTop: '1px solid rgba(255,255,255,0.2)',
    },
    totalLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.dark.textSecondary,
    },
    totalValue: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.dark.primary,
    },
    actionButtons: {
      display: 'flex',
      gap: theme.spacing.sm,
    },
    emptyState: {
      textAlign: 'center' as const,
      color: theme.colors.dark.textSecondary,
      padding: theme.spacing.xl,
    },
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>Курьер</div>
        <SectionDivider title="Мои заказы" />
        <div style={{ padding: `0 ${theme.padding.screen}` }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{...styles.orderCard, animation: 'pulse 1.5s ease-in-out infinite'}} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Курьер</div>
      </div>

      <SectionDivider title="Мои настройки" />
      <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.md }}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ display: 'grid', gap: theme.spacing.sm }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm }}>
              <select
                value={prefTimeFrom}
                onChange={(e) => setPrefTimeFrom(e.target.value)}
                style={{ width: '100%', borderRadius: theme.radius.md, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: theme.colors.dark.text, padding: '10px 12px' }}
              >
                <option value="">Время с</option>
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={prefTimeTo}
                onChange={(e) => setPrefTimeTo(e.target.value)}
                style={{ width: '100%', borderRadius: theme.radius.md, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: theme.colors.dark.text, padding: '10px 12px' }}
              >
                <option value="">Время до</option>
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <input
              value={prefPlace}
              onChange={(e) => setPrefPlace(e.target.value)}
              placeholder="Место встречи"
              style={{ width: '100%', borderRadius: theme.radius.md, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: theme.colors.dark.text, padding: '10px 12px' }}
            />
            <PrimaryButton fullWidth size="sm" onClick={savePrefs} disabled={savingPrefs}>
              {savingPrefs ? 'Сохранение…' : 'Сохранить'}
            </PrimaryButton>
          </div>
        </GlassCard>
      </div>

      <SectionDivider title="Мои заказы" />

      {/* Date Selector */}
      <div style={styles.dateSelector}>
        <button
          style={styles.dateButton(selectedDate === 'today')}
          onClick={() => setSelectedDate('today')}
        >
          Сегодня
        </button>
        <button
          style={styles.dateButton(selectedDate === 'tomorrow')}
          onClick={() => setSelectedDate('tomorrow')}
        >
          Завтра
        </button>
        <button
          style={styles.dateButton(selectedDate === 'day_after')}
          onClick={() => setSelectedDate('day_after')}
        >
          Послезавтра
        </button>
        <button
          style={styles.dateButton(showCompleted)}
          onClick={() => setShowCompleted((s) => !s)}
        >
          {showCompleted ? 'Все' : 'Активные'}
        </button>
      </div>

      <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.md }}>
        <GlassCard padding="md" variant="elevated">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, flexWrap: 'wrap' as const, marginBottom: theme.spacing.sm }}>
            <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
              Касса: <span style={{ color: theme.colors.dark.text, fontWeight: theme.typography.fontWeight.bold }}>{formatCurrency(dayRevenue)}</span>
            </div>
            <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
              Комиссия курьера: <span style={{ color: '#37d67a', fontWeight: theme.typography.fontWeight.bold }}>{formatCurrency(dayPayout)}</span>
            </div>
            <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
              Выдано: <span style={{ color: theme.colors.dark.text, fontWeight: theme.typography.fontWeight.bold }}>{deliveredOrders.length}</span>
            </div>
            <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
              Не выдано: <span style={{ color: theme.colors.dark.text, fontWeight: theme.typography.fontWeight.bold }}>{cancelledOrders.length}</span>
            </div>
          </div>
          <PrimaryButton
            fullWidth
            size="sm"
            disabled={paidForDay || !(dayPayout > 0)}
            onClick={async () => {
              const confirmed = await new Promise<boolean>((resolve) => {
                try {
                  WebApp.showConfirm(`Выплатить комиссию ${formatCurrency(dayPayout)}?`, (ok) => resolve(Boolean(ok)));
                } catch {
                  resolve(window.confirm(`Выплатить комиссию ${formatCurrency(dayPayout)}?`));
                }
              });
              if (!confirmed) return;
              try {
                await courierAPI.requestPayout({ city: String(city), date: selectedDateKey, amount: dayPayout, revenue: dayRevenue, delivered: deliveredOrders.length });
                toast.push('Запрос на выплату отправлен админу', 'success');
                await loadOrders();
              } catch {
                toast.push('Не удалось отправить запрос', 'error');
              }
            }}
          >
            {paidForDay ? 'Комиссия выплачена' : 'Выплатить комиссию'}
          </PrimaryButton>
        </GlassCard>
      </div>

      {/* Orders List */}
      <div style={{ padding: `0 ${theme.padding.screen}` }}>
        {visibleOrders.length === 0 ? (
          <GlassCard padding="lg" variant="elevated">
            <div style={styles.emptyState}>
              <Package size={48} style={{ marginBottom: theme.spacing.md, opacity: 0.5 }} />
              <div>Нет заказов на выбранную дату</div>
              <div style={{ fontSize: theme.typography.fontSize.xs, marginTop: theme.spacing.sm }}>
                Проверьте другие даты или обратитесь к менеджеру
              </div>
            </div>
          </GlassCard>
        ) : (
          visibleOrders.map((order) => (
            <GlassCard key={order.id} padding="lg" variant="elevated" style={styles.orderCard}>
              {/* Order Header */}
              <div style={styles.orderHeader}>
                <div style={styles.orderId}>Заказ #{order.id}</div>
                <div style={styles.statusBadge(order.status)}>
                  {getStatusText(order.status)}
                </div>
              </div>

              {/* Customer Info */}
              <div style={styles.customerInfo}>
                <div style={styles.infoRow}>
                  <User size={16} />
                  <span>{order.userName || `Клиент ${order.userId}`}</span>
                  {order.userPhone && (
                    <>
                      <span>•</span>
                      <Phone size={16} />
                      <span>{order.userPhone}</span>
                    </>
                  )}
                </div>
                <div style={styles.infoRow}>
                  <MapPin size={16} />
                  <span style={styles.address}>{order.deliveryAddress}</span>
                </div>
                <div style={styles.infoRow}>
                  <Clock size={16} />
                  <span>{order.deliveryTime || 'Время не указано'}</span>
                </div>
              </div>

              {/* Items List */}
              <div style={styles.itemsList}>
                {order.items?.slice(0, 3).map((item) => (
                  <div key={`${item.name}_${item.quantity}_${item.price}`} style={styles.item}>
                    <div style={styles.itemName}>{item.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                      <span style={styles.itemQuantity}>x{item.quantity}</span>
                      <span style={{ fontWeight: theme.typography.fontWeight.bold }}>
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
                {order.items && order.items.length > 3 && (
                  <div style={{ textAlign: 'center', fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary, marginTop: theme.spacing.sm }}>
                    + ещё {order.items.length - 3} позиций
                  </div>
                )}
              </div>

              {/* Total Amount */}
              <div style={styles.totalAmount}>
                <span style={styles.totalLabel}>Итого:</span>
                <span style={styles.totalValue}>{formatCurrency(order.totalAmount)}</span>
              </div>
              <div style={{ ...styles.totalAmount, borderTop: 'none', paddingTop: 0 }}>
                <span style={styles.totalLabel}>К выплате (20%):</span>
                <span style={{ ...styles.totalValue, color: '#37d67a' }}>
                  {formatCurrency(order.payoutAmount ?? Math.round(order.totalAmount * 0.2 * 100) / 100)}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={styles.actionButtons}>
                {order.status === 'pending' && (
                  <PrimaryButton
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'assigned')}
                  >
                    <Truck size={16} style={{ marginRight: '4px' }} />
                    Взять заказ
                  </PrimaryButton>
                )}
                {order.status === 'assigned' && (
                  <PrimaryButton
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'picked_up')}
                  >
                    <Package size={16} style={{ marginRight: '4px' }} />
                    В пути
                  </PrimaryButton>
                )}
                {order.status === 'picked_up' && (
                  <PrimaryButton
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'delivered')}
                  >
                    <CheckCircle size={16} style={{ marginRight: '4px' }} />
                    Доставлено
                  </PrimaryButton>
                )}
                {(order.status === 'pending' || order.status === 'assigned') && (
                  <SecondaryButton
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'cancelled')}
                  >
                    <XCircle size={16} style={{ marginRight: '4px' }} />
                    Отменить
                  </SecondaryButton>
                )}
                {order.status === 'delivered' && (
                  <div style={{ 
                    background: 'rgba(76,175,80,0.1)', 
                    border: '1px solid rgba(76,175,80,0.3)',
                    borderRadius: theme.radius.md,
                    padding: theme.spacing.sm,
                    textAlign: 'center' as const,
                    color: '#4caf50',
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.bold,
                    width: '100%'
                  }}>
                    ✓ Заказ доставлен
                  </div>
                )}
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
};

export default Courier;
