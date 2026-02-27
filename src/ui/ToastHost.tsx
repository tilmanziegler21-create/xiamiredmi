import React from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { theme } from './theme';
import { useToastStore } from '../store/useToastStore';
import { blurStyle } from './blur';

export const ToastHost: React.FC = () => {
  const { toasts, remove } = useToastStore();

  if (!toasts.length) return null;

  const toastStyles: Record<string, { border: string; icon: React.ReactNode }> = {
    success: { border: '1px solid rgba(74,222,128,0.4)', icon: <CheckCircle2 size={18} color="#4ade80" /> },
    error: { border: '1px solid rgba(239,68,68,0.4)', icon: <XCircle size={18} color="#ef4444" /> },
    info: { border: '1px solid rgba(255,45,85,0.4)', icon: <Info size={18} color={theme.colors.dark.primary} /> },
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: theme.spacing.lg,
        right: theme.spacing.lg,
        top: `calc(${theme.spacing.lg} + var(--safe-area-top, 0px))`,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.sm,
        pointerEvents: 'none',
      }}
    >
      {toasts.slice(-3).map((t) => (
        (() => {
          const st = toastStyles[t.variant] || toastStyles.info;
          return (
        <button
          key={t.id}
          onClick={() => remove(t.id)}
          style={{
            pointerEvents: 'auto',
            width: '100%',
            borderRadius: theme.radius.lg,
            border: st.border,
            background: 'rgba(255,255,255,0.05)',
            ...blurStyle(theme.blur.glass),
            boxShadow: theme.shadow.card,
            padding: `${theme.spacing.md} ${theme.spacing.lg}`,
            color: theme.colors.dark.text,
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <span style={{ flex: '0 0 auto' }}>{st.icon}</span>
          <span style={{ fontSize: theme.typography.fontSize.sm, lineHeight: '1.3' }}>{t.message}</span>
        </button>
          );
        })()
      ))}
    </div>
  );
};
