import React from 'react';
import { theme } from './theme';

interface TasteProfileProps {
  sweetness: number; // 1-5
  sourness?: number; // 1-5
  fruitiness?: number; // 1-5
  coolness?: number; // 1-5
  strength?: number; // 1-5
  size?: 'sm' | 'md';
}

export const TasteProfile: React.FC<TasteProfileProps> = ({
  sweetness,
  sourness = 0,
  fruitiness = 0,
  coolness = 0,
  strength = 0,
  size = 'md',
}) => {
  const scaleSize = size === 'sm' ? 12 : 16;
  const fontSize = size === 'sm' ? theme.typography.fontSize.xs : theme.typography.fontSize.sm;
  
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: size === 'sm' ? 2 : 4,
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    label: {
      fontSize: fontSize,
      color: theme.colors.dark.textSecondary,
      minWidth: size === 'sm' ? '60px' : '70px',
      textTransform: 'capitalize' as const,
    },
    scale: {
      display: 'flex',
      gap: '2px',
      flex: 1,
    },
    dot: {
      width: scaleSize,
      height: scaleSize,
      borderRadius: '50%',
      transition: 'all 0.2s ease',
    },
    dotFilled: {
      backgroundColor: '#ff2d55',
      boxShadow: '0 2px 4px rgba(255,45,85,0.3)',
    },
    dotEmpty: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      border: '1px solid rgba(255,255,255,0.2)',
    },
  };

  const renderScale = (value: number, max: number = 5) => {
    return (
      <div style={styles.scale}>
        {Array.from({ length: max }, (_, i) => (
          <div
            key={i}
            style={{
              ...styles.dot,
              ...(i < value ? styles.dotFilled : styles.dotEmpty),
            }}
          />
        ))}
      </div>
    );
  };

  const tasteLabels = [
    { key: 'sweetness', label: '🍬 Сладкий', value: sweetness },
    ...(sourness > 0 ? [{ key: 'sourness', label: '🍋 Кислый', value: sourness }] : []),
    ...(fruitiness > 0 ? [{ key: 'fruitiness', label: '🍑 Фруктовый', value: fruitiness }] : []),
    ...(coolness > 0 ? [{ key: 'coolness', label: '🧊 Холодный', value: coolness }] : []),
    ...(strength > 0 ? [{ key: 'strength', label: '💪 Крепкий', value: strength }] : []),
  ];

  return (
    <div style={styles.container}>
      {tasteLabels.map(({ key, label, value }) => (
        <div key={key} style={styles.row}>
          <span style={styles.label}>{label}</span>
          {renderScale(value)}
        </div>
      ))}
    </div>
  );
};