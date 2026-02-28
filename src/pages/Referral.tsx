import React from 'react';
import WebApp from '@twa-dev/sdk';
import { CherryMascot, GlassCard, PrimaryButton, SecondaryButton, theme } from '../ui';
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

  const reward = Number(info?.bonusAmount || 0);
  const invited = Number(info?.conversions || 0);
  const required = Math.max(1, Number(info?.required || 1));
  const earned = Math.floor(invited / required) * reward;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      try {
        WebApp?.HapticFeedback?.impactOccurred?.('light');
      } catch {
      }
      toast.push('Скопировано', 'success');
    } catch {
      toast.push('Не удалось скопировать', 'error');
    }
  };

  const share = async () => {
    const text = `ELFCHERRY mini app 24/7 — присоединяйся: ${link}`;
    try {
      if (WebApp.openTelegramLink) {
        try {
          WebApp?.HapticFeedback?.impactOccurred?.('light');
        } catch {
        }
        WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
        return;
      }
    } catch {
    }
    await copy();
  };

  return (
    <div style={{ padding: theme.padding.screen }}>
      <div style={{ textAlign: 'center', marginTop: theme.spacing.md, marginBottom: theme.spacing.lg }}>
        <div style={{ fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily, fontSize: 34, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Приведи друга
        </div>
        <div style={{ color: theme.colors.dark.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: theme.typography.fontSize.sm }}>
          Получи {reward ? `${reward} вишенок` : 'вишенки'} за каждого
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: theme.spacing.lg }}>
        <CherryMascot variant="pink" size={160} />
      </div>

      <GlassCard padding="lg" variant="elevated">
        <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.xs, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: theme.spacing.md }}>
          1 вишенка = 1 € • списание до 50% от суммы
        </div>
        <div style={{ marginBottom: theme.spacing.md, letterSpacing: '0.10em', textTransform: 'uppercase', fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily }}>
          Реферальная ссылка
        </div>
        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center', marginBottom: theme.spacing.md }}>
          <input
            value={link}
            readOnly
            style={{
              flex: 1,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              color: theme.colors.dark.text,
              padding: '12px 12px',
              outline: 'none',
              letterSpacing: '0.04em',
            }}
          />
          <PrimaryButton onClick={copy} style={{ borderRadius: 12, padding: '12px 14px' }}>
            Скопировать
          </PrimaryButton>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
          <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.20)', padding: theme.spacing.md }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>
              Приглашено
            </div>
            <div style={{ fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily, fontSize: 28, letterSpacing: '0.10em' }}>
              {loading ? '—' : invited}
            </div>
          </div>
          <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.20)', padding: theme.spacing.md }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>
              Заработано
            </div>
            <div style={{ fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily, fontSize: 28, letterSpacing: '0.10em' }}>
              {loading ? '—' : `${earned} виш.`}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm }}>
          <SecondaryButton fullWidth onClick={share} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)' }}>
            Поделиться
          </SecondaryButton>
          <PrimaryButton fullWidth onClick={share} style={{ borderRadius: 12 }}>
            Пригласить
          </PrimaryButton>
        </div>
      </GlassCard>
    </div>
  );
};

export default Referral;
