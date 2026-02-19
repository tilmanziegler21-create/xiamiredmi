import React from 'react';
import { theme } from './theme';

type Props = {
  title: string;
};

export const SectionDivider: React.FC<Props> = ({ title }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: `${theme.spacing.md} ${theme.padding.screen}`,
        color: 'rgba(255,255,255,0.55)',
        textTransform: 'uppercase',
        letterSpacing: '0.16em',
        fontSize: theme.typography.fontSize.xs,
      }}
    >
      <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', flex: 1 }} />
      <div style={{ whiteSpace: 'nowrap' }}>{title}</div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', flex: 1 }} />
    </div>
  );
};

