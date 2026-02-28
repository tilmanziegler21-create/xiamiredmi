import React from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from './theme';
import { IconButton } from './IconButton';
import { Menu, ShoppingCart, ArrowLeft, Settings } from 'lucide-react';
import { blurStyle } from './blur';
import { CherryMascot } from './CherryMascot';

interface TopBarProps {
  onMenuClick: () => void;
  onCartClick?: () => void;
  userName?: string;
  cartCount?: number;
  showBackButton?: boolean;
  onBackClick?: () => void;
  showSettings?: boolean;
  onSettingsClick?: () => void;
  onProfileClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onMenuClick,
  onCartClick,
  cartCount = 0,
  showBackButton = false,
  onBackClick,
  showSettings = false,
  onSettingsClick,
  onProfileClick,
}) => {
  const navigate = useNavigate();
  const [isNarrow, setIsNarrow] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 360px)');
    const apply = () => setIsNarrow(Boolean(mq.matches));
    apply();
    try {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    } catch {
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, []);

  const handleLogoClick = () => {
    navigate('/home');
  };

  const handleSettingsClick = () => {
    if (showSettings && onSettingsClick) return onSettingsClick();
    if (onProfileClick) return onProfileClick();
    navigate('/profile');
  };

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(-1);
    }
  };
  const styles = {
    container: {
      position: 'sticky' as const,
      top: 0,
      zIndex: theme.zIndex.header,
      height: '64px',
      padding: `0 ${theme.padding.screen}`,
      background: 'rgba(15, 12, 26, 0.72)',
      ...blurStyle(theme.blur.glass),
      borderBottom: theme.border.glass,
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'center',
      columnGap: theme.spacing.sm,
    },
    leftSection: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minWidth: 0,
    },
    centerSection: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.md,
      minWidth: 0,
      overflow: 'hidden' as const,
    },
    brandWrap: {
      minWidth: 0,
      maxWidth: isNarrow ? 140 : 220,
    },
    logoRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    brand: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.10em',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
    },
    brandSub: {
      fontSize: theme.typography.fontSize.xs,
      opacity: 0.7,
      marginTop: 2,
      letterSpacing: '0.16em',
      textTransform: 'uppercase' as const,
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
    },
    cartBadge: {
      position: 'absolute' as const,
      top: -6,
      right: -6,
      width: 18,
      height: 18,
      borderRadius: 999,
      background: theme.colors.dark.primary,
      color: theme.colors.dark.text,
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.bold,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
    },
    rightSection: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minWidth: 0,
    },
    cartButton: {
      position: 'relative' as const,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.leftSection}>
        {showBackButton ? (
          <IconButton
            icon={<ArrowLeft size={20} />}
            onClick={handleBackClick}
            variant="glass"
            size="md"
          />
        ) : (
          <IconButton
            icon={<Menu size={20} />}
            onClick={onMenuClick}
            variant="glass"
            size="md"
          />
        )}
      </div>

      <div style={styles.centerSection}>
        <div style={styles.brandWrap}>
          <div 
            style={{ textAlign: 'center', lineHeight: 1.05, cursor: 'pointer' }} 
            onClick={handleLogoClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleLogoClick();
              }
            }}
          >
            <div style={styles.logoRow}>
              <CherryMascot variant="classic" size={isNarrow ? 34 : 40} />
              <div style={{ minWidth: 0 }}>
                <div style={styles.brand}>ELFCHERRY</div>
                <div style={styles.brandSub}>mini app 24/7</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.rightSection}>
        <div style={styles.cartButton}>
          <IconButton
            icon={<ShoppingCart size={18} />}
            onClick={onCartClick}
            variant="glass"
            size="sm"
          />
          {cartCount > 0 ? <div style={styles.cartBadge}>{Math.min(99, cartCount)}</div> : null}
        </div>
        <IconButton
          icon={<Settings size={20} />}
          onClick={handleSettingsClick}
          variant="glass"
          size="md"
        />
      </div>
    </div>
  );
};
