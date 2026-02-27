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
      primary: '#ff2d55',
      secondary: '#b0003a',
      accent: '#ff2d55',
      accentGreen: '#00ff88',
      accentPurple: '#ff2d55',
      accentRed: '#ff2d55',
      accentGold: '#ffd60a',
    },
  },
  gradients: {
    primary: 'linear-gradient(135deg, #ff2d55 0%, #b0003a 100%)',
    secondary: 'linear-gradient(135deg, rgba(255,45,85,0.18) 0%, rgba(176,0,58,0.12) 100%)',
    accent: 'linear-gradient(135deg, #ff2d55 0%, #b0003a 100%)',
    glass: 'linear-gradient(135deg, rgba(255,45,85,0.14) 0%, rgba(255,255,255,0.06) 100%)',
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
