import React from 'react';
import { theme } from './theme';
import { GlassCard } from './GlassCard';

type Props = {
  open: boolean;
  cities: Array<{ code: string; title: string }>;
  selectedCity: string | null;
  onSelect: (city: string) => void;
  onClose?: () => void;
};

export const CityPickerModal: React.FC<Props> = ({ open, cities, selectedCity, onSelect, onClose }) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        background: 'rgba(0,0,0,0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.padding.screen,
      }}
      onClick={onClose}
    >
      <div style={{ width: '100%', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <GlassCard padding="lg" variant="elevated" style={{ borderRadius: theme.radius.lg }}>
          <div style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Выберите город
          </div>
          <div style={{ height: theme.spacing.md }} />
          <div style={{ display: 'grid', gap: theme.spacing.sm }}>
            {cities.map((c) => {
              const active = c.code === selectedCity;
              return (
                <button
                  key={c.code}
                  onClick={() => onSelect(c.code)}
                  style={{
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: active ? theme.gradients.primary : 'rgba(255,255,255,0.06)',
                    color: theme.colors.dark.text,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    fontSize: theme.typography.fontSize.base,
                    fontWeight: theme.typography.fontWeight.semibold,
                    letterSpacing: '0.04em',
                  }}
                >
                  {c.title}
                </button>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
