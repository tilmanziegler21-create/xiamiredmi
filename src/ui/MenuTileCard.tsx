import React from 'react';
import { theme } from './theme';
import { PrimaryButton } from './PrimaryButton';
import { MenuTile } from '../config/menuTiles';

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
  const styles = {
    card: {
      position: 'relative' as const,
      height: '104px', // 96-110px as specified
      borderRadius: '20px', // 18-22px as specified
      overflow: 'hidden',
      boxShadow: theme.shadow.card,
      border: '1px solid rgba(255,255,255,0.08)', // glass border
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      background: 'transparent',
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
      background: 'linear-gradient(135deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.55) 100%)',
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
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      color: theme.colors.dark.text,
      textShadow: '0 10px 26px rgba(0,0,0,0.55)',
      lineHeight: '1.2',
      maxWidth: '70%',
    },
    subtitle: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.dark.textSecondary,
      textShadow: '0 8px 18px rgba(0,0,0,0.55)',
      letterSpacing: '0.04em',
      marginTop: '2px',
    },
    footer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    ctaButton: {
      background: 'linear-gradient(135deg, rgba(124,58,237,0.9) 0%, rgba(109,40,217,0.9) 100%)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '9999px',
      padding: '6px 12px',
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      color: '#ffffff',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
    },
    badge: {
      position: 'absolute' as const,
      top: theme.spacing.sm,
      right: theme.spacing.sm,
      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
      color: '#ffffff',
      padding: '4px 8px',
      borderRadius: '9999px',
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      zIndex: 4,
      boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
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
      {/* Background Image */}
      <div style={styles.imageContainer}>
        <img 
          src={tile.image} 
          alt={tile.title}
          style={styles.image}
        />
      </div>

      {/* Overlay */}
      <div style={styles.overlay} />

      {/* Content */}
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

      {/* Badge */}
      {badgeText && (
        <div style={styles.badge}>{badgeText}</div>
      )}
    </div>
  );
};
