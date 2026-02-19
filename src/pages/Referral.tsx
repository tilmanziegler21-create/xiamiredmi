import React from 'react';
import WebApp from '@twa-dev/sdk';
import { GlassCard, PrimaryButton, theme } from '../ui';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { referralAPI } from '../services/api';

const Referral: React.FC = () => {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const [loading, setLoading] = React.useState(true);
  const [info, setInfo] = React.useState<{ referralCode: string; conversions: number; required: number; bonusAmount: number } | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const resp = await referralAPI.info();
        setInfo(resp.data || null);
      } catch {
        setInfo(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refCode = String(info?.referralCode || user?.tgId || '');
  const ref = refCode ? `ref=${encodeURIComponent(refCode)}` : 'ref=unknown';
  const link = `${window.location.origin}/home?${ref}`;

  const share = async () => {
    const text = `ELFCHERRY mini app 24/7 — присоединяйся: ${link}`;
    try {
      if (WebApp.openTelegramLink) {
        WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
        return;
      }
    } catch (e) {
      console.error('Open Telegram share failed:', e);
    }

    try {
      await navigator.clipboard.writeText(link);
      toast.push('Ссылка скопирована', 'success');
    } catch {
      toast.push('Не удалось скопировать ссылку', 'error');
    }
  };

  return (
    <div style={{ padding: theme.padding.screen }}>
      <GlassCard padding="lg" variant="elevated" style={{ marginTop: theme.spacing.md }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.dark.text,
              marginBottom: theme.spacing.sm,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            Пригласите 2 реферала
          </div>
          <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, lineHeight: '1.5', marginBottom: theme.spacing.md }}>
            За каждых двух друзей, которые совершают покупку, вы получите бонус на баланс.
          </div>
          {loading ? (
            <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.xs, marginBottom: theme.spacing.md }}>
              Загрузка…
            </div>
          ) : info ? (
            <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.xs, marginBottom: theme.spacing.md }}>
              Прогресс: {info.conversions}/{info.required} • Бонус: {info.bonusAmount}
            </div>
          ) : null}
          <PrimaryButton fullWidth onClick={share}>
            Пригласить друга
          </PrimaryButton>
        </div>
      </GlassCard>
    </div>
  );
};

export default Referral;
