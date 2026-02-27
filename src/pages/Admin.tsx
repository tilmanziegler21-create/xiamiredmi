import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { GlassCard, SectionDivider, PrimaryButton, SecondaryButton, theme } from '../ui';
import { useCityStore } from '../store/useCityStore';
import { useToastStore } from '../store/useToastStore';
import { formatCurrency } from '../lib/currency';
import { Plus, Edit, Trash2, Users, Package, TrendingUp, Gift, Calendar, Clock, MapPin, Phone, CheckCircle, XCircle } from 'lucide-react';

type AdminOrder = {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  status: 'pending' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
  totalAmount: number;
  courierId?: string;
  courierName?: string;
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

type CourierRow = {
  courier_id: string;
  name: string;
  tg_id: string;
  active: boolean;
  time_from: string;
  time_to: string;
  phone?: string;
  orders_today?: number;
};

type Promo = {
  id: string;
  title: string;
  description: string;
  discount: number;
  type: 'percentage' | 'fixed' | 'gift';
  validUntil: string;
  isActive: boolean;
  terms: string[];
  minOrderAmount?: number;
  maxUses?: number;
  currentUses?: number;
};

const PromoEditModal: React.FC<{
  promo: Promo;
  onClose: () => void;
  onSave: (data: { id: string; title: string; description: string; type: string; value: number; active: boolean; startsAt?: string; endsAt?: string; minTotal?: number }) => Promise<void>;
}> = ({ promo, onClose, onSave }) => {
  const toast = useToastStore();
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState(String(promo.id || '').trim());
  const [title, setTitle] = useState(String(promo.title || '').trim());
  const [description, setDescription] = useState(String(promo.description || '').trim());
  const [type, setType] = useState<Promo['type']>(promo.type);
  const [value, setValue] = useState(String(promo.discount || 0));
  const [minTotal, setMinTotal] = useState(String(promo.minOrderAmount || 0));
  const [endsAt, setEndsAt] = useState(String(promo.validUntil || ''));
  const [active, setActive] = useState(Boolean(promo.isActive));

  const submit = async () => {
    const code = String(id || '').trim();
    if (!code) {
      toast.push('Код обязателен', 'error');
      return;
    }
    const v = Number(String(value || '').replace(',', '.'));
    if (!Number.isFinite(v)) {
      toast.push('Скидка должна быть числом', 'error');
      return;
    }
    const mt = Number(String(minTotal || '').replace(',', '.'));
    const mappedType = type === 'percentage' ? 'percent' : type === 'fixed' ? 'fixed' : 'gift';
    setBusy(true);
    try {
      await onSave({
        id: code,
        title: String(title || code),
        description: String(description || ''),
        type: mappedType,
        value: v,
        active,
        endsAt: String(endsAt || ''),
        minTotal: Number.isFinite(mt) ? mt : 0,
      });
      toast.push('Сохранено', 'success');
      onClose();
    } catch {
      toast.push('Ошибка сохранения', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: theme.padding.screen }}>
      <GlassCard padding="lg" variant="elevated" style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ fontWeight: theme.typography.fontWeight.bold, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: theme.spacing.md }}>
          Редактирование промо
        </div>

        <div style={{ display: 'grid', gap: theme.spacing.sm }}>
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Код" style={{ width: '100%', borderRadius: theme.radius.md, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: theme.colors.dark.text, padding: '10px 12px' }} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название" style={{ width: '100%', borderRadius: theme.radius.md, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: theme.colors.dark.text, padding: '10px 12px' }} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание" style={{ width: '100%', borderRadius: theme.radius.md, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: theme.colors.dark.text, padding: '10px 12px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm }}>
            <select value={type} onChange={(e) => setType(e.target.value as any)} style={{ width: '100%', borderRadius: theme.radius.md, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: theme.colors.dark.text, padding: '10px 12px' }}>
              <option value="percentage">Процент</option>
              <option value="fixed">Фикс</option>
              <option value="gift">Подарок</option>
            </select>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Скидка" inputMode="decimal" style={{ width: '100%', borderRadius: theme.radius.md, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: theme.colors.dark.text, padding: '10px 12px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm }}>
            <input value={minTotal} onChange={(e) => setMinTotal(e.target.value)} placeholder="Мин. сумма" inputMode="decimal" style={{ width: '100%', borderRadius: theme.radius.md, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: theme.colors.dark.text, padding: '10px 12px' }} />
            <input value={endsAt} onChange={(e) => setEndsAt(e.target.value)} placeholder="Действует до (ISO)" style={{ width: '100%', borderRadius: theme.radius.md, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: theme.colors.dark.text, padding: '10px 12px' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Активен
          </label>
        </div>

        <div style={{ height: theme.spacing.md }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm }}>
          <SecondaryButton fullWidth onClick={onClose} disabled={busy}>Отмена</SecondaryButton>
          <PrimaryButton fullWidth onClick={submit} disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</PrimaryButton>
        </div>
      </GlassCard>
    </div>
  );
};

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { city } = useCityStore();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [editPromo, setEditPromo] = useState<Promo | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'couriers' | 'promos' | 'stats'>('stats');
  const [selectedDate, setSelectedDate] = useState<'today' | 'week' | 'month'>('today');
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    activeOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    activeCouriers: 0,
    activePromos: 0,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      if (!city) {
        toast.push('Выберите город', 'error');
        return;
      }
      
      const [ordersRes, couriersRes, promosRes, statsRes] = await Promise.all([
        adminAPI.orders(city),
        adminAPI.couriers(city),
        adminAPI.promos(city),
        adminAPI.stats(city, selectedDate)
      ]);
      
      setOrders(ordersRes.data.orders || []);
      setCouriers(couriersRes.data.couriers || []);
      const mappedPromos: Promo[] = (promosRes.data.promos || []).map((p: any) => ({
        id: String(p.id || ''),
        title: String(p.title || p.id || ''),
        description: String(p.description || ''),
        discount: Number(p.value || 0),
        type: String(p.type || '') === 'gift' ? 'gift' : String(p.type || '') === 'percent' ? 'percentage' : 'fixed',
        validUntil: String(p.endsAt || ''),
        isActive: Boolean(p.active),
        terms: [],
        minOrderAmount: Number(p.minTotal || 0) || undefined,
      }));
      setPromos(mappedPromos);
      setStats(statsRes.data.stats || stats);
    } catch (error) {
      console.error('Failed to load admin data:', error);
      toast.push('Ошибка загрузки данных', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [city, selectedDate]);

  const updateOrderStatus = async (orderId: string, newStatus: AdminOrder['status']) => {
    try {
      await adminAPI.updateOrderStatus(orderId, newStatus, city);
      toast.push('Статус заказа обновлен', 'success');
      loadData();
    } catch (error) {
      console.error('Failed to update order status:', error);
      toast.push('Ошибка обновления статуса', 'error');
    }
  };

  const toggleCourierStatus = async (courierId: string, active: boolean) => {
    try {
      await adminAPI.toggleCourierStatus(courierId, active, city);
      toast.push(`Курьер ${active ? 'активирован' : 'деактивирован'}`, 'success');
      loadData();
    } catch (error) {
      console.error('Failed to toggle courier status:', error);
      toast.push('Ошибка обновления статуса курьера', 'error');
    }
  };

  const togglePromoStatus = async (promoId: string, active: boolean) => {
    try {
      await adminAPI.togglePromoStatus(promoId, active);
      toast.push(`Акция ${active ? 'активирована' : 'деактивирована'}`, 'success');
      loadData();
    } catch (error) {
      console.error('Failed to toggle promo status:', error);
      toast.push('Ошибка обновления статуса акции', 'error');
    }
  };

  const deletePromo = async (promoId: string) => {
    try {
      await adminAPI.deletePromo(promoId);
      toast.push('Акция удалена', 'success');
      loadData();
    } catch (error) {
      console.error('Failed to delete promo:', error);
      toast.push('Ошибка удаления акции', 'error');
    }
  };

  const savePromo = async (payload: any) => {
    await adminAPI.updatePromo(payload);
    await loadData();
  };

  const getStatusColor = (status: AdminOrder['status']) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'assigned': return theme.colors.dark.primary;
      case 'picked_up': return 'rgba(255,45,85,0.75)';
      case 'delivered': return '#4caf50';
      case 'cancelled': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getStatusText = (status: AdminOrder['status']) => {
    switch (status) {
      case 'pending': return 'Ожидает';
      case 'assigned': return 'Назначен';
      case 'picked_up': return 'В пути';
      case 'delivered': return 'Доставлен';
      case 'cancelled': return 'Отменен';
      default: return 'Неизвестно';
    }
  };

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
    tabBar: {
      display: 'flex',
      gap: theme.spacing.sm,
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.lg,
      overflowX: 'auto' as const,
    },
    tabButton: (active: boolean) => ({
      padding: '8px 16px',
      borderRadius: theme.radius.md,
      border: '1px solid rgba(255,255,255,0.14)',
      background: active ? 'rgba(255,45,85,0.18)' : 'rgba(255,255,255,0.06)',
      color: active ? theme.colors.dark.primary : theme.colors.dark.text,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: active ? theme.typography.fontWeight.bold : theme.typography.fontWeight.medium,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap' as const,
    }),
    dateSelector: {
      display: 'flex',
      gap: theme.spacing.sm,
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.lg,
    },
    dateButton: (active: boolean) => ({
      padding: '6px 12px',
      borderRadius: theme.radius.sm,
      border: '1px solid rgba(255,255,255,0.14)',
      background: active ? 'rgba(255,45,85,0.18)' : 'rgba(255,255,255,0.06)',
      color: active ? theme.colors.dark.primary : theme.colors.dark.text,
      fontSize: theme.typography.fontSize.xs,
      fontWeight: active ? theme.typography.fontWeight.bold : theme.typography.fontWeight.medium,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.lg,
    },
    statCard: {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      border: '1px solid rgba(255,255,255,0.1)',
    },
    statValue: {
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.dark.primary,
      marginBottom: theme.spacing.xs,
    },
    statLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.dark.textSecondary,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
    },
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
    statusBadge: (status: AdminOrder['status']) => ({
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
      flexWrap: 'wrap' as const,
    },
    courierCard: {
      marginBottom: theme.spacing.md,
      position: 'relative' as const,
    },
    courierHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    courierName: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    },
    courierStatus: (active: boolean) => ({
      padding: '4px 8px',
      borderRadius: theme.radius.sm,
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      background: active ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)',
      color: active ? '#4caf50' : '#f44336',
      border: `1px solid ${active ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}`,
    }),
    promoCard: {
      marginBottom: theme.spacing.md,
      position: 'relative' as const,
    },
    promoHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.md,
    },
    promoTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    },
    promoDiscount: {
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.dark.primary,
      marginBottom: theme.spacing.xs,
    },
    promoDescription: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.dark.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    promoTerms: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.dark.textSecondary,
      opacity: 0.8,
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
        <div style={styles.header}>
          <div style={styles.title}>Админ-панель</div>
        </div>
        <SectionDivider title="Загрузка..." />
        <div style={{ padding: `0 ${theme.padding.screen}` }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{...styles.statCard, animation: 'pulse 1.5s ease-in-out infinite'}} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Админ-панель</div>
        <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
          {city || 'Выберите город'}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={styles.tabBar}>
        <button style={styles.tabButton(activeTab === 'stats')} onClick={() => setActiveTab('stats')}>
          <TrendingUp size={16} style={{ marginRight: '4px' }} />
          Статистика
        </button>
        <button style={styles.tabButton(activeTab === 'orders')} onClick={() => setActiveTab('orders')}>
          <Package size={16} style={{ marginRight: '4px' }} />
          Заказы
        </button>
        <button style={styles.tabButton(activeTab === 'couriers')} onClick={() => setActiveTab('couriers')}>
          <Users size={16} style={{ marginRight: '4px' }} />
          Курьеры
        </button>
        <button style={styles.tabButton(activeTab === 'promos')} onClick={() => setActiveTab('promos')}>
          <Gift size={16} style={{ marginRight: '4px' }} />
          Акции
        </button>
      </div>

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <>
          <SectionDivider title="Статистика" />
          
          {/* Date Selector */}
          <div style={styles.dateSelector}>
            <button style={styles.dateButton(selectedDate === 'today')} onClick={() => setSelectedDate('today')}>
              Сегодня
            </button>
            <button style={styles.dateButton(selectedDate === 'week')} onClick={() => setSelectedDate('week')}>
              Неделя
            </button>
            <button style={styles.dateButton(selectedDate === 'month')} onClick={() => setSelectedDate('month')}>
              Месяц
            </button>
          </div>

          <div style={styles.statsGrid}>
            <GlassCard padding="lg" variant="elevated">
              <div style={styles.statValue}>{stats.totalOrders}</div>
              <div style={styles.statLabel}>Всего заказов</div>
            </GlassCard>
            <GlassCard padding="lg" variant="elevated">
              <div style={styles.statValue}>{formatCurrency(stats.totalRevenue)}</div>
              <div style={styles.statLabel}>Общая выручка</div>
            </GlassCard>
            <GlassCard padding="lg" variant="elevated">
              <div style={styles.statValue}>{stats.activeOrders}</div>
              <div style={styles.statLabel}>Активных заказов</div>
            </GlassCard>
            <GlassCard padding="lg" variant="elevated">
              <div style={styles.statValue}>{stats.deliveredOrders}</div>
              <div style={styles.statLabel}>Доставлено</div>
            </GlassCard>
            <GlassCard padding="lg" variant="elevated">
              <div style={styles.statValue}>{stats.activeCouriers}</div>
              <div style={styles.statLabel}>Активных курьеров</div>
            </GlassCard>
            <GlassCard padding="lg" variant="elevated">
              <div style={styles.statValue}>{stats.activePromos}</div>
              <div style={styles.statLabel}>Активных акций</div>
            </GlassCard>
          </div>
        </>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <>
          <SectionDivider title="Заказы" />
          <div style={{ padding: `0 ${theme.padding.screen}` }}>
            {orders.length === 0 ? (
              <GlassCard padding="lg" variant="elevated">
                <div style={styles.emptyState}>
                  <Package size={48} style={{ marginBottom: theme.spacing.md, opacity: 0.5 }} />
                  <div>Нет заказов</div>
                  <div style={{ fontSize: theme.typography.fontSize.xs, marginTop: theme.spacing.sm }}>
                    Заказы будут отображаться здесь
                  </div>
                </div>
              </GlassCard>
            ) : (
              orders.slice(0, 20).map((order) => (
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
                      <Users size={16} />
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
                      <Calendar size={16} />
                      <span>{order.deliveryDate} {order.deliveryTime}</span>
                    </div>
                    {order.courierName && (
                      <div style={styles.infoRow}>
                        <Users size={16} />
                        <span>Курьер: {order.courierName}</span>
                      </div>
                    )}
                  </div>

                  {/* Items List */}
                  <div style={styles.itemsList}>
                    {order.items?.slice(0, 3).map((item, index) => (
                      <div key={index} style={styles.item}>
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

                  {/* Action Buttons */}
                  <div style={styles.actionButtons}>
                    {order.status === 'pending' && (
                      <PrimaryButton
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, 'assigned')}
                      >
                        Назначить курьера
                      </PrimaryButton>
                    )}
                    {order.status === 'assigned' && (
                      <PrimaryButton
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, 'picked_up')}
                      >
                        В пути
                      </PrimaryButton>
                    )}
                    {order.status === 'picked_up' && (
                      <PrimaryButton
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, 'delivered')}
                      >
                        Доставлено
                      </PrimaryButton>
                    )}
                    {(order.status === 'pending' || order.status === 'assigned') && (
                      <SecondaryButton
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, 'cancelled')}
                      >
                        Отменить
                      </SecondaryButton>
                    )}
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </>
      )}

      {/* Couriers Tab */}
      {activeTab === 'couriers' && (
        <>
          <SectionDivider title="Курьеры" />
          <div style={{ padding: `0 ${theme.padding.screen}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
              <div style={styles.statLabel}>Активных курьеров: {stats.activeCouriers}</div>
              <PrimaryButton size="sm" onClick={() => navigate('/courier-registration')}>
                <Plus size={16} style={{ marginRight: '4px' }} />
                Добавить курьера
              </PrimaryButton>
            </div>
            
            {couriers.length === 0 ? (
              <GlassCard padding="lg" variant="elevated">
                <div style={styles.emptyState}>
                  <Users size={48} style={{ marginBottom: theme.spacing.md, opacity: 0.5 }} />
                  <div>Нет курьеров</div>
                  <div style={{ fontSize: theme.typography.fontSize.xs, marginTop: theme.spacing.sm }}>
                    Добавьте первого курьера
                  </div>
                </div>
              </GlassCard>
            ) : (
              couriers.slice(0, 20).map((courier) => (
                <GlassCard key={courier.courier_id} padding="lg" variant="elevated" style={styles.courierCard}>
                  <div style={styles.courierHeader}>
                    <div>
                      <div style={styles.courierName}>{courier.name}</div>
                      <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>
                        ID: {courier.courier_id} • TG: {courier.tg_id}
                      </div>
                      {courier.phone && (
                        <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>
                          📞 {courier.phone}
                        </div>
                      )}
                      {(courier.time_from || courier.time_to) && (
                        <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>
                          <Clock size={14} style={{ marginRight: '4px' }} />
                          {courier.time_from || '—'} - {courier.time_to || '—'}
                        </div>
                      )}
                      {courier.orders_today && (
                        <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>
                          📦 {courier.orders_today} заказов сегодня
                        </div>
                      )}
                    </div>
                    <div style={styles.courierStatus(courier.active)}>
                      {courier.active ? 'Активен' : 'Неактивен'}
                    </div>
                  </div>
                  <div style={styles.actionButtons}>
                    <PrimaryButton
                      size="sm"
                      onClick={() => toggleCourierStatus(courier.courier_id, !courier.active)}
                    >
                      {courier.active ? 'Деактивировать' : 'Активировать'}
                    </PrimaryButton>
                    <SecondaryButton
                      size="sm"
                      onClick={() => navigate(`/courier/${courier.courier_id}`)}
                    >
                      <Edit size={16} style={{ marginRight: '4px' }} />
                      Редактировать
                    </SecondaryButton>
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </>
      )}

      {/* Promos Tab */}
      {activeTab === 'promos' && (
        <>
          <SectionDivider title="Акции и промокоды" />
          <div style={{ padding: `0 ${theme.padding.screen}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
              <div style={styles.statLabel}>Активных акций: {stats.activePromos}</div>
              <PrimaryButton
                size="sm"
                onClick={() => setEditPromo({ id: '', title: '', description: '', discount: 0, type: 'percentage', validUntil: '', isActive: true, terms: [] })}
              >
                <Plus size={16} style={{ marginRight: '4px' }} />
                Создать акцию
              </PrimaryButton>
            </div>
            
            {promos.length === 0 ? (
              <GlassCard padding="lg" variant="elevated">
                <div style={styles.emptyState}>
                  <Gift size={48} style={{ marginBottom: theme.spacing.md, opacity: 0.5 }} />
                  <div>Нет акций</div>
                  <div style={{ fontSize: theme.typography.fontSize.xs, marginTop: theme.spacing.sm }}>
                    Создайте первую акцию
                  </div>
                </div>
              </GlassCard>
            ) : (
              promos.slice(0, 20).map((promo) => (
                <GlassCard key={promo.id} padding="lg" variant="elevated" style={styles.promoCard}>
                  <div style={styles.promoHeader}>
                    <div>
                      <div style={styles.promoTitle}>{promo.title}</div>
                      <div style={styles.promoDiscount}>
                        {promo.type === 'percentage' ? `-${promo.discount}%` :
                         promo.type === 'fixed' ? `-${formatCurrency(promo.discount)}` :
                         'ПОДАРОК'}
                      </div>
                      <div style={styles.promoDescription}>{promo.description}</div>
                    </div>
                    <div style={{
                      background: promo.isActive ? 'rgba(76,175,80,0.2)' : 'rgba(158,158,158,0.2)',
                      color: promo.isActive ? '#4caf50' : '#9e9e9e',
                      padding: '4px 8px',
                      borderRadius: theme.radius.sm,
                      fontSize: theme.typography.fontSize.xs,
                      fontWeight: theme.typography.fontWeight.bold,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.08em',
                      border: `1px solid ${promo.isActive ? 'rgba(76,175,80,0.3)' : 'rgba(158,158,158,0.3)'}`,
                    }}>
                      {promo.isActive ? 'Активна' : 'Неактивна'}
                    </div>
                  </div>
                  
                  <div style={styles.promoTerms}>
                    <strong>Действует до:</strong> {new Date(promo.validUntil).toLocaleDateString()}
                    {promo.minOrderAmount && (
                      <div><strong>Минимальный заказ:</strong> {formatCurrency(promo.minOrderAmount)}</div>
                    )}
                    {promo.maxUses && (
                      <div><strong>Использовано:</strong> {promo.currentUses || 0} / {promo.maxUses}</div>
                    )}
                    {promo.terms && promo.terms.length > 0 && (
                      <div style={{ marginTop: theme.spacing.xs }}>
                        <strong>Условия:</strong>
                        <ul style={{ margin: 0, paddingLeft: theme.spacing.md, marginTop: theme.spacing.xs }}>
                          {promo.terms.map((term, index) => (
                            <li key={index}>{term}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div style={styles.actionButtons}>
                    <PrimaryButton
                      size="sm"
                      onClick={() => togglePromoStatus(promo.id, !promo.isActive)}
                    >
                      {promo.isActive ? 'Деактивировать' : 'Активировать'}
                    </PrimaryButton>
                    <SecondaryButton
                      size="sm"
                      onClick={() => setEditPromo(promo)}
                    >
                      <Edit size={16} style={{ marginRight: '4px' }} />
                      Редактировать
                    </SecondaryButton>
                    <SecondaryButton
                      size="sm"
                      onClick={() => deletePromo(promo.id)}
                      style={{ background: 'rgba(244,67,54,0.1)', color: '#f44336', borderColor: 'rgba(244,67,54,0.3)' }}
                    >
                      <Trash2 size={16} style={{ marginRight: '4px' }} />
                      Удалить
                    </SecondaryButton>
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </>
      )}

      {editPromo ? (
        <PromoEditModal
          promo={editPromo}
          onClose={() => setEditPromo(null)}
          onSave={savePromo}
        />
      ) : null}
    </div>
  );
};

export default Admin;
