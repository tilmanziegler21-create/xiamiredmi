import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme, GlassCard, SectionDivider, PrimaryButton } from '../ui';
import { useConfigStore } from '../store/useConfigStore';
import { useToastStore } from '../store/useToastStore';
import { Gift, Clock, TrendingUp, RotateCcw } from 'lucide-react';
import { formatCurrency } from '../lib/currency';

interface Promotion {
  id: string;
  title: string;
  description: string;
  discount: number;
  type: 'percentage' | 'fixed' | 'gift';
  validUntil: string;
  image?: string;
  terms: string[];
  isActive: boolean;
}

interface Contest {
  id: string;
  title: string;
  description: string;
  prize: string;
  endDate: string;
  participants: number;
  image?: string;
  isActive: boolean;
}

const Promotions: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { config } = useConfigStore();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPromotionsAndContests();
  }, [config]);

  const loadPromotionsAndContests = async () => {
    try {
      setLoading(true);
      const promos = config?.promos || [];
      const mappedPromos: Promotion[] = promos.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        discount: Number(p.value || 0),
        type: p.type === 'percent' ? 'percentage' : 'fixed',
        validUntil: p.endsAt || '',
        terms: [
          p.minTotal ? `Минимальная сумма заказа ${formatCurrency(Number(p.minTotal || 0))}` : '',
          p.startsAt ? `Старт ${new Date(p.startsAt).toLocaleDateString()}` : '',
        ].filter(Boolean),
        isActive: true,
      }));

      const contestsRaw = config?.contests || [];
      const mappedContests: Contest[] = contestsRaw.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        prize: '',
        endDate: '',
        participants: 0,
        isActive: true,
      }));

      setPromotions(mappedPromos);
      setContests(mappedContests);
    } catch (error) {
      toast.push('Ошибка загрузки акций', 'error');
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
    promotionCard: {
      background: 'linear-gradient(135deg, rgba(255,45,85,0.18) 0%, rgba(176,0,58,0.10) 100%)',
      border: '1px solid rgba(255,45,85,0.28)',
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      position: 'relative' as const,
      overflow: 'hidden' as const,
    },
    contestCard: {
      background: 'linear-gradient(135deg, rgba(255,193,7,0.15) 0%, rgba(255,152,0,0.1) 100%)',
      border: '1px solid rgba(255,193,7,0.3)',
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    badge: {
      position: 'absolute' as const,
      top: theme.spacing.md,
      right: theme.spacing.md,
      background: theme.gradients.primary,
      color: '#ffffff',
      padding: '4px 8px',
      borderRadius: theme.radius.sm,
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
    },
    iconWrapper: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
    },
    title: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      marginBottom: theme.spacing.sm,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
    },
    description: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.dark.textSecondary,
      marginBottom: theme.spacing.md,
      lineHeight: '1.5',
    },
    terms: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.dark.textSecondary,
      opacity: 0.8,
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.md,
      borderTop: '1px solid rgba(255,255,255,0.1)',
    },
    participants: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
      padding: theme.spacing.sm,
      background: 'rgba(255,255,255,0.05)',
      borderRadius: theme.radius.md,
    },
    wheelButton: {
      background: 'linear-gradient(135deg, rgba(255,193,7,0.2) 0%, rgba(255,152,0,0.15) 100%)',
      border: '1px solid rgba(255,193,7,0.4)',
      color: '#ffc107',
      marginBottom: theme.spacing.md,
    },
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <SectionDivider title="Акции и конкурсы" />
        <div style={{ padding: `0 ${theme.padding.screen}` }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{...styles.promotionCard, animation: 'pulse 1.5s ease-in-out infinite'}} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <SectionDivider title="Акции и конкурсы" />

      {/* Fortune Wheel Button */}
      <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.lg }}>
        <PrimaryButton
          fullWidth
          onClick={() => navigate('/fortune')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }}>
            <RotateCcw size={20} />
            Колесо фортуны
          </div>
        </PrimaryButton>
      </div>

      {/* Active Promotions */}
      <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.xl }}>
        <h3 style={{...styles.title, marginBottom: theme.spacing.md}}>Активные акции</h3>
        {promotions.filter(p => p.isActive).map((promotion) => (
          <div key={promotion.id} style={styles.promotionCard}>
            <div style={styles.badge}>
              {promotion.type === 'percentage' ? `-${promotion.discount}%` : 
               promotion.type === 'fixed' ? `-${formatCurrency(promotion.discount)}` : 'ПОДАРОК'}
            </div>
            <div style={styles.iconWrapper}>
              <Gift size={24} color={theme.colors.dark.primary} />
            </div>
            <h4 style={styles.title}>{promotion.title}</h4>
            <p style={styles.description}>{promotion.description}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
              <Clock size={16} color={theme.colors.dark.textSecondary} />
              <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary }}>
                До {new Date(promotion.validUntil).toLocaleDateString()}
              </span>
            </div>
            <PrimaryButton
              size="sm"
              onClick={() => navigate('/catalog')}
            >
              Посмотреть товары
            </PrimaryButton>
            <div style={styles.terms}>
              <strong>Условия:</strong>
              <ul style={{ margin: 0, paddingLeft: theme.spacing.md, marginTop: theme.spacing.xs }}>
                {promotion.terms.map((term, index) => (
                  <li key={index}>{term}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Contests */}
      <div style={{ padding: `0 ${theme.padding.screen}` }}>
        <h3 style={{...styles.title, marginBottom: theme.spacing.md}}>Активные конкурсы</h3>
        {contests.filter(c => c.isActive).map((contest) => (
          <div key={contest.id} style={styles.contestCard}>
            <div style={styles.iconWrapper}>
              <TrendingUp size={24} color="#ffc107" />
            </div>
            <h4 style={styles.title}>{contest.title}</h4>
            <p style={styles.description}>{contest.description}</p>
            <div style={styles.participants}>
              <TrendingUp size={16} color="#ffc107" />
              <span style={{ fontSize: theme.typography.fontSize.sm }}>
                Уже участвуют: {contest.participants} человек
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
              <Clock size={16} color={theme.colors.dark.textSecondary} />
              <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary }}>
                {contest.endDate ? `До ${new Date(contest.endDate).toLocaleDateString()}` : 'Скоро'}
              </span>
            </div>
            <PrimaryButton
              size="sm"
              onClick={() => {
                const route = config?.contests?.find((x) => x.id === contest.id)?.route;
                if (route) navigate(route);
                else toast.push('Скоро', 'info');
              }}
            >
              Участвовать
            </PrimaryButton>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Promotions;
