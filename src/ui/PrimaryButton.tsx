import React from 'react';
import { theme } from './theme';

interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  size = 'md',
  className = '',
  style,
}) => {
  const sizeStyles = {
    sm: { padding: '8px 16px', fontSize: theme.typography.fontSize.sm },
    md: { padding: '12px 24px', fontSize: theme.typography.fontSize.base },
    lg: { padding: '16px 32px', fontSize: theme.typography.fontSize.lg },
  };

  const styles = {
    background: theme.gradients.accent,
    color: theme.colors.dark.text,
    border: 'none',
    borderRadius: 999,
    fontWeight: theme.typography.fontWeight.semibold,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    width: fullWidth ? '100%' : 'auto',
    boxShadow: theme.shadow.card,
    transition: 'all 0.2s ease',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    ...sizeStyles[size],
    ...(style || {}),
  };

  return (
    <button
      style={styles}
      onClick={onClick}
      disabled={disabled}
      className={`${className} hover:opacity-90 active:scale-95`}
    >
      {children}
    </button>
  );
};
