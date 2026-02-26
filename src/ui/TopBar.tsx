import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { theme } from './theme';
import { IconButton } from './IconButton';
import { Menu, User, Coins, ShoppingCart, ArrowLeft, Settings, ShoppingBag, RotateCcw } from 'lucide-react';
import { blurStyle } from './blur';

interface TopBarProps {
  onMenuClick: () => void;
  onCartClick?: () => void;
  userName?: string;
  bonusMultiplier?: number;
  avatarUrl?: string;
  cartCount?: number;
  showBackButton?: boolean;
  onBackClick?: () => void;
  showSettings?: boolean;
  onSettingsClick?: () => void;
  onBonusClick?: () => void;
  onProfileClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onMenuClick,
  onCartClick,
  userName,
  bonusMultiplier = 4,
  avatarUrl,
  cartCount = 0,
  showBackButton = false,
  onBackClick,
  showSettings = false,
  onSettingsClick,
  onBonusClick,
  onProfileClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [duckBroken, setDuckBroken] = React.useState(false);
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

  const handleBonusClick = () => {
    if (onBonusClick) return onBonusClick();
    navigate('/bonuses');
  };

  const handleProfileClick = () => {
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
    brand: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
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
    bonusPill: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.xs,
      background: theme.colors.dark.accentGold,
      border: 'none',
      borderRadius: 999,
      padding: isNarrow ? '6px 10px' : '6px 12px',
      color: '#000',
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      position: 'relative' as const,
    },
    bonusPlus: {
      position: 'absolute' as const,
      right: -6,
      top: -6,
      width: 18,
      height: 18,
      borderRadius: 999,
      background: theme.colors.dark.accentGold,
      color: '#000',
      fontSize: 12,
      fontWeight: theme.typography.fontWeight.bold,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 10px 20px rgba(0,0,0,0.35)',
    },
    avatar: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      border: theme.border.glass,
      background: avatarUrl ? `url(${avatarUrl}) center/cover` : theme.gradients.secondary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.dark.text,
      position: 'relative' as const,
    },
    duckAvatar: {
      width: 32,
      height: 32,
      borderRadius: 999,
      border: theme.border.glass,
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
    },
    duckImg: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
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
        {!isNarrow ? (
          <div style={styles.duckAvatar}>
            {!duckBroken ? (
              <img
                src="/assets/elfcherry/ui/duck-avatar.png"
                alt=""
                style={styles.duckImg}
                onError={() => setDuckBroken(true)}
              />
            ) : (
              <ShoppingBag size={18} />
            )}
          </div>
        ) : null}
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
            <div style={styles.brand}>ELFCHERRY</div>
            <div style={styles.brandSub}>mini app 24/7</div>
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
        <div style={{ ...styles.bonusPill, cursor: 'pointer' }} onClick={handleBonusClick} role="button" tabIndex={0}>
          {!isNarrow ? <Coins size={16} /> : null}
          <span>x{bonusMultiplier}</span>
          {!isNarrow ? <RotateCcw size={14} /> : null}
          <span style={styles.bonusPlus}>+</span>
        </div>
        {showSettings ? (
          <IconButton
            icon={<Settings size={20} />}
            onClick={onSettingsClick}
            variant="glass"
            size="md"
          />
        ) : (
          <div style={{ ...styles.avatar, cursor: 'pointer' }} onClick={handleProfileClick} role="button" tabIndex={0}>
            {!avatarUrl && <User size={20} />}
          </div>
        )}
      </div>
    </div>
  );
};
