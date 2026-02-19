import React from 'react';
import { theme } from './theme';

interface ChipBadgeProps {
  children: React.ReactNode;
  variant?: 'new' | 'discount' | 'bonus' | 'default';
  size?: 'sm' | 'md';
}

export const ChipBadge: React.FC<ChipBadgeProps> = ({ 
  children, 
  variant = 'default',
  size = 'sm'
}) => {
  const variantStyles = {
    new: {
      background: theme.colors.dark.accentRed,
      color: theme.colors.dark.text,
    },
    discount: {
      background: theme.colors.dark.accentGreen,
      color: theme.colors.dark.text,
    },
    bonus: {
      background: theme.colors.dark.accentGold,
      color: '#000000',
    },
    default: {
      background: 'rgba(255,255,255,0.2)',
      color: theme.colors.dark.text,
    },
  };

  const sizeStyles = {
    sm: {
      padding: '4px 8px',
      fontSize: theme.typography.fontSize.xs,
      borderRadius: '12px',
    },
    md: {
      padding: '6px 12px',
      fontSize: theme.typography.fontSize.sm,
      borderRadius: '14px',
    },
  };

  const styles = {
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: theme.typography.fontWeight.semibold,
    ...variantStyles[variant],
    ...sizeStyles[size],
  };

  return <span style={styles}>{children}</span>;
};