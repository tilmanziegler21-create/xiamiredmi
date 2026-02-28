import React from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from './theme';
import { GlassCard } from './GlassCard';
import { formatCurrency } from '../lib/currency';
import { useAnalytics } from '../hooks/useAnalytics';
import { blurStyle } from './blur';
import { ChevronRight, Gift, Grid, Heart, MapPin, Package, ShoppingCart, Star, Headphones } from 'lucide-react';

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  userBalance?: number;
  cartItemsCount?: number;
  city?: string | null;
  onCityClick?: () => void;
  userStatus?: string | null;
}

export const DrawerMenu: React.FC<DrawerMenuProps> = ({
  isOpen,
  onClose,
  userBalance = 220,
  cartItemsCount = 0,
  city = null,
  onCityClick,
}) => {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  if (!isOpen) return null;

  const go = (id: string, route: string) => {
    trackEvent('drawer_nav', { id, route });
    navigate(route);
    onClose();
  };

  const groups = [
    {
      title: 'МАГАЗИН',
      items: [
        { id: 'catalog', title: 'Каталог', icon: <Grid size={18} />, right: '', onClick: () => go('catalog', '/catalog') },
        { id: 'promotions', title: 'Акции', icon: <Gift size={18} />, right: '', onClick: () => go('promotions', '/promotions') },
      ],
    },
    {
      title: 'АККАУНТ',
      items: [
        { id: 'bonuses', title: 'Бонусы', icon: <Star size={18} />, right: `${formatCurrency(userBalance)}`, onClick: () => go('bonuses', '/bonuses') },
        { id: 'cart', title: 'Корзина', icon: <ShoppingCart size={18} />, right: cartItemsCount > 0 ? String(cartItemsCount) : '', onClick: () => go('cart', '/cart') },
        { id: 'favorites', title: 'Избранное', icon: <Heart size={18} />, right: '', onClick: () => go('favorites', '/favorites') },
        { id: 'orders', title: 'История', icon: <Package size={18} />, right: '', onClick: () => go('orders', '/orders') },
      ],
    },
    {
      title: 'ПРОЧЕЕ',
      items: [
        { id: 'support', title: 'Поддержка', icon: <Headphones size={18} />, right: '', onClick: () => go('support', '/support') },
        { id: 'city', title: 'Город', icon: <MapPin size={18} />, right: city || 'не выбран', onClick: () => { onCityClick?.(); onClose(); } },
      ],
    },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: theme.zIndex.drawer,
      display: 'flex',
    }}>
      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: theme.zIndex.overlay,
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />

      {/* Drawer Panel */}
      <div style={{
        position: 'relative',
        width: '80%',
        maxWidth: '320px',
        height: '100%',
        background: theme.colors.dark.bg,
        ...blurStyle(theme.blur.glass),
        zIndex: theme.zIndex.drawer,
        padding: theme.padding.screen,
        overflowY: 'auto',
        animation: 'slideInLeft 0.25s ease-out',
      }}>
        <style>{`
          @keyframes slideInLeft {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.xl,
        }}>
          <h2 style={{
            color: theme.colors.dark.text,
            fontSize: 34,
            fontWeight: theme.typography.fontWeight.bold,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            margin: 0,
          }}>
            Меню
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: theme.colors.dark.text,
              fontSize: '24px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {groups.map((g) => (
          <div key={g.title} style={{ marginBottom: theme.spacing.lg }}>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.62)',
              marginBottom: theme.spacing.sm,
              fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
            }}>
              {g.title}
            </div>
            <GlassCard padding="md" variant="elevated" style={{ padding: 0, overflow: 'hidden' }}>
              {g.items.map((it, idx) => (
                <div
                  key={it.id}
                  role="button"
                  onClick={it.onClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.md,
                    padding: '14px 14px',
                    borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.30)',
                      border: '1px solid rgba(255,255,255,0.10)',
                    }}>
                      {it.icon}
                    </div>
                    <div style={{
                      color: theme.colors.dark.text,
                      fontSize: theme.typography.fontSize.base,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      fontWeight: theme.typography.fontWeight.bold,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 170,
                      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
                    }}>
                      {it.title}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
                    {it.right ? (
                      <div style={{
                        fontSize: theme.typography.fontSize.xs,
                        letterSpacing: '0.10em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.70)',
                        whiteSpace: 'nowrap',
                        maxWidth: 92,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {it.right}
                      </div>
                    ) : null}
                    <ChevronRight size={18} color="rgba(255,255,255,0.55)" />
                  </div>
                </div>
              ))}
            </GlassCard>
          </div>
        ))}
      </div>
    </div>
  );
};
