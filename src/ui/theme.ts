export const theme = {
  radius: {
    sm: '12px',
    md: '16px',
    lg: '22px',
  },
  blur: {
    glass: 'var(--blur-glass)',
  },
  border: {
    glass: '1px solid var(--border-glass)',
  },
  shadow: {
    card: 'var(--shadow-card)',
    glow: 'var(--shadow-glow)',
  },
  gap: '12px',
  padding: {
    screen: '16px',
  },
  colors: {
    dark: {
      bg: '#0f0c1a',
      card: 'rgba(255,255,255,0.05)',
      border: 'rgba(255,255,255,0.10)',
      text: '#ffffff',
      textSecondary: 'rgba(255,255,255,0.55)',
      primary: '#7c3aed',
      secondary: '#6d28d9',
      accent: '#7c3aed',
      accentGreen: '#00ff88',
      accentPurple: '#4f46e5',
      accentRed: '#ff3b30',
      accentGold: '#ffd60a',
    },
  },
  gradients: {
    primary: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    secondary: 'linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(79,70,229,0.12) 100%)',
    accent: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
    glass: 'linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(79,70,229,0.12) 100%)',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '32px',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
  },
  zIndex: {
    drawer: 1000,
    overlay: 999,
    header: 100,
    content: 1,
  },
} as const;
