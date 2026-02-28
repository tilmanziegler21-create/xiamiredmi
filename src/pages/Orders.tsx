import React from 'react';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import { orderAPI } from '../services/api';
import { CherryMascot, GlassCard, PrimaryButton, SectionDivider, theme } from '../ui';
import { useToastStore } from '../store/useToastStore';
import { formatCurrency } from '../lib/currency';
import { useCityStore } from '../store/useCityStore';

type OrderItem = {
  id: string;
  status: string;
  totalAmount: number;
  deliveryMethod?: string;
  createdAt?: string;
  itemCount?: number;
};

const statusStyles: Record<string, { bg: string; text: string }> = {
  buffer: { bg: 'rgba(255,255,255,0.10)', text: 'rgba(255,255,255,0.80)' },
  pending: { bg: 'rgba(255,214,10,0.18)', text: 'rgba(255,214,10,0.95)' },
  assigned: { bg: 'rgba(0,122,255,0.18)', text: 'rgba(0,122,255,0.95)' },
  picked_up: { bg: 'rgba(175,82,222,0.20)', text: 'rgba(191,90,242,0.98)' },
  delivered: { bg: 'rgba(0,255,136,0.18)', text: 'rgba(0,255,136,0.95)' },
  cancelled: { bg: 'rgba(255,59,48,0.18)', text: 'rgba(255,59,48,0.95)' },
};

const Orders: React.FC = () => {
  const toast = useToastStore();
  const navigate = useNavigate();
  const { city } = useCityStore();
  const [loading, setLoading] = React.useState(true);
  const [orders, setOrders] = React.useState<OrderItem[]>([]);

  const getStatusText = (status: string) => {
    switch (String(status || '').toLowerCase()) {
      case 'buffer': return 'В обработке';
      case 'pending': return 'Ожидает';
      case 'assigned': return 'Курьер назначен';
      case 'picked_up': return 'В пути';
      case 'delivered': return 'Доставлен';
      case 'cancelled': return 'Отменён';
      default: return 'В обработке';
    }
  };

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        if (!city) {
          toast.push('Выберите город', 'error');
          setOrders([]);
          return;
        }
        const resp = await orderAPI.getHistory(city);
        setOrders(resp.data.orders || []);
      } catch (e) {
        console.error('Orders load error:', e);
        try {
          WebApp.showAlert('Ошибка загрузки истории');
        } catch {
          toast.push('Ошибка загрузки истории', 'error');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [city]);

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
      marginBottom: theme.spacing.xl,
    },
    row: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    id: {
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      fontSize: theme.typography.fontSize.sm,
    },
    meta: {
      color: theme.colors.dark.textSecondary,
      fontSize: theme.typography.fontSize.sm,
      marginTop: theme.spacing.xs,
    },
    status: (s: string) => {
      const st = statusStyles[String(s || '').toLowerCase()] || statusStyles.buffer;
      return {
        borderRadius: 999,
        padding: '6px 12px',
        border: '1px solid rgba(255,255,255,0.14)',
        background: st.bg,
        color: st.text,
        fontSize: theme.typography.fontSize.xs,
        letterSpacing: '0.14em',
        textTransform: 'uppercase' as const,
        whiteSpace: 'nowrap' as const,
      };
    },
    amount: {
      fontWeight: theme.typography.fontWeight.bold,
      background: 'rgba(255,255,255,0.92)',
      color: '#000',
      borderRadius: 999,
      padding: '6px 12px',
      boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
      whiteSpace: 'nowrap' as const,
    },
    overlay: {
      position: 'fixed' as const,
      inset: 0,
      background: 'rgba(0,0,0,0.65)',
      zIndex: 1500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.padding.screen,
    },
  };

  return (
    <div>
      <div style={styles.title}>История заказов</div>

      <SectionDivider title="Последние заказы" />

      <div style={styles.list}>
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 84,
                borderRadius: theme.radius.lg,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.08)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))
        ) : orders.length ? (
          orders.slice(0, 50).map((o) => (
            <button
              key={o.id}
              onClick={() => navigate(`/order/${encodeURIComponent(o.id)}`)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <GlassCard padding="lg" variant="elevated">
                <div style={styles.row}>
                  <div>
                    <div style={styles.id}>{o.id}</div>
                    <div style={styles.meta}>
                      {o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}{o.itemCount ? ` • ${o.itemCount} поз.` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: theme.spacing.sm }}>
                    <div style={styles.status(o.status)}>{getStatusText(o.status)}</div>
                    <div style={styles.amount}>{formatCurrency(Number(o.totalAmount || 0))}</div>
                  </div>
                </div>
              </GlassCard>
            </button>
          ))
        ) : (
          <GlassCard padding="lg" variant="elevated">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.xl }}>
              <CherryMascot variant="pink" size={140} />
              <div style={{ fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase' as const, fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily }}>
                Здесь пока пусто
              </div>
              <PrimaryButton fullWidth onClick={() => navigate('/catalog')} style={{ borderRadius: 12 }}>
                В каталог
              </PrimaryButton>
            </div>
          </GlassCard>
        )}
      </div>

      {null}
    </div>
  );
};

export default Orders;
