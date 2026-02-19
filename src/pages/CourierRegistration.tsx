import React from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { GlassCard, SectionDivider, PrimaryButton, SecondaryButton, theme } from '../ui';
import { useCityStore } from '../store/useCityStore';
import { useToastStore } from '../store/useToastStore';

const CourierRegistration: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { city } = useCityStore();

  const [courierId, setCourierId] = React.useState('');
  const [name, setName] = React.useState('');
  const [tgId, setTgId] = React.useState('');
  const [timeFrom, setTimeFrom] = React.useState('10:00');
  const [timeTo, setTimeTo] = React.useState('23:00');
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
    try {
      if (!city) {
        toast.push('Выберите город', 'error');
        return;
      }
      if (!courierId.trim() || !name.trim()) {
        toast.push('Заполните courierId и имя', 'error');
        return;
      }
      setLoading(true);
      await adminAPI.addCourier({
        city,
        courierId: courierId.trim(),
        name: name.trim(),
        tgId: tgId.trim() || undefined,
        timeFrom: timeFrom.trim() || undefined,
        timeTo: timeTo.trim() || undefined,
      });
      toast.push('Курьер добавлен', 'success');
      navigate('/admin');
    } catch (e) {
      console.error('Failed to add courier:', e);
      toast.push('Ошибка добавления курьера', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: theme.spacing.xl }}>
      <SectionDivider title="Добавить курьера" />
      <div style={{ padding: `0 ${theme.padding.screen}`, display: 'grid', gap: theme.spacing.md }}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ display: 'grid', gap: theme.spacing.sm }}>
            <label style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>Courier ID</label>
            <input
              value={courierId}
              onChange={(e) => setCourierId(e.target.value)}
              placeholder="например 12345"
              style={{
                width: '100%',
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.06)',
                color: theme.colors.dark.text,
                outline: 'none',
              }}
            />
            <label style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>Имя</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Имя курьера"
              style={{
                width: '100%',
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.06)',
                color: theme.colors.dark.text,
                outline: 'none',
              }}
            />
            <label style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>Telegram ID (опционально)</label>
            <input
              value={tgId}
              onChange={(e) => setTgId(e.target.value)}
              placeholder="tg id"
              style={{
                width: '100%',
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.06)',
                color: theme.colors.dark.text,
                outline: 'none',
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm }}>
              <div>
                <label style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>С</label>
                <input
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                  placeholder="10:00"
                  style={{
                    width: '100%',
                    padding: theme.spacing.md,
                    borderRadius: theme.radius.md,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.06)',
                    color: theme.colors.dark.text,
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.dark.textSecondary }}>До</label>
                <input
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                  placeholder="23:00"
                  style={{
                    width: '100%',
                    padding: theme.spacing.md,
                    borderRadius: theme.radius.md,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.06)',
                    color: theme.colors.dark.text,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              <SecondaryButton fullWidth onClick={() => navigate('/admin')} disabled={loading}>Назад</SecondaryButton>
              <PrimaryButton fullWidth onClick={submit} disabled={loading}>{loading ? 'Сохранение...' : 'Сохранить'}</PrimaryButton>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default CourierRegistration;
