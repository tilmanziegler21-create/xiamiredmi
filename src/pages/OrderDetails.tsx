import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { ArrowLeft } from 'lucide-react';
import { orderAPI } from '../services/api';
import { GlassCard, SectionDivider, IconButton, theme } from '../ui';
import { useToastStore } from '../store/useToastStore';
import { useCityStore } from '../store/useCityStore';
import { formatCurrency } from '../lib/currency';

type OrderDetailsResponse = {
  order: {
    id: string;
    status: string;
    totalAmount: number;
    finalAmount?: number;
    bonusApplied?: number;
    paymentMethod?: string;
    deliveryMethod?: string;
    deliveryAddress?: string;
    userPhone?: string;
    comment?: string;
    courierId?: string;
    deliveryDate?: string;
    deliveryTime?: string;
    createdAt?: string;
  };
  items: Array<{
    productId: string;
    name: string;
    brand?: string;
    category?: string;
    image?: string;
    price: number;
    quantity: number;
    variant?: string;
  }>;
};

const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToastStore();
  const { city } = useCityStore();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<OrderDetailsResponse | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        if (!city) {
          toast.push('Выберите город', 'error');
          setData(null);
          return;
        }
        if (!id) {
          toast.push('Заказ не найден', 'error');
          setData(null);
          return;
        }
        const resp = await orderAPI.getById(id, city);
        setData(resp.data);
      } catch (e) {
        console.error('Order details load error:', e);
        try {
          WebApp.showAlert('Ошибка загрузки заказа');
        } catch {
          toast.push('Ошибка загрузки заказа', 'error');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [city, id, toast]);

  if (loading) {
    return (
      <div style={{ padding: theme.padding.screen }}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ height: 260 }} className="animate-pulse" />
        </GlassCard>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: theme.padding.screen }}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ textAlign: 'center', color: theme.colors.dark.textSecondary }}>Заказ не найден</div>
        </GlassCard>
      </div>
    );
  }

  const { order, items } = data;
  const subtotal = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
  const bonusApplied = Number(order.bonusApplied || 0);
  const finalAmount = Number(order.finalAmount || 0) || Math.max(0, Number(order.totalAmount || 0) - bonusApplied);
  const getStatusText = (s: string) => {
    const map: Record<string, string> = {
      buffer: 'В обработке',
      pending: 'Ожидает',
      assigned: 'Курьер назначен',
      picked_up: 'В пути',
      delivered: 'Доставлен',
      cancelled: 'Отменён',
    };
    const key = String(s || '').toLowerCase();
    return map[key] ?? (s || '—');
  };
  const getDeliveryText = (s: string) => {
    const key = String(s || '').toLowerCase();
    if (key === 'courier') return 'Курьер';
    if (key === 'pickup') return 'Самовывоз';
    return s || '—';
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${theme.padding.screen}`,
        marginTop: theme.spacing.md,
        marginBottom: theme.spacing.md,
      }}>
        <IconButton icon={<ArrowLeft size={18} />} onClick={() => navigate(-1)} variant="glass" size="sm" />
        <div style={{
          color: theme.colors.dark.text,
          fontSize: theme.typography.fontSize.xl,
          fontWeight: theme.typography.fontWeight.bold,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Заказ
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: `0 ${theme.padding.screen}` }}>
        <GlassCard padding="lg" variant="elevated" style={{ marginBottom: theme.spacing.md }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <div style={{ fontWeight: theme.typography.fontWeight.bold, letterSpacing: '0.06em' }}>{order.id}</div>
            <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>{order.createdAt ? new Date(order.createdAt).toLocaleString() : ''}</div>
          </div>
          <div style={{ display: 'grid', gap: 6, color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
            <div>Статус: <span style={{ color: theme.colors.dark.text }}>{getStatusText(order.status)}</span></div>
            <div>Доставка: <span style={{ color: theme.colors.dark.text }}>{getDeliveryText(order.deliveryMethod || '')}</span></div>
            <div>Оплата: <span style={{ color: theme.colors.dark.text }}>{order.paymentMethod || '—'}</span></div>
            {order.deliveryAddress ? (
              <div>Адрес: <span style={{ color: theme.colors.dark.text }}>{order.deliveryAddress}</span></div>
            ) : null}
            {order.userPhone ? (
              <div>Телефон: <span style={{ color: theme.colors.dark.text }}>{order.userPhone}</span></div>
            ) : null}
            {order.comment ? (
              <div>Комментарий: <span style={{ color: theme.colors.dark.text }}>{order.comment}</span></div>
            ) : null}
            {order.deliveryDate || order.deliveryTime ? (
              <div>Время: <span style={{ color: theme.colors.dark.text }}>{[order.deliveryDate, order.deliveryTime].filter(Boolean).join(' ')}</span></div>
            ) : null}
          </div>
        </GlassCard>
      </div>

      <SectionDivider title="Состав заказа" />
      <div style={{ padding: `0 ${theme.padding.screen}`, display: 'grid', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
        {items.map((it) => (
          <GlassCard key={`${it.productId}_${it.variant || ''}`} padding="md" variant="elevated">
            <div style={{ display: 'flex', gap: theme.spacing.md }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: `linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.65) 100%), url(${it.image || ''}) center/cover`,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: theme.typography.fontWeight.bold, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{it.name}</div>
                {it.variant ? (
                  <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, marginTop: 4 }}>{it.variant}</div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.sm, color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                  <div>{it.quantity} × {formatCurrency(Number(it.price || 0))}</div>
                  <div style={{ color: theme.colors.dark.text }}>{formatCurrency(Number(it.price || 0) * Number(it.quantity || 0))}</div>
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <SectionDivider title="Итог" />
      <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.xl }}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ display: 'grid', gap: 8, fontSize: theme.typography.fontSize.sm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.colors.dark.textSecondary }}>Подытог</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.colors.dark.textSecondary }}>Бонусы</span>
              <span>{bonusApplied ? `−${formatCurrency(bonusApplied)}` : formatCurrency(0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: theme.typography.fontWeight.bold }}>
              <span>К оплате</span>
              <span>{formatCurrency(finalAmount)}</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default OrderDetails;
