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
      bg: 'linear-gradient(135deg, #090607 0%, #160810 100%)',
      card: 'rgba(28,10,16,0.64)',
      border: 'rgba(255,255,255,0.08)',
      text: '#ffffff',
      textSecondary: 'rgba(255,255,255,0.7)',
      primary: '#ff2d55',
      secondary: '#b0003a',
      accent: '#ff4d6d',
      accentGreen: '#00ff88',
      accentPurple: '#ff4d6d',
      accentRed: '#ff3b30',
      accentGold: '#ffd60a',
    },
  },
  gradients: {
    primary: 'linear-gradient(135deg, #ff2d55 0%, #b0003a 100%)',
    secondary: 'linear-gradient(135deg, #b0003a 0%, #520013 100%)',
    accent: 'linear-gradient(135deg, #ff4d6d 0%, #ff2d55 100%)',
    glass: 'linear-gradient(135deg, rgba(255,45,85,0.16) 0%, rgba(176,0,58,0.14) 100%)',
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
