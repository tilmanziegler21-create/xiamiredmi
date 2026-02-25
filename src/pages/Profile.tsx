import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Star, Gift, Clock, Package, ChevronRight, Heart } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { bonusesAPI, favoritesAPI, orderAPI } from '../services/api';
import { useAnalytics } from '../hooks/useAnalytics';
import WebApp from '@twa-dev/sdk';
import { useCityStore } from '../store/useCityStore';
import { GlassCard, PrimaryButton, SecondaryButton, theme } from '../ui';
import { blurStyle } from '../ui/blur';
import { formatCurrency } from '../lib/currency';

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  deliveryMethod: string;
  createdAt: string;
  itemCount: number;
}

type FavoriteItem = {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  image: string;
};

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { trackEvent } = useAnalytics();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'bonuses' | 'favorites'>('orders');
  const [bonusBalance, setBonusBalance] = useState(0);
  const [bonusHistory, setBonusHistory] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const { city } = useCityStore();

  useEffect(() => {
    loadOrderHistory();
    loadBonuses();
    trackEvent('view_profile', { user_id: user?.tgId });
  }, [city]);

  const loadOrderHistory = async () => {
    try {
      setLoading(true);
      if (!city) {
        setOrders([]);
        return;
      }
      const response = await orderAPI.getHistory(city);
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Failed to load order history:', error);
      WebApp.showAlert('Ошибка загрузки истории заказов');
    } finally {
      setLoading(false);
    }
  };

  const loadBonuses = async () => {
    try {
      const [b, h] = await Promise.all([bonusesAPI.balance(), bonusesAPI.history()]);
      setBonusBalance(Number(b.data.balance || 0));
      setBonusHistory(h.data.history || []);
    } catch (e) {
      console.error('Failed to load bonuses:', e);
      setBonusBalance(0);
      setBonusHistory([]);
    }
  };

  const loadFavorites = async () => {
    try {
      if (!city) {
        setFavorites([]);
        return;
      }
      const resp = await favoritesAPI.list(city);
      setFavorites(resp.data.favorites || []);
    } catch (e) {
      console.error('Failed to load favorites:', e);
      setFavorites([]);
    }
  };

  const statusStyles: Record<string, { bg: string; text: string }> = {
    buffer: { bg: 'rgba(255,255,255,0.10)', text: 'rgba(255,255,255,0.80)' },
    pending: { bg: 'rgba(255,214,10,0.18)', text: 'rgba(255,214,10,0.95)' },
    paid: { bg: 'rgba(0,122,255,0.18)', text: 'rgba(0,122,255,0.95)' },
    assigned: { bg: 'rgba(0,122,255,0.18)', text: 'rgba(0,122,255,0.95)' },
    picked_up: { bg: 'rgba(175,82,222,0.20)', text: 'rgba(191,90,242,0.98)' },
    delivered: { bg: 'rgba(0,255,136,0.18)', text: 'rgba(0,255,136,0.95)' },
    cancelled: { bg: 'rgba(255,59,48,0.18)', text: 'rgba(255,59,48,0.95)' },
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'buffer': return 'В обработке';
      case 'pending': return 'Ожидает';
      case 'paid': return 'Оплачен';
      case 'assigned': return 'Курьер назначен';
      case 'picked_up': return 'В пути';
      case 'delivered': return 'Доставлен';
      case 'cancelled': return 'Отменён';
      default: return 'В обработке';
    }
  };

  const getUserLevelInfo = () => {
    switch (user?.status) {
      case 'VIP':
        return {
          title: 'VIP Клиент',
          color: '#ff2d55',
          bgColor: 'rgba(255,45,85,0.14)',
          icon: '👑',
          benefits: ['5% скидка на все товары', 'Приоритетная доставка', 'Персональный менеджер']
        };
      case 'ELITE':
        return {
          title: 'Elite Клиент',
          color: 'rgba(255,214,10,0.95)',
          bgColor: 'rgba(255,214,10,0.12)',
          icon: '💎',
          benefits: ['10% скидка на все товары', 'Бесплатная доставка', 'Эксклюзивные предложения']
        };
      default:
        return {
          title: 'Обычный клиент',
          color: 'rgba(255,255,255,0.75)',
          bgColor: 'rgba(255,255,255,0.06)',
          icon: '⭐',
          benefits: ['Бонусная программа', 'Акции и скидки']
        };
    }
  };

  const userLevel = getUserLevelInfo();

  const styles = {
    page: {
      minHeight: '100vh',
      color: theme.colors.dark.text,
      fontFamily: theme.typography.fontFamily,
      paddingBottom: theme.spacing.xl,
    },
    headerCard: {
      margin: `0 ${theme.padding.screen} ${theme.spacing.lg}`,
      borderRadius: 22,
      background: 'linear-gradient(135deg, rgba(255,45,85,0.15) 0%, rgba(176,0,58,0.1) 100%)',
      border: '1px solid rgba(255,45,85,0.3)',
      ...blurStyle(theme.blur.glass),
      boxShadow: theme.shadow.card,
    },
    headerTop: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    headerTitle: {
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 999,
      background: 'rgba(255,255,255,0.10)',
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
    },
    userName: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    },
    userMeta: {
      color: 'rgba(255,255,255,0.70)',
      fontSize: theme.typography.fontSize.sm,
      marginTop: 4,
    },
    balanceRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    balanceValue: {
      fontSize: 28,
      fontWeight: theme.typography.fontWeight.bold,
      color: '#ff2d55',
      letterSpacing: '0.02em',
    },
    tierBox: {
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      border: '1px solid rgba(255,255,255,0.10)',
    },
    tabsWrap: {
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.lg,
    },
    tabs: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: theme.spacing.sm,
      padding: 6,
      borderRadius: theme.radius.lg,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.10)',
    },
    tab: (active: boolean) => ({
      cursor: 'pointer',
      borderRadius: 999,
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      color: active ? '#fff' : 'rgba(255,255,255,0.55)',
      background: active ? 'linear-gradient(135deg, #ff2d55 0%, #b0003a 100%)' : 'rgba(255,255,255,0.06)',
      border: active ? '1px solid rgba(255,45,85,0.42)' : '1px solid rgba(255,255,255,0.14)',
      boxShadow: active ? theme.shadow.glow : 'none',
      transition: 'all 0.2s ease',
    }),
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
  };

  return (
    <div style={styles.page}>
      <GlassCard padding="lg" variant="elevated" style={styles.headerCard}>
        <div style={styles.headerTop}>
          <div style={styles.headerTitle}>Профиль</div>
          <SecondaryButton size="sm" onClick={() => navigate('/home')} style={{ borderRadius: 999 }}>
            <User size={18} />
          </SecondaryButton>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <div style={styles.avatar}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>{userLevel.icon}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={styles.userName}>{user?.firstName || 'Пользователь'}</div>
            <div style={styles.userMeta}>
              {userLevel.title}{user?.username ? ` • @${user.username}` : ''}
            </div>
          </div>
        </div>
      </GlassCard>

      <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.lg }}>
        <GlassCard padding="lg" variant="elevated">
          <div style={styles.balanceRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <Star size={18} color="rgba(255,214,10,0.95)" />
              <div style={{ fontWeight: theme.typography.fontWeight.bold, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                Бонусный баланс
              </div>
            </div>
            <div style={styles.balanceValue}>{bonusBalance.toLocaleString()}</div>
          </div>

          <div style={{ ...styles.tierBox, background: userLevel.bgColor }}>
            <div style={{ fontWeight: theme.typography.fontWeight.bold, color: userLevel.color, marginBottom: theme.spacing.sm }}>
              {userLevel.title}
            </div>
            <div style={{ display: 'grid', gap: 6, color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
              {userLevel.benefits.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ opacity: 0.8 }}>•</span>
                  <span style={{ minWidth: 0 }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      <div style={styles.tabsWrap}>
        <div style={styles.tabs}>
          <button
            type="button"
            style={styles.tab(activeTab === 'orders')}
            onClick={() => {
              setActiveTab('orders');
              trackEvent('profile_tab_click', { tab: 'orders' });
            }}
          >
            <Package size={16} />
            Заказы
          </button>
          <button
            type="button"
            style={styles.tab(activeTab === 'bonuses')}
            onClick={() => {
              setActiveTab('bonuses');
              trackEvent('profile_tab_click', { tab: 'bonuses' });
            }}
          >
            <Gift size={16} />
            Бонусы
          </button>
          <button
            type="button"
            style={styles.tab(activeTab === 'favorites')}
            onClick={() => {
              setActiveTab('favorites');
              loadFavorites();
              trackEvent('profile_tab_click', { tab: 'favorites' });
            }}
          >
            <Heart size={16} />
            Избранное
          </button>
        </div>
      </div>

      <div style={{ padding: `0 ${theme.padding.screen}`, paddingBottom: theme.spacing.lg }}>
        {activeTab === 'orders' ? (
          loading ? (
            <div style={{ display: 'grid', gap: theme.spacing.md }}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 90,
                    borderRadius: theme.radius.lg,
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: 'rgba(255,255,255,0.08)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <GlassCard padding="lg" variant="elevated">
              <div style={{ textAlign: 'center' as const, color: theme.colors.dark.textSecondary, marginBottom: theme.spacing.md }}>
                У вас ещё нет заказов
              </div>
              <PrimaryButton fullWidth onClick={() => navigate('/catalog')}>
                Перейти в каталог
              </PrimaryButton>
            </GlassCard>
          ) : (
            <div style={{ display: 'grid', gap: theme.spacing.md }}>
              {orders.slice(0, 50).map((order) => (
                <GlassCard key={order.id} padding="lg" variant="elevated">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: theme.typography.fontWeight.bold, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                        Заказ #{order.id}
                      </div>
                      <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, marginTop: 4 }}>
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ru-RU') : ''}
                        {order.itemCount ? ` • ${order.itemCount} поз.` : ''}
                      </div>
                    </div>
                    <div style={styles.status(order.status)}>{getStatusText(order.status)}</div>
                  </div>

                  <div style={{ height: theme.spacing.md }} />

                  <div style={{ display: 'grid', gap: 8, color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md }}>
                      <span>Сумма</span>
                      <span style={{ color: theme.colors.dark.text, fontWeight: theme.typography.fontWeight.bold }}>
                        {formatCurrency(Number(order.totalAmount || 0))}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md }}>
                      <span>Получение</span>
                      <span style={{ color: theme.colors.dark.text }}>
                        {String(order.deliveryMethod || '').toLowerCase() === 'courier' ? 'Курьер' : 'Самовывоз'}
                      </span>
                    </div>
                  </div>

                  <div style={{ height: theme.spacing.md }} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm }}>
                    <PrimaryButton
                      fullWidth
                      size="sm"
                      onClick={() => {
                        navigate(`/order/${encodeURIComponent(order.id)}`);
                        trackEvent('view_order_details', { order_id: order.id });
                      }}
                    >
                      Подробнее
                    </PrimaryButton>
                    <SecondaryButton
                      fullWidth
                      size="sm"
                      onClick={() => {
                        WebApp.showAlert('Функция повторения заказа в разработке');
                      }}
                    >
                      Повторить
                    </SecondaryButton>
                  </div>
                </GlassCard>
              ))}
            </div>
          )
        ) : null}

        {activeTab === 'bonuses' ? (
          <div style={{ display: 'grid', gap: theme.spacing.md }}>
            <GlassCard padding="lg" variant="elevated">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
                <div style={{ color: theme.colors.dark.textSecondary }}>Доступно бонусов</div>
                <div style={{ fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, color: '#ff2d55' }}>
                  {bonusBalance.toLocaleString()}
                </div>
              </div>
            </GlassCard>
            <GlassCard padding="lg" variant="elevated">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
                <div style={{ fontWeight: theme.typography.fontWeight.bold, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                  История
                </div>
                <Clock size={18} color={theme.colors.dark.textSecondary} />
              </div>
              {bonusHistory.length === 0 ? (
                <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>Пока нет операций</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {bonusHistory.slice(0, 20).map((x: any) => (
                    <div key={String(x.id || x._id || x.created_at)} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, fontSize: theme.typography.fontSize.sm }}>
                      <div style={{ color: theme.colors.dark.textSecondary, minWidth: 0 }}>
                        {String(x.type || 'Операция')}
                      </div>
                      <div style={{ fontWeight: theme.typography.fontWeight.bold, color: Number(x.amount) < 0 ? 'rgba(255,59,48,0.95)' : 'rgba(0,255,136,0.95)' }}>
                        {Number(x.amount) < 0 ? '' : '+'}{Number(x.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        ) : null}

        {activeTab === 'favorites' ? (
          favorites.length === 0 ? (
            <GlassCard padding="lg" variant="elevated">
              <div style={{ textAlign: 'center' as const, color: theme.colors.dark.textSecondary, marginBottom: theme.spacing.md }}>
                Пока нет избранных товаров
              </div>
              <PrimaryButton fullWidth onClick={() => navigate('/catalog')}>
                Перейти в каталог
              </PrimaryButton>
            </GlassCard>
          ) : (
            <div style={{ display: 'grid', gap: theme.spacing.md }}>
              {favorites.slice(0, 50).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/product/${encodeURIComponent(p.id)}`)}
                  style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                >
                  <GlassCard padding="lg" variant="elevated">
                    <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: theme.radius.lg,
                          border: '1px solid rgba(255,255,255,0.14)',
                          background: 'rgba(255,255,255,0.06)',
                          overflow: 'hidden',
                          flex: '0 0 auto',
                        }}
                      >
                        {p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: theme.typography.fontWeight.bold, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                          {p.name}
                        </div>
                        <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, marginTop: 4 }}>
                          {p.brand}
                        </div>
                      </div>
                      <ChevronRight size={18} color={theme.colors.dark.textSecondary} />
                    </div>
                  </GlassCard>
                </button>
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
};

export default Profile;
