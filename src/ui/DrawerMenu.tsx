import React from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from './theme';
import { GlassCard } from './GlassCard';
import { PrimaryButton } from './PrimaryButton';
import { formatCurrency } from '../lib/currency';
import { MenuTileCard } from './MenuTileCard';
import { menuTiles, adminTiles, courierTiles } from '../config/menuTiles';
import { useAnalytics } from '../hooks/useAnalytics';

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
  userStatus = null,
}) => {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  if (!isOpen) return null;

  const handleTileClick = (tile: any) => {
    trackEvent(tile.analyticsEvent, { tileId: tile.id, route: tile.route });
    navigate(tile.route);
    onClose();
  };

  // Update cart badge text dynamically
  const updatedMenuTiles = menuTiles.map(tile => {
    if (tile.id === 'cart') {
      return {
        ...tile,
        badgeText: cartItemsCount > 0 ? String(cartItemsCount) : undefined,
        subtitle: cartItemsCount > 0 ? `${cartItemsCount} товаров` : 'пусто'
      };
    }
    if (tile.id === 'bonuses') {
      return {
        ...tile,
        subtitle: `${formatCurrency(userBalance)} кэшбек`
      };
    }
    return tile;
  });

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
        backdropFilter: `blur(${theme.blur.glass})`,
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
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.bold,
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

        <GlassCard padding="md" variant="elevated" style={{ marginBottom: theme.spacing.lg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                color: theme.colors.dark.textSecondary,
                fontSize: theme.typography.fontSize.xs,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                Город
              </div>
              <div style={{
                color: theme.colors.dark.text,
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {city || 'не выбран'}
              </div>
            </div>
            <PrimaryButton
              size="sm"
              onClick={() => {
                onCityClick?.();
              }}
            >
              сменить
            </PrimaryButton>
          </div>
        </GlassCard>

        {/* Menu Tiles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
          {/* Regular menu tiles */}
          {updatedMenuTiles.map((tile) => (
            <MenuTileCard
              key={tile.id}
              tile={tile}
              onClick={() => handleTileClick(tile)}
              badgeText={tile.badgeText}
            />
          ))}
          
          {/* Admin tiles */}
          {String(userStatus || '') === 'admin' && adminTiles.map((tile) => (
            <MenuTileCard
              key={tile.id}
              tile={tile}
              onClick={() => handleTileClick(tile)}
            />
          ))}
          
          {/* Courier tiles */}
          {(String(userStatus || '') === 'courier' || String(userStatus || '') === 'admin') && courierTiles.map((tile) => (
            <MenuTileCard
              key={tile.id}
              tile={tile}
              onClick={() => handleTileClick(tile)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
