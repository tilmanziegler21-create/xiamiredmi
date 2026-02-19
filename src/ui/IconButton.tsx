import React from 'react';
import { theme } from './theme';

interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'default' | 'glass';
  size?: 'sm' | 'md';
  className?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const sizeStyles = {
    sm: {
      width: '32px',
      height: '32px',
      fontSize: '16px',
    },
    md: {
      width: '40px',
      height: '40px',
      fontSize: '20px',
    },
  };

  const variantStyles = {
    default: {
      background: 'rgba(255,255,255,0.1)',
      border: theme.border.glass,
    },
    glass: {
      background: 'rgba(255,255,255,0.05)',
      border: theme.border.glass,
      backdropFilter: `blur(${theme.blur.glass})`,
    },
  };

  const styles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    color: theme.colors.dark.text,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  return (
    <button
      style={styles}
      onClick={onClick}
      className={`${className} hover:opacity-80 active:scale-95`}
    >
      {icon}
    </button>
  );
};
