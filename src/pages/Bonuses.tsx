import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme, GlassCard, SectionDivider, PrimaryButton, SecondaryButton } from '../ui';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { Gift, TrendingUp, Users, History, Crown, Star } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { bonusesAPI, referralAPI } from '../services/api';

interface BonusTransaction {
  id: string;
  type: 'earned' | 'spent' | 'expired';
  amount: number;
  description: string;
  date: string;
}

interface UserStatus {
  level: 'regular' | 'vip' | 'elite';
  name: string;
  benefits: string[];
  minBonus: number;
  cashback: number;
}

const Bonuses: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { user, token, setUser } = useAuthStore();
  const [transactions, setTransactions] = useState<BonusTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');

  const userStatuses: UserStatus[] = [
    {
      level: 'regular',
      name: 'Обычный',
      benefits: ['Базовый кэшбэк 1%', 'Доступ к акциям', 'Техподдержка 24/7'],
      minBonus: 0,
      cashback: 1
    },
    {
      level: 'vip',
      name: 'VIP',
      benefits: ['Повышенный кэшбэк 3%', 'Приоритетная поддержка', 'Эксклюзивные акции', 'Персональный менеджер'],
      minBonus: 1000,
      cashback: 3
    },
    {
      level: 'elite',
      name: 'ELITE',
      benefits: ['Максимальный кэшбэк 5%', 'VIP-поддержка', 'Ранний доступ к новинкам', 'Эксклюзивные подарки', 'Бесплатная доставка'],
      minBonus: 5000,
      cashback: 5
    }
  ];

  useEffect(() => {
    loadBonusData();
  }, []);

  const loadBonusData = async () => {
    try {
      setLoading(true);
      const [bal, hist, ref] = await Promise.all([bonusesAPI.balance(), bonusesAPI.history(), referralAPI.info()]);
      const balance = Number(bal.data?.balance || 0);
      if (user && token) setUser({ ...user, bonusBalance: balance }, token);

      const events = Array.isArray(hist.data?.history) ? hist.data.history : [];
      const mapped: BonusTransaction[] = events.map((e: any) => {
        const amount = Number(e?.amount || 0);
        const type: BonusTransaction['type'] =
          amount < 0 ? 'spent' : String(e?.type || '') === 'expire' ? 'expired' : 'earned';
        return {
          id: String(e?.id || e?._id || e?.created_at || Math.random()),
          type,
          amount,
          description: String(e?.type || 'Операция'),
          date: String(e?.created_at || new Date().toISOString()).slice(0, 10),
        };
      });
      setTransactions(mapped);

      const code = String(ref.data?.referralCode || user?.tgId || '');
      setReferralCode(code);
      setReferralLink(`${window.location.origin}/home?ref=${encodeURIComponent(code)}`);
    } catch (error) {
      toast.push('Ошибка загрузки данных', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      toast.push('Реферальный код скопирован', 'success');
    } catch {
      toast.push('Ошибка копирования', 'error');
    }
  };

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.push('Реферальная ссылка скопирована', 'success');
    } catch {
      toast.push('Ошибка копирования', 'error');
    }
  };

  const getCurrentStatus = (): UserStatus => {
    const bonusBalance = user?.bonusBalance || 0;
    if (bonusBalance >= 5000) return userStatuses[2]; // elite
    if (bonusBalance >= 1000) return userStatuses[1]; // vip
    return userStatuses[0]; // regular
  };

  const getNextStatus = (): UserStatus | null => {
    const bonusBalance = user?.bonusBalance || 0;
    if (bonusBalance >= 5000) return null;
    if (bonusBalance >= 1000) return userStatuses[2]; // elite
    return userStatuses[1]; // vip
  };

  const styles = {
    container: {
      minHeight: '100vh',
      color: theme.colors.dark.text,
      fontFamily: theme.typography.fontFamily,
      paddingBottom: theme.spacing.xl,
    },
    balanceCard: {
      background: 'linear-gradient(135deg, rgba(255,45,85,0.15) 0%, rgba(176,0,58,0.1) 100%)',
      border: '1px solid rgba(255,45,85,0.3)',
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      margin: `0 ${theme.padding.screen} ${theme.spacing.lg}`,
      position: 'relative' as const,
      overflow: 'hidden' as const,
    },
    statusCard: {
      background: 'linear-gradient(135deg, rgba(255,193,7,0.15) 0%, rgba(255,152,0,0.1) 100%)',
      border: '1px solid rgba(255,193,7,0.3)',
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      margin: `0 ${theme.padding.screen} ${theme.spacing.lg}`,
    },
    referralCard: {
      background: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(56,142,60,0.1) 100%)',
      border: '1px solid rgba(76,175,80,0.3)',
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      margin: `0 ${theme.padding.screen} ${theme.spacing.lg}`,
    },
    transactionCard: {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    balanceAmount: {
      fontSize: theme.typography.fontSize['3xl'],
      fontWeight: theme.typography.fontWeight.bold,
      color: '#ff2d55',
      marginBottom: theme.spacing.xs,
    },
    balanceLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.dark.textSecondary,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
    },
    statusBadge: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    statusIcon: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    benefitItem: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
      fontSize: theme.typography.fontSize.sm,
    },
    referralCode: {
      background: 'rgba(255,255,255,0.1)',
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      fontFamily: 'monospace',
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      textAlign: 'center' as const,
      marginBottom: theme.spacing.md,
      letterSpacing: '0.1em',
    },
    progressBar: {
      height: 8,
      background: 'rgba(255,255,255,0.1)',
      borderRadius: theme.radius.sm,
      overflow: 'hidden' as const,
      marginTop: theme.spacing.md,
    },
    progressFill: {
      height: '100%',
      background: 'linear-gradient(135deg, #ff2d55 0%, #b0003a 100%)',
      borderRadius: theme.radius.sm,
      transition: 'width 0.3s ease',
    },
  };

  const currentStatus = getCurrentStatus();
  const nextStatus = getNextStatus();
  const bonusBalance = user?.bonusBalance || 0;
  const progressToNext = nextStatus ? (bonusBalance / nextStatus.minBonus) * 100 : 100;

  if (loading) {
    return (
      <div style={styles.container}>
        <SectionDivider title="Мои бонусы" />
        <div style={{ padding: `0 ${theme.padding.screen}` }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{...styles.balanceCard, animation: 'pulse 1.5s ease-in-out infinite'}} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <SectionDivider title="Мои бонусы" />

      {/* Balance Card */}
      <div style={styles.balanceCard}>
        <div style={styles.balanceAmount}>
          {formatCurrency(bonusBalance)} 🍒
        </div>
        <div style={styles.balanceLabel}>Доступно бонусов</div>
        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          <PrimaryButton
            size="sm"
            onClick={() => navigate('/catalog')}
          >
            Потратить
          </PrimaryButton>
          <SecondaryButton
            size="sm"
            onClick={() => toast.push('История транзакций', 'info')}
          >
            История
          </SecondaryButton>
        </div>
      </div>

      {/* Status Card */}
      <div style={styles.statusCard}>
        <div style={styles.statusBadge}>
          <div style={styles.statusIcon}>
            <Crown size={18} color="#000" />
          </div>
          <div>
            <div style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold }}>
              {currentStatus.name}
            </div>
            <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary }}>
              Кэшбэк {currentStatus.cashback}%
            </div>
          </div>
        </div>

        <div style={{ marginBottom: theme.spacing.md }}>
          <div style={{ fontSize: theme.typography.fontSize.sm, marginBottom: theme.spacing.sm }}>
            Ваши привилегии:
          </div>
          {currentStatus.benefits.map((benefit, index) => (
            <div key={index} style={styles.benefitItem}>
              <Star size={14} color="#ffc107" />
              {benefit}
            </div>
          ))}
        </div>

        {nextStatus && (
          <div>
            <div style={{ fontSize: theme.typography.fontSize.sm, marginBottom: theme.spacing.sm }}>
              До {nextStatus.name}: {formatCurrency(nextStatus.minBonus - bonusBalance)}
            </div>
            <div style={styles.progressBar}>
              <div style={{...styles.progressFill, width: `${Math.min(progressToNext, 100)}%`}} />
            </div>
          </div>
        )}
      </div>

      {/* Referral Card */}
      <div style={styles.referralCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          <div style={{...styles.statusIcon, background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)' }}>
            <Users size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold }}>
              Пригласи друзей
            </div>
            <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary }}>
              Получай бонусы за друзей
            </div>
          </div>
        </div>

        <div style={{ fontSize: theme.typography.fontSize.sm, marginBottom: theme.spacing.md }}>
          Получите 50 🍒 за каждого друга, который сделает первый заказ
        </div>

        <div style={styles.referralCode}>
          {referralCode}
        </div>

        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          <PrimaryButton
            size="sm"
            onClick={copyReferralCode}
          >
            Скопировать код
          </PrimaryButton>
          <SecondaryButton
            size="sm"
            onClick={copyReferralLink}
          >
            Скопировать ссылку
          </SecondaryButton>
        </div>
      </div>

      {/* Recent Transactions */}
      <div style={{ padding: `0 ${theme.padding.screen}` }}>
        <h3 style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, marginBottom: theme.spacing.md, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>История бонусов</h3>
        {transactions.map((transaction) => (
          <div key={transaction.id} style={styles.transactionCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
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
                color: transaction.type === 'earned' ? '#4caf50' : 
                       transaction.type === 'spent' ? '#ff2d55' : '#ffc107'
              }}>
                {transaction.type === 'earned' ? '+' : ''}{transaction.amount} 🍒
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* How to Earn */}
      <div style={{ padding: `0 ${theme.padding.screen}`, marginTop: theme.spacing.xl }}>
        <h3 style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, marginBottom: theme.spacing.md, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Как заработать бонусы</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
          <GlassCard padding="md" variant="elevated">
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <Gift size={20} color="#ff2d55" />
              <div>
                <div style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                  Делайте покупки
                </div>
                <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary }}>
                  Получайте кэшбэк с каждого заказа
                </div>
              </div>
            </div>
          </GlassCard>
          <GlassCard padding="md" variant="elevated">
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <Users size={20} color="#4caf50" />
              <div>
                <div style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                  Приглашайте друзей
                </div>
                <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary }}>
                  50 🍒 за каждого друга
                </div>
              </div>
            </div>
          </GlassCard>
          <GlassCard padding="md" variant="elevated">
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <Star size={20} color="#ffc107" />
              <div>
                <div style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                  Участвуйте в акциях
                </div>
                <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary }}>
                  Дополнительные бонусы в специальных предложениях
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default Bonuses;
