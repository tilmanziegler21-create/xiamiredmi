import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { authAPI } from '../services/api';
import WebApp from '@twa-dev/sdk';
import { GlassCard, PrimaryButton, SecondaryButton, theme } from '../ui';
import { blurStyle } from '../ui/blur';

const AgeVerify: React.FC = () => {
  const navigate = useNavigate();
  const { setAgeVerified, setUser, user } = useAuthStore();
  const [isLoading, setIsLoading] = React.useState(false);

  const safeAlert = (message: string) => {
    try {
      WebApp.showAlert(message);
    } catch {
      window.alert(message);
    }
  };

  const safeClose = () => {
    try {
      WebApp.close();
    } catch {
      window.close();
    }
  };

  const handleAgeVerification = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const initData = WebApp.initData || (import.meta.env?.VITE_TG_INIT_DATA as string);

      if (initData) {
        try {
          await authAPI.ageVerify(initData);
          setAgeVerified(true);
          safeAlert('Возраст подтвержден!');
          setTimeout(() => navigate('/home', { replace: true }), 100);
          return;
        } catch (e) {
          if (!import.meta.env.DEV) throw e;
        }
      }

      if (import.meta.env.DEV) {
        const response = await authAPI.dev();
        setUser(response.data.user, response.data.token);
        setAgeVerified(true);
        safeAlert('Возраст подтвержден!');
        setTimeout(() => navigate('/home', { replace: true }), 100);
        return;
      }

      throw new Error('No initData available');
    } catch (error) {
      console.error('Age verification error:', error);
      safeAlert('Ошибка подтверждения возраста');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = {
    page: {
      minHeight: '100vh',
      color: theme.colors.dark.text,
      fontFamily: theme.typography.fontFamily,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.padding.screen,
      background:
        'radial-gradient(1200px 800px at 20% 10%, rgba(255,45,85,0.16) 0%, rgba(0,0,0,0) 60%), radial-gradient(1200px 800px at 80% 40%, rgba(255,214,10,0.10) 0%, rgba(0,0,0,0) 62%), linear-gradient(180deg, #070607 0%, #0f070b 100%)',
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 22,
      background: 'rgba(28,10,16,0.64)',
      border: '1px solid rgba(255,255,255,0.08)',
      ...blurStyle('18px'),
      boxShadow: theme.shadow.card,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: 999,
      background: 'rgba(255,45,85,0.14)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    title: {
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      textAlign: 'center' as const,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    text: {
      color: theme.colors.dark.textSecondary,
      textAlign: 'center' as const,
      marginBottom: theme.spacing.lg,
      fontSize: theme.typography.fontSize.sm,
      lineHeight: 1.45,
    },
    warn: {
      marginTop: theme.spacing.lg,
      padding: theme.spacing.md,
      background: 'rgba(255,214,10,0.12)',
      border: '1px solid rgba(255,214,10,0.3)',
      borderRadius: theme.radius.md,
      color: 'rgba(255,255,255,0.88)',
      fontSize: theme.typography.fontSize.sm,
      lineHeight: 1.35,
    },
    decline: {
      background: 'rgba(255,255,255,0.08)',
      color: theme.colors.dark.text,
      borderColor: 'rgba(255,255,255,0.14)',
    },
  };

  return (
    <div style={styles.page}>
      <GlassCard padding="lg" variant="elevated" style={styles.card}>
        <div style={{ textAlign: 'center' as const }}>
          <div style={styles.iconWrap}>
            <span style={{ fontSize: 32, lineHeight: 1 }}>🔞</span>
          </div>
          <div style={styles.title}>Подтверждение возраста</div>
          <div style={styles.text}>
            Для продолжения работы с магазином электронных сигарет подтвердите, что вам исполнилось 18 лет
          </div>
        </div>

        <div style={{ display: 'grid', gap: theme.spacing.md }}>
          <PrimaryButton fullWidth onClick={handleAgeVerification} disabled={isLoading}>
            {isLoading ? 'Подтверждение…' : 'Мне исполнилось 18 лет'}
          </PrimaryButton>
          <SecondaryButton fullWidth onClick={safeClose} style={styles.decline}>
            Мне нет 18 лет
          </SecondaryButton>
        </div>

        <div style={styles.warn}>
          ⚠️ Продажа электронных сигарет лицам младше 18 лет запрещена законом
        </div>
      </GlassCard>
    </div>
  );
};

export default AgeVerify;
