import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme, GlassCard, SectionDivider, PrimaryButton, SecondaryButton } from '../ui';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { RotateCcw, Gift, Star, Trophy } from 'lucide-react';
import { fortuneAPI } from '../services/api';

interface WheelPrize {
  id: string;
  name: string;
  type: 'bonus' | 'discount' | 'gift' | 'nothing';
  value: number;
  probability: number;
  color: string;
}

const FortuneWheel: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { user, token, setUser } = useAuthStore();
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedPrize, setSelectedPrize] = useState<WheelPrize | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [dailySpins, setDailySpins] = useState(0);
  const [tier, setTier] = useState<'regular' | 'vip' | 'elite'>('regular');

  const prizes: WheelPrize[] = [
    { id: '1', name: '2 бонуса', type: 'bonus', value: 2, probability: 0.25, color: '#ff2d55' },
    { id: '2', name: 'WELCOME10', type: 'discount', value: 10, probability: 0.10, color: '#ff4d6d' },
    { id: '3', name: '5 бонусов', type: 'bonus', value: 5, probability: 0.20, color: '#ff9800' },
    { id: '4', name: 'Попробуйте еще', type: 'nothing', value: 0, probability: 0.18, color: '#607d8b' },
    { id: '5', name: '10 бонусов', type: 'bonus', value: 10, probability: 0.15, color: '#2196f3' },
    { id: '6', name: '2 бонуса', type: 'bonus', value: 2, probability: 0.13, color: '#9c27b0' },
    { id: '7', name: '20 бонусов', type: 'bonus', value: 20, probability: 0.07, color: '#4caf50' },
    { id: '8', name: '5 бонусов', type: 'bonus', value: 5, probability: 0.12, color: '#ffc107' },
  ];

  useEffect(() => {
    (async () => {
      try {
        const resp = await fortuneAPI.state();
        setDailySpins(Number(resp.data?.left || 0));
        setTier((resp.data?.tier as any) || 'regular');
      } catch {
        setDailySpins(0);
      }
    })();
  }, []);

  const spinWheel = async () => {
    if (isSpinning || dailySpins <= 0) return;

    setIsSpinning(true);
    setShowResult(false);

    let reward: any = null;
    try {
      const resp = await fortuneAPI.spin();
      reward = resp.data?.reward;
      setDailySpins(Number(resp.data?.left ?? Math.max(0, dailySpins - 1)));
      setTier((resp.data?.tier as any) || tier);
      if (reward?.type === 'bonus' && user && token) {
        const nextBalance = Number(resp.data?.bonusBalance ?? user.bonusBalance);
        setUser({ ...user, bonusBalance: nextBalance }, token);
      }
    } catch (e: any) {
      setIsSpinning(false);
      if (e?.response?.status === 409) toast.push('Вращения закончились', 'error');
      else toast.push('Не удалось вращать колесо', 'error');
      return;
    }

    const selected =
      reward?.type === 'nothing'
        ? prizes.find((p) => p.type === 'nothing') || prizes[0]
        : reward?.type === 'promo'
          ? prizes.find((p) => p.type === 'discount') || prizes[0]
          : prizes.find((p) => p.type === 'bonus' && p.value === Number(reward?.amount || 0)) || prizes[0];

    const prizeIndex = prizes.findIndex((p) => p.id === selected.id);
    const sectorAngle = 360 / prizes.length;
    const prizeAngle = prizeIndex * sectorAngle + sectorAngle / 2;
    const spins = 5;
    const finalRotation = rotation + spins * 360 + (360 - prizeAngle);

    setRotation(finalRotation);
    setSelectedPrize(selected);

    setTimeout(() => {
      setIsSpinning(false);
      setShowResult(true);
      if (reward?.type === 'nothing') toast.push('Попробуйте еще раз!', 'info');
      else if (reward?.type === 'promo') toast.push('Промокод WELCOME10 добавлен', 'success');
      else toast.push(`Выигрыш: ${selected.name}`, 'success');
    }, 3000);
  };

  const styles = {
    container: {
      minHeight: '100vh',
      color: theme.colors.dark.text,
      fontFamily: theme.typography.fontFamily,
      paddingBottom: theme.spacing.xl,
    },
    wheelContainer: {
      position: 'relative' as const,
      width: '280px',
      height: '280px',
      margin: '0 auto',
      marginBottom: theme.spacing.xl,
    },
    wheel: {
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      position: 'relative' as const,
      overflow: 'hidden',
      boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
      border: '4px solid rgba(255,255,255,0.2)',
      transition: 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)',
    },
    sector: {
      position: 'absolute' as const,
      width: '50%',
      height: '50%',
      transformOrigin: 'right bottom',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      color: '#ffffff',
      textAlign: 'center' as const,
      padding: '8px',
      lineHeight: '1.2',
    },
    pointer: {
      position: 'absolute' as const,
      top: '-20px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 0,
      height: 0,
      borderLeft: '15px solid transparent',
      borderRight: '15px solid transparent',
      borderTop: '30px solid #ff2d55',
      zIndex: 10,
    },
    centerButton: {
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #ff2d55 0%, #b0003a 100%)',
      border: '4px solid rgba(255,255,255,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(255,45,85,0.4)',
      zIndex: 5,
    },
    resultCard: {
      background: 'linear-gradient(135deg, rgba(255,193,7,0.15) 0%, rgba(255,152,0,0.1) 100%)',
      border: '1px solid rgba(255,193,7,0.3)',
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      margin: `0 ${theme.padding.screen} ${theme.spacing.lg}`,
      textAlign: 'center' as const,
    },
    prizeIcon: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto',
      marginBottom: theme.spacing.md,
    },
    statsCard: {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      margin: `0 ${theme.padding.screen} ${theme.spacing.md}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rulesCard: {
      background: 'rgba(255,255,255,0.03)',
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      margin: `0 ${theme.padding.screen}`,
      border: '1px solid rgba(255,255,255,0.1)',
    },
  };

  return (
    <div style={styles.container}>
      <SectionDivider title="Колесо фортуны" />

      {/* Stats */}
      <div style={styles.statsCard}>
        <div>
          <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>
            Осталось вращений
          </div>
          <div style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, color: dailySpins > 0 ? '#4caf50' : '#ff2d55' }}>
            {dailySpins}
          </div>
        </div>
        <div>
          <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>
            Ваш статус
          </div>
          <div style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold }}>
            {tier === 'vip' ? 'VIP' : tier === 'elite' ? 'ELITE' : 'Обычный'}
          </div>
        </div>
      </div>

      {/* Wheel */}
      <div style={styles.wheelContainer}>
        <div style={styles.pointer} />
        <div 
          style={{
            ...styles.wheel,
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {prizes.map((prize, index) => {
            const angle = (360 / prizes.length) * index;
            return (
              <div
                key={prize.id}
                style={{
                  ...styles.sector,
                  backgroundColor: prize.color,
                  transform: `rotate(${angle}deg)`,
                }}
              >
                <div style={{ transform: `rotate(${360 / prizes.length / 2}deg)` }}>
                  {prize.name}
                </div>
              </div>
            );
          })}
        </div>
        <div 
          style={styles.centerButton}
          onClick={spinWheel}
        >
          <RotateCcw size={32} color="#ffffff" />
        </div>
      </div>

      {/* Result */}
      {showResult && selectedPrize && (
        <div style={styles.resultCard}>
          <div style={styles.prizeIcon}>
            {selectedPrize.type === 'bonus' ? <Star size={32} color="#000" /> :
             selectedPrize.type === 'discount' ? <Gift size={32} color="#000" /> :
             selectedPrize.type === 'gift' ? <Trophy size={32} color="#000" /> :
             <RotateCcw size={32} color="#000" />}
          </div>
          <h3 style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, marginBottom: theme.spacing.sm }}>
            {selectedPrize.type === 'nothing' ? 'Не повезло!' : 'Поздравляем!'}
          </h3>
          <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary, marginBottom: theme.spacing.md }}>
            {selectedPrize.name}
          </p>
          {selectedPrize.type !== 'nothing' && (
            <PrimaryButton
              size="sm"
              onClick={() => navigate('/catalog')}
            >
              Использовать
            </PrimaryButton>
          )}
        </div>
      )}

      {/* Rules */}
      <div style={styles.rulesCard}>
        <h4 style={{ fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.bold, marginBottom: theme.spacing.sm }}>
          Правила
        </h4>
        <ul style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary, margin: 0, paddingLeft: theme.spacing.md }}>
          <li>3 вращения в день для всех пользователей</li>
          <li>VIP пользователи получают 5 вращений</li>
          <li>ELITE пользователи получают 10 вращений</li>
          <li>Выигрыши можно использовать в течение 7 дней</li>
          <li>Каждый выигрыш можно использовать только один раз</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div style={{ padding: `0 ${theme.padding.screen}` }}>
        <div style={{ display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          <PrimaryButton
            size="sm"
            onClick={() => navigate('/promotions')}
          >
            Все акции
          </PrimaryButton>
          <SecondaryButton
            size="sm"
            onClick={() => navigate('/bonuses')}
          >
            Мои бонусы
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
};

export default FortuneWheel;
