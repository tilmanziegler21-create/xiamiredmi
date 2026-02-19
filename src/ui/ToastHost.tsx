import React from 'react';
import { theme } from './theme';
import { useToastStore } from '../store/useToastStore';

export const ToastHost: React.FC = () => {
  const { toasts, remove } = useToastStore();

  if (!toasts.length) return null;

  const variantColor: Record<string, string> = {
    success: theme.colors.dark.accentGreen,
    error: theme.colors.dark.accentRed,
    info: theme.colors.dark.accentPurple,
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: theme.spacing.lg,
        right: theme.spacing.lg,
        bottom: `calc(${theme.spacing.xl} + var(--safe-area-bottom, 0px))`,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.sm,
        pointerEvents: 'none',
      }}
    >
      {toasts.slice(-3).map((t) => (
        <button
          key={t.id}
          onClick={() => remove(t.id)}
          style={{
            pointerEvents: 'auto',
            width: '100%',
            borderRadius: theme.radius.lg,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(12, 10, 26, 0.72)',
            backdropFilter: `blur(${theme.blur.glass})`,
            boxShadow: theme.shadow.card,
            padding: `${theme.spacing.md} ${theme.spacing.lg}`,
            color: theme.colors.dark.text,
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: variantColor[t.variant] || theme.colors.dark.accentPurple,
              boxShadow: `0 0 18px ${variantColor[t.variant] || theme.colors.dark.accentPurple}`,
              flex: '0 0 auto',
            }}
          />
          <span style={{ fontSize: theme.typography.fontSize.sm, lineHeight: '1.3' }}>{t.message}</span>
        </button>
      ))}
    </div>
  );
};

