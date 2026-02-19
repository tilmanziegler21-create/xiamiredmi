import React from 'react';
import { theme } from './theme';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'elevated';
  style?: React.CSSProperties;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  padding = 'md',
  variant = 'default',
  style,
  ...rest
}) => {
  const enableBlur = (() => {
    if (typeof window === 'undefined') return true;
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return false;
    try {
      return typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', 'blur(1px)');
    } catch {
      return false;
    }
  })();

  const paddingMap = {
    sm: theme.spacing.sm,
    md: theme.spacing.lg,
    lg: theme.spacing['2xl'],
  };

  const baseStyles = {
    background: theme.colors.dark.card,
    backdropFilter: enableBlur ? `blur(${theme.blur.glass})` : undefined,
    WebkitBackdropFilter: enableBlur ? `blur(${theme.blur.glass})` : undefined,
    border: theme.border.glass,
    borderRadius: theme.radius.lg,
    boxShadow: variant === 'elevated' ? `${theme.shadow.card}, ${theme.shadow.glow}` : theme.shadow.card,
    padding: paddingMap[padding],
  };

  return (
    <div 
      className={`${className}`}
      style={{ ...baseStyles, ...(style || {}) }}
      {...rest}
    >
      {children}
    </div>
  );
};
