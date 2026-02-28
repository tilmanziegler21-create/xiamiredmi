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
  const [info, setInfo] = React.useState<{
    referralCode: string;
    stage: 'partner' | 'ambassador';
    invited: number;
    percent: number;
    next: { at: number; percent: number } | null;
    remainingToUnlock: number;
    balances: { total: number; store: number; cash: number; withdrawUnlocked: boolean; minWithdraw: number; canWithdraw: boolean };
  } | null>(null);

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
  const botUsername = String(import.meta.env.VITE_BOT_USERNAME || '').trim();
  const link = botUsername ? `https://t.me/${botUsername}?startapp=ref_${encodeURIComponent(refCode || 'unknown')}` : '';

  const stage = String(info?.stage || 'partner') as 'partner' | 'ambassador';
  const invited = Math.max(0, Number(info?.invited || 0));
  const percent = Math.max(0, Number(info?.percent || 0));
  const next = info?.next || null;
  const remainingToUnlock = Math.max(0, Number(info?.remainingToUnlock || 0));
  const balances = info?.balances || { total: 0, store: 0, cash: 0, withdrawUnlocked: false, minWithdraw: 50, canWithdraw: false };
  const unlockAt = 10;
  const progressPartner = Math.min(100, Math.max(0, Math.round((invited / Math.max(1, unlockAt)) * 100)));
  const nextTarget = next?.at || unlockAt;
  const progressAmb = next ? Math.min(100, Math.max(0, Math.round((invited / nextTarget) * 100))) : 100;

  const copy = async () => {
    try {
      if (!link) {
        toast.push('Укажите VITE_BOT_USERNAME, чтобы появилась ссылка', 'info');
        return;
      }
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
    if (!link) {
      toast.push('Укажите VITE_BOT_USERNAME, чтобы появилась ссылка', 'info');
      return;
    }
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
          Зарабатывай на друзьях
        </div>
        <div style={{ color: theme.colors.dark.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: theme.typography.fontSize.sm }}>
          Они покупают — ты получаешь %
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: theme.spacing.lg }}>
        <CherryMascot variant="pink" size={160} />
      </div>

      <GlassCard padding="lg" variant="elevated">
        <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.xs, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: theme.spacing.md }}>
          Выплаты 1 раз в месяц • мин. вывод {balances.minWithdraw}€
        </div>
        <div style={{ marginBottom: theme.spacing.md, letterSpacing: '0.10em', textTransform: 'uppercase', fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily }}>
          Реферальная ссылка
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: theme.spacing.sm, alignItems: 'center', marginBottom: theme.spacing.md }}>
          <input
            value={link}
            readOnly
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              color: theme.colors.dark.text,
              padding: '12px 12px',
              outline: 'none',
              letterSpacing: '0.04em',
            }}
          />
          <PrimaryButton onClick={copy} style={{ borderRadius: 12, padding: '12px 14px', whiteSpace: 'nowrap' }}>
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
              Баланс
            </div>
            <div style={{ fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily, fontSize: 28, letterSpacing: '0.10em' }}>
              {loading ? '—' : `${balances.total.toFixed(2)}€`}
            </div>
          </div>
        </div>

        <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.20)', padding: theme.spacing.md, marginBottom: theme.spacing.md }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 20 }}>
              {stage === 'partner' ? 'PARTNER' : 'AMBASSADOR'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
              {stage === 'partner' ? `${invited} / ${unlockAt} приглашённых` : `текущий процент: ${percent}%`}
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.10)' }}>
            <div style={{ height: '100%', width: `${stage === 'partner' ? progressPartner : progressAmb}%`, background: theme.gradients.primary }} />
          </div>
          <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
            {stage === 'partner' ? (
              <>🔥 Пригласи ещё {remainingToUnlock} человека → откроется вывод денег</>
            ) : next ? (
              <>После {next.at} человек → {next.percent}% • осталось {Math.max(0, next.at - invited)}</>
            ) : (
              <>Ты на максимальном проценте</>
            )}
          </div>
          <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
            {stage === 'partner' ? '💰 30% ревшэйр (тратить только на товары)' : '💰 Вывод доступен, процент динамический'}
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
