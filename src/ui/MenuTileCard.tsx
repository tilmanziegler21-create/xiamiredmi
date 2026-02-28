import React from 'react';
import { theme } from './theme';
import { MenuTile } from '../config/menuTiles';
import { CherryMascot } from './CherryMascot';

interface MenuTileCardProps {
  tile: MenuTile;
  onClick: () => void;
  badgeText?: string;
}

export const MenuTileCard: React.FC<MenuTileCardProps> = ({ 
  tile, 
  onClick, 
  badgeText 
}) => {
  const skinById: Record<string, any> = {
    catalog: 'green',
    promotions: 'gold',
    bonuses: 'pink',
    cart: 'classic',
    favorites: 'pink',
    orders: 'cosmic',
    referral: 'gold',
    support: 'classic',
    admin: 'cosmic',
    courier: 'green',
  };
  const bgById: Record<string, string> = {
    catalog: 'radial-gradient(120% 90% at 20% 18%, rgba(52,211,153,0.35) 0%, rgba(0,0,0,0) 58%), radial-gradient(110% 90% at 78% 26%, rgba(16,185,129,0.22) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
    promotions: 'radial-gradient(120% 90% at 18% 18%, rgba(251,191,36,0.34) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(245,158,11,0.22) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
    bonuses: 'radial-gradient(120% 90% at 18% 18%, rgba(251,113,133,0.28) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(244,63,94,0.24) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
    orders: 'radial-gradient(120% 90% at 18% 18%, rgba(96,165,250,0.28) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(139,92,246,0.26) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
    cart: 'radial-gradient(120% 90% at 18% 18%, rgba(255,45,85,0.32) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(176,0,58,0.24) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.90) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
    favorites: 'radial-gradient(120% 90% at 18% 18%, rgba(236,72,153,0.28) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(244,63,94,0.20) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.90) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
    referral: 'radial-gradient(120% 90% at 18% 18%, rgba(34,197,94,0.24) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(251,191,36,0.22) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.90) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
    support: 'radial-gradient(120% 90% at 18% 18%, rgba(56,189,248,0.26) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(99,102,241,0.22) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.90) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
    admin: 'radial-gradient(120% 90% at 18% 18%, rgba(139,92,246,0.28) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(96,165,250,0.22) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.90) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
    courier: 'radial-gradient(120% 90% at 18% 18%, rgba(16,185,129,0.28) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(52,211,153,0.18) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.90) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
  };
  const skin = skinById[String(tile.id || '')] || 'classic';
  const atmos = bgById[String(tile.id || '')] || 'linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)';

  const styles = {
    card: {
      position: 'relative' as const,
      height: '112px',
      borderRadius: '22px',
      overflow: 'hidden',
      boxShadow: theme.shadow.card,
      border: '1px solid rgba(255,255,255,0.10)',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      background: atmos,
    },
    imageContainer: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 1,
    },
    image: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
      objectPosition: tile.focal === 'left' ? 'left center' : 
                     tile.focal === 'right' ? 'right center' : 'center center',
    },
    overlay: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 2,
      background: 'linear-gradient(135deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.72) 100%)',
    },
    mascot: {
      position: 'absolute' as const,
      right: -26,
      bottom: -30,
      width: 170,
      height: 170,
      zIndex: 2,
      pointerEvents: 'none' as const,
    },
    content: {
      position: 'relative' as const,
      zIndex: 3,
      height: '100%',
      padding: theme.spacing.md,
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'space-between',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    title: {
      fontSize: 24,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.14em',
      color: theme.colors.dark.text,
      textShadow: '0 10px 26px rgba(0,0,0,0.55)',
      lineHeight: '1.0',
      maxWidth: '70%',
      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
    },
    subtitle: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.dark.textSecondary,
      textShadow: '0 8px 18px rgba(0,0,0,0.55)',
      letterSpacing: '0.10em',
      marginTop: '2px',
      textTransform: 'uppercase' as const,
    },
    footer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    ctaButton: {
      background: 'linear-gradient(180deg, rgba(255,45,85,0.96) 0%, rgba(176,0,58,0.92) 100%)',
      border: '1px solid rgba(255,255,255,0.18)',
      borderRadius: 6,
      padding: '8px 10px',
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: '#ffffff',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '0 14px 26px rgba(0,0,0,0.40), 0 0 22px rgba(255,45,85,0.14)',
    },
    badge: {
      position: 'absolute' as const,
      top: theme.spacing.sm,
      right: theme.spacing.sm,
      background: theme.gradients.primary,
      color: '#ffffff',
      padding: '4px 8px',
      borderRadius: '9999px',
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      zIndex: 4,
      boxShadow: '0 10px 22px rgba(255,45,85,0.18)',
    },
  };

  return (
    <div 
      style={styles.card} 
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div style={styles.imageContainer}>
        <img 
          src={tile.image} 
          alt={tile.title}
          style={{ ...styles.image, opacity: 0.22, filter: 'saturate(1.1) contrast(1.05)' }}
        />
      </div>

      <div style={styles.overlay} />
      <div style={styles.mascot}>
        <CherryMascot variant={skin} size={160} />
      </div>

      <div style={styles.content}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{tile.title}</div>
            {tile.subtitle && (
              <div style={styles.subtitle}>{tile.subtitle}</div>
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <button 
            style={styles.ctaButton}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            {tile.cta}
          </button>
        </div>
      </div>

      {badgeText && (
        <div style={styles.badge}>{badgeText}</div>
      )}
    </div>
  );
};
