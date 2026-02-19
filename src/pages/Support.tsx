import React from 'react';
import WebApp from '@twa-dev/sdk';
import { GlassCard, PrimaryButton, theme } from '../ui';
import { configAPI } from '../services/api';
import { useToastStore } from '../store/useToastStore';

const Support: React.FC = () => {
  const toast = useToastStore();
  const [url, setUrl] = React.useState<string>('');

  React.useEffect(() => {
    (async () => {
      try {
        const resp = await configAPI.get();
        setUrl(String(resp.data.groupUrl || resp.data.reviewsUrl || ''));
      } catch (e) {
        console.error('Support config load failed:', e);
        setUrl('');
      }
    })();
  }, []);

  const open = () => {
    if (!url) {
      toast.push('Ссылка поддержки не настроена', 'error');
      return;
    }
    try {
      if (WebApp.openTelegramLink && url.startsWith('https://t.me/')) {
        WebApp.openTelegramLink(url);
        return;
      }
    } catch (e) {
      console.error('Open telegram link failed:', e);
    }
    window.open(url, '_blank');
  };

  return (
    <div style={{ padding: theme.padding.screen }}>
      <div
        style={{
          textAlign: 'center',
          color: theme.colors.dark.text,
          fontSize: theme.typography.fontSize['2xl'],
          fontWeight: theme.typography.fontWeight.bold,
          marginBottom: theme.spacing.lg,
        }}
      >
        Поддержка
      </div>

      <GlassCard padding="lg" variant="elevated">
        <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, lineHeight: '1.5', marginBottom: theme.spacing.md }}>
          Свяжись с менеджером в Telegram.
        </div>
        <PrimaryButton fullWidth onClick={open}>
          Открыть чат
        </PrimaryButton>
      </GlassCard>
    </div>
  );
};

export default Support;
