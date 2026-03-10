import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import { theme, GlassCard, SectionDivider, PrimaryButton, SecondaryButton } from '../ui';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { Gift, Crown, Star } from 'lucide-react';
import { bonusesAPI } from '../services/api';

interface BonusTransaction {
  id: string;
  type: 'earned' | 'spent' | 'expired';
  amount: number;
  description: string;
  date: string;
}

type CherryTier = { key: string; title: string; min: number; permanentDiscountPercent: number; extraCherriesPerOrder: number };
type CherryNext = { key: string; title: string; min: number } | null;
type CherryProgress = { current: number; target: number; percent: number };
type PendingDiscount = { type: 'fixed' | 'percent'; value: number; at: number; status?: string };

const Bonuses: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { user, token, setUser } = useAuthStore();
  const [transactions, setTransactions] = useState<BonusTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [cherryTier, setCherryTier] = useState<CherryTier | null>(null);
  const [cherryNext, setCherryNext] = useState<CherryNext>(null);
  const [cherryProgress, setCherryProgress] = useState<CherryProgress | null>(null);
  const [cherriesPerOrder, setCherriesPerOrder] = useState(1);
  const [freeLiquids, setFreeLiquids] = useState(0);
  const [freeBoxes, setFreeBoxes] = useState(0);
  const [pendingDiscounts, setPendingDiscounts] = useState<PendingDiscount[]>([]);
  const [redeemedLevels, setRedeemedLevels] = useState<number[]>([]);
  const [redeemingLevel, setRedeemingLevel] = useState<number>(0);
  const [showHow, setShowHow] = useState(false);
  const historyRef = React.useRef<HTMLDivElement>(null);
  const howRef = React.useRef<HTMLDivElement>(null);

  const assetUrl = (p: string) => {
    const base = String(import.meta.env.BASE_URL || '/');
    const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
    const path = p.startsWith('/') ? p : `/${p}`;
    return `${prefix}${path}`;
  };

  useEffect(() => {
    loadBonusData();
  }, []);

  const loadBonusData = async () => {
    try {
      setLoading(true);
      const [bal, hist] = await Promise.all([bonusesAPI.balance(), bonusesAPI.history()]);
      const balance = Number(bal.data?.balance || 0);
      const cherries = Number(bal.data?.cherries ?? user?.cherries ?? 0);
      const tier = (bal.data?.cherryTier || null) as CherryTier | null;
      const next = (bal.data?.cherryNext || null) as CherryNext;
      const prog = (bal.data?.cherryProgress || null) as CherryProgress | null;
      const perOrder = Math.max(1, Number(bal.data?.cherriesPerOrder || 1));
      const liquids = Math.max(0, Number(bal.data?.freeLiquids || 0));
      const boxes = Math.max(0, Number(bal.data?.freeBoxes || 0));
      setCherryTier(tier);
      setCherryNext(next);
      setCherryProgress(prog);
      setCherriesPerOrder(perOrder);
      setFreeLiquids(liquids);
      setFreeBoxes(boxes);
      setPendingDiscounts(Array.isArray(bal.data?.pendingDiscounts) ? bal.data.pendingDiscounts : []);
      setRedeemedLevels(Array.isArray(bal.data?.redeemedLevels) ? bal.data.redeemedLevels.map((x: any) => Number(x || 0)).filter((x: number) => x > 0) : []);
      if (user && token) setUser({ ...user, bonusBalance: balance, cherries, freeLiquids: liquids, freeBoxes: boxes }, token);

      const events = Array.isArray(hist.data?.history) ? hist.data.history : [];
      const mapped: BonusTransaction[] = events.map((e: any, i: number) => {
        const amount = Number(e?.amount || 0);
        const type: BonusTransaction['type'] =
          amount < 0 ? 'spent' : String(e?.type || '') === 'expire' ? 'expired' : 'earned';
        return {
          id: String(e?.id || e?._id || e?.created_at || `row_${i}`),
          type,
          amount,
          description: String(e?.type || 'Операция'),
          date: String(e?.created_at || new Date().toISOString()).slice(0, 10),
        };
      });
      setTransactions(mapped);
    } catch (error) {
      toast.push('Ошибка загрузки данных', 'error');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      color: theme.colors.dark.text,
      fontFamily: theme.typography.fontFamily,
      paddingBottom: theme.spacing.xl,
    },
    hero: {
      margin: `0 ${theme.padding.screen} ${theme.spacing.lg}`,
      borderRadius: 26,
      overflow: 'hidden' as const,
      border: '1px solid rgba(255,45,85,0.22)',
      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.65) 100%), url(${assetUrl('/assets/elfcherry/tiles/tile-bonuses.jpg')})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      boxShadow: theme.shadow.card,
    },
    heroInner: {
      padding: theme.spacing.lg,
      display: 'grid',
      justifyItems: 'center' as const,
      gap: theme.spacing.md,
      textAlign: 'center' as const,
    },
    heroTitle: {
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      marginTop: theme.spacing.sm,
    },
    heroSub: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: theme.typography.fontSize.sm,
    },
    heroCount: {
      fontSize: 56,
      fontWeight: theme.typography.fontWeight.bold,
      lineHeight: 1,
      letterSpacing: '0.02em',
    },
    pillRow: {
      display: 'flex',
      gap: theme.spacing.sm,
      justifyContent: 'center',
      width: '100%',
    },
    progressCard: {
      margin: `0 ${theme.padding.screen} ${theme.spacing.lg}`,
      borderRadius: 18,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
      padding: theme.spacing.lg,
      boxShadow: theme.shadow.card,
    },
    transactionCard: {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    levelGrid: {
      padding: `0 ${theme.padding.screen}`,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
    },
    levelCard: (bg: string, border: string) => ({
      borderRadius: 18,
      border,
      background: bg,
      padding: theme.spacing.lg,
      minHeight: 160,
      boxShadow: theme.shadow.card,
    }),
    levelTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      marginBottom: theme.spacing.sm,
    },
    levelMin: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: theme.typography.fontSize.sm,
      marginBottom: theme.spacing.sm,
    },
    levelList: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: theme.typography.fontSize.sm,
      display: 'grid',
      gap: 6,
      lineHeight: 1.2,
    },
    progressBar: {
      height: 10,
      background: 'rgba(255,255,255,0.10)',
      borderRadius: 999,
      overflow: 'hidden' as const,
    },
    progressFill: {
      height: '100%',
      background: 'linear-gradient(90deg, rgba(255,45,85,1) 0%, rgba(255,0,130,1) 100%)',
      borderRadius: 999,
      transition: 'width 0.3s ease',
    },
  };

  const cherries = Number(user?.cherries || 0);
  const tierTitle = String(cherryTier?.title || 'START');
  const tierDiscount = Number(cherryTier?.permanentDiscountPercent || 0);
  const tierExtra = Number(cherryTier?.extraCherriesPerOrder || 0);
  const nextMin = Number(cherryNext?.min || 10);
  const nextTitle = String(cherryNext?.title || 'SILVER');
  const remainingCherries = Math.max(0, nextMin - cherries);
  const remainingOrders = Math.ceil(remainingCherries / Math.max(1, cherriesPerOrder));
  const progressToNext = cherryNext ? Number(cherryProgress?.percent || 0) : 100;
  const teaser =
    cherryNext?.key === 'silver'
      ? { title: 'GOLD', perOrder: 2 }
      : cherryNext?.key === 'gold'
      ? { title: 'PLATINUM', perOrder: 3 }
      : cherryNext?.key === 'platinum'
      ? { title: 'LEGEND', perOrder: 4 }
      : null;
  const nextDiscount = (() => {
    const list = Array.isArray(pendingDiscounts) ? pendingDiscounts : [];
    const pending = list
      .filter((x) => x && String(x.status || 'pending') === 'pending')
      .filter((x) => (String(x.type) === 'percent' || String(x.type) === 'fixed') && Number(x.value || 0) > 0)
      .slice()
      .sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
    const d = pending[0];
    if (!d) return '';
    if (String(d.type) === 'fixed') return `${Number(d.value || 0)}€`;
    return `${Number(d.value || 0)}%`;
  })();
  const redeemRows = [
    { level: 1, reward: '2€ скидки на следующий заказ' },
    { level: 2, reward: '10% скидки на следующий заказ' },
    { level: 3, reward: '15% скидки на следующий заказ' },
    { level: 4, reward: '15% скидки +2 🍒' },
    { level: 5, reward: '20% скидки на следующий заказ' },
    { level: 6, reward: '20% скидки +2 🍒' },
    { level: 7, reward: '+1 бесплатная жидкость' },
    { level: 8, reward: '25% скидки на следующий заказ' },
    { level: 9, reward: '25% скидки +2 🍒' },
    { level: 10, reward: '25% скидки +1 жидкость +1 бокс' },
  ];
  const doRedeem = async (level: number) => {
    try {
      setRedeemingLevel(level);
      await bonusesAPI.redeem(level);
      toast.push('Награда активирована', 'success');
      await loadBonusData();
    } catch (e: any) {
      const msg = String(e?.response?.data?.error || 'Ошибка обмена');
      toast.push(msg, 'error');
    } finally {
      setRedeemingLevel(0);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ padding: `0 ${theme.padding.screen}` }}>
          <div style={{ ...styles.hero, opacity: 0.6 }} />
          <div style={{ ...styles.progressCard, opacity: 0.6 }} />
          <div style={{ height: theme.spacing.lg }} />
          <div style={{ ...styles.progressCard, opacity: 0.35 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="content-fade-in" style={styles.container}>
      <div style={styles.hero}>
        <div style={styles.heroInner}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,45,85,0.20)', border: '1px solid rgba(255,45,85,0.35)', display: 'grid', placeItems: 'center' as const }}>
            <Crown size={22} color="#ff2d55" />
          </div>
          <div style={styles.heroTitle}>CHERRY CLUB</div>
          <div style={styles.heroSub}>Твои бонусы:</div>
          <div style={styles.heroCount}>{cherries.toLocaleString()} 🍒</div>
          <div style={styles.heroSub}>За каждый заказ +{cherriesPerOrder} 🍒</div>
          <div style={styles.heroSub}>Подарки: {freeLiquids} жидк. • {freeBoxes} боксов</div>
          <div style={styles.pillRow}>
            <PrimaryButton size="sm" onClick={() => navigate('/catalog')}>Потратить</PrimaryButton>
            <SecondaryButton
              size="sm"
              onClick={() => {
                setShowHow((v) => !v);
                setTimeout(() => {
                  try {
                    howRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } catch {
                  }
                }, 50);
              }}
            >
              + Как заработать
            </SecondaryButton>
          </div>
        </div>
      </div>

      <div style={styles.progressCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
          <div style={{ fontSize: theme.typography.fontSize.sm, letterSpacing: '0.10em', textTransform: 'uppercase' as const, opacity: 0.9 }}>
            {tierTitle} • {cherryNext ? `${cherries} / ${nextMin}` : `${cherries}+`} 🍒
          </div>
          <div style={{ fontSize: theme.typography.fontSize.sm, opacity: 0.9 }}>{Math.round(Math.min(progressToNext, 100))}%</div>
        </div>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${Math.min(progressToNext, 100)}%` }} />
        </div>
        {cherryNext ? (
          <div style={{ marginTop: theme.spacing.md, display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm, fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>
            <div>До {nextTitle} осталось {remainingCherries} 🍒</div>
            <div>{remainingOrders} заказа</div>
          </div>
        ) : null}
        <div style={{ marginTop: theme.spacing.sm, fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary, display: 'grid', gap: 6 }}>
          <div>Постоянная скидка: {tierDiscount}%</div>
          <div>За заказ: +{1 + tierExtra} 🍒</div>
          <div>Следующая скидка: {nextDiscount || 'нет'}</div>
        </div>
        {teaser ? (
          <div style={{ marginTop: theme.spacing.sm, fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>
            🔥 До {teaser.title} ты получишь +{teaser.perOrder} 🍒 за каждый заказ
          </div>
        ) : null}
      </div>

      <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.md }}>
        <SectionDivider title="Уровни" />
      </div>

      <div style={styles.levelGrid}>
        <div style={styles.levelCard('linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)', '1px solid rgba(255,255,255,0.14)')}>
          <div style={styles.levelTitle}>SILVER</div>
          <div style={styles.levelMin}>от 10 🍒</div>
          <div style={styles.levelList}>
            <div>-5% на всё</div>
            <div>+1 бесплатная жидкость</div>
            <div>+1 бесплатный бокс</div>
          </div>
        </div>
        <div style={styles.levelCard('linear-gradient(135deg, rgba(255,193,7,0.18) 0%, rgba(255,152,0,0.06) 100%)', '1px solid rgba(255,193,7,0.22)')}>
          <div style={styles.levelTitle}>GOLD</div>
          <div style={styles.levelMin}>от 25 🍒</div>
          <div style={styles.levelList}>
            <div>-10% на всё</div>
            <div>+3 бесплатных жидкости</div>
            <div>+1 🍒 за заказ</div>
            <div>+1 бесплатный бокс</div>
          </div>
        </div>
        <div style={styles.levelCard('linear-gradient(135deg, rgba(147,51,234,0.18) 0%, rgba(236,72,153,0.06) 100%)', '1px solid rgba(236,72,153,0.22)')}>
          <div style={styles.levelTitle}>PLATINUM</div>
          <div style={styles.levelMin}>от 50 🍒</div>
          <div style={styles.levelList}>
            <div>-15% на всё</div>
            <div>+5 бесплатных жидкостей</div>
            <div>+2 🍒 за заказ</div>
            <div>+3 бесплатных бокса</div>
          </div>
        </div>
        <div style={styles.levelCard('linear-gradient(135deg, rgba(255,45,85,0.20) 0%, rgba(255,0,130,0.06) 100%)', '1px solid rgba(255,45,85,0.22)')}>
          <div style={styles.levelTitle}>LEGEND</div>
          <div style={styles.levelMin}>от 100 🍒</div>
          <div style={styles.levelList}>
            <div>-20% на всё</div>
            <div>+10 бесплатных жидкостей</div>
            <div>+3 🍒 за заказ</div>
            <div>каждые +10 🍒 → +1 жидкость</div>
            <div>+5 бесплатных боксов</div>
          </div>
        </div>
      </div>

      <div style={{ padding: `0 ${theme.padding.screen}`, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md }}>
        <SectionDivider title="Обмен вишенок" />
      </div>
      <div style={{ padding: `0 ${theme.padding.screen}`, display: 'grid', gap: theme.spacing.sm }}>
        {redeemRows.map((r) => {
          const redeemed = redeemedLevels.includes(r.level);
          const can = !redeemed && cherries >= r.level;
          const busy = redeemingLevel === r.level;
          return (
            <GlassCard key={r.level} padding="md" variant="elevated">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                    {r.level} 🍒 → {r.reward}
                  </div>
                </div>
                <button
                  onClick={() => doRedeem(r.level)}
                  disabled={!can || busy}
                  style={{
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: can ? theme.gradients.primary : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    padding: '8px 12px',
                    cursor: can ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {redeemed ? 'Получено' : busy ? '...' : 'Обменять'}
                </button>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <div style={{ padding: `0 ${theme.padding.screen}`, marginTop: theme.spacing.xl }}>
        <PrimaryButton
          fullWidth
          onClick={() => {
            navigate('/referral');
          }}
        >
          Пригласить друга 🍒
        </PrimaryButton>
      </div>

      <div style={{ padding: `0 ${theme.padding.screen}`, marginTop: theme.spacing.lg }}>
        <SecondaryButton
          fullWidth
          onClick={() => {
            try {
              historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch {
            }
          }}
        >
          История
        </SecondaryButton>
      </div>

      {showHow ? (
        <div style={{ padding: `0 ${theme.padding.screen}`, marginTop: theme.spacing.xl }} ref={howRef}>
          <h3 style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, marginBottom: theme.spacing.md, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Как это работает</h3>
          <div style={{ display: 'grid', gap: theme.spacing.md }}>
            <GlassCard padding="md" variant="elevated">
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                <Gift size={20} color={theme.colors.dark.primary} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                    За каждый заказ +{cherriesPerOrder} 🍒
                  </div>
                  <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary }}>
                    Чем выше статус — тем больше 🍒 за заказ и больше наград
                  </div>
                </div>
              </div>
            </GlassCard>
            <GlassCard padding="md" variant="elevated">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                  Накопил 🍒 → получил награду
                </div>
                <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary, marginTop: 6, lineHeight: 1.3 }}>
                  На уровнях 1–10 ты получаешь скидку на следующий заказ или подарок. Скидка применяется автоматически при оформлении следующего заказа.
                </div>
                <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary, marginTop: 6, lineHeight: 1.3 }}>
                  Пример: 1 🍒 → 2€ скидки • 5 🍒 → 20% • 7 🍒 → бесплатная жидкость.
                </div>
              </div>
            </GlassCard>
            <GlassCard padding="md" variant="elevated">
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                <Star size={20} color="#ffc107" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                    Статусы
                  </div>
                  <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary }}>
                    SILVER / GOLD / PLATINUM / LEGEND дают постоянную скидку и повышают 🍒 за заказ
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      ) : null}

      <div style={{ padding: `0 ${theme.padding.screen}`, marginTop: theme.spacing.xl }} ref={historyRef}>
        <h3 style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, marginBottom: theme.spacing.md, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>История</h3>
        {transactions.map((transaction) => (
          <div key={transaction.id} style={styles.transactionCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                  {transaction.description}
                </div>
                <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary }}>
                  {new Date(transaction.date).toLocaleDateString()}
                </div>
              </div>
              <div style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.bold,
                color: transaction.type === 'earned' ? '#4caf50' : transaction.type === 'spent' ? '#ef4444' : '#ffc107',
                whiteSpace: 'nowrap' as const
              }}>
                {transaction.type === 'earned' ? '+' : ''}{transaction.amount} 🍒
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Bonuses;
