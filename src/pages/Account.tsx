import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Coins, Heart, LogOut, MessageCircle, Package, ShoppingCart, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { GlassCard, PrimaryButton, SecondaryButton, theme } from '../ui';

const Account: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const name = String(user?.firstName || user?.username || 'Профиль');
  const uname = user?.username ? `@${user.username}` : '';
  const initials = name ? name.trim().slice(0, 1).toUpperCase() : '';
  const bonusBalance = Number(user?.bonusBalance || 0);

  const tiles = [
    { title: 'Корзина', subtitle: 'Открыть', to: '/cart', icon: <ShoppingCart size={18} />, gradient: theme.gradients.secondary },
    { title: 'Избранное', subtitle: 'Открыть', to: '/favorites', icon: <Heart size={18} />, gradient: theme.gradients.glass },
    { title: 'История покупок', subtitle: 'Открыть', to: '/orders', icon: <Package size={18} />, gradient: theme.gradients.accent },
    { title: 'Поддержка', subtitle: 'Открыть', to: '/support', icon: <MessageCircle size={18} />, gradient: theme.gradients.primary },
  ];

  const styles = {
    page: {
      minHeight: '100vh',
      color: theme.colors.dark.text,
      fontFamily: theme.typography.fontFamily,
      padding: theme.padding.screen,
      paddingBottom: theme.spacing.xl,
      display: 'grid',
      gap: theme.spacing.md,
    },
    userRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    userLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.md,
      minWidth: 0,
      flex: 1,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 999,
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.10)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    },
    userName: {
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      fontSize: theme.typography.fontSize.lg,
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
    },
    userMeta: {
      color: theme.colors.dark.textSecondary,
      fontSize: theme.typography.fontSize.sm,
      marginTop: 2,
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
    },
    balanceRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    balanceLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.md,
      minWidth: 0,
    },
    coin: {
      width: 44,
      height: 44,
      borderRadius: 999,
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.10)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
    },
    balanceValue: {
      fontSize: 28,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.02em',
    },
    badge: {
      marginTop: 6,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 10px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.10)',
      color: theme.colors.dark.textSecondary,
      fontSize: theme.typography.fontSize.xs,
      letterSpacing: '0.14em',
      textTransform: 'uppercase' as const,
    },
    tiles: {
      display: 'grid',
      gap: theme.spacing.md,
    },
    tile: (gradient: string) => ({
      height: 120,
      width: '100%',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: theme.radius.lg,
      background: `linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 55%, rgba(255,255,255,0.00) 100%), ${gradient}`,
      padding: theme.spacing.lg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      cursor: 'pointer',
    }),
    tileText: {
      minWidth: 0,
    },
    tileTitle: {
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.10em',
      textTransform: 'uppercase' as const,
      fontSize: theme.typography.fontSize.base,
      marginBottom: 6,
    },
    tileSub: {
      color: theme.colors.dark.textSecondary,
      fontSize: theme.typography.fontSize.sm,
    },
    tileRight: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      flex: '0 0 auto',
    },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: 999,
      background: 'rgba(255,255,255,0.10)',
      border: '1px solid rgba(255,255,255,0.12)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  };

  return (
    <div style={styles.page}>
      <GlassCard padding="lg" variant="elevated">
        <div style={styles.userRow}>
          <div style={styles.userLeft}>
            <div style={styles.avatar}>{initials || <User size={18} />}</div>
            <div style={{ minWidth: 0 }}>
              <div style={styles.userName}>{name}</div>
              <div style={styles.userMeta}>{uname || 'ELFCHERRY MINI APP'}</div>
            </div>
          </div>
          <SecondaryButton size="sm" onClick={logout}>
            <LogOut size={16} />
            Выйти
          </SecondaryButton>
        </div>
      </GlassCard>

      <GlassCard padding="lg" variant="elevated">
        <div style={styles.balanceRow}>
          <div style={styles.balanceLeft}>
            <div style={styles.coin}>
              <Coins size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>
                Бонусы
              </div>
              <div style={styles.balanceValue}>{bonusBalance.toLocaleString()} 🍒</div>
              <div style={styles.badge}>Кэшбек</div>
            </div>
          </div>
          <PrimaryButton size="sm" onClick={() => navigate('/checkout')} disabled={!bonusBalance}>
            Использовать
          </PrimaryButton>
        </div>
      </GlassCard>

      <div style={styles.tiles}>
        {tiles.map((t) => (
          <div key={t.to} style={styles.tile(t.gradient)} onClick={() => navigate(t.to)} role="button" tabIndex={0}>
            <div style={styles.tileText}>
              <div style={styles.tileTitle}>{t.title}</div>
              <div style={styles.tileSub}>{t.subtitle}</div>
            </div>
            <div style={styles.tileRight}>
              <div style={styles.iconBubble}>{t.icon}</div>
              <ChevronRight size={18} color={theme.colors.dark.textSecondary} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Account;

