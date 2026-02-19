import React from 'react';
import { theme } from './theme';

export const FooterBar: React.FC = () => {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: theme.zIndex.header,
        padding: `${theme.spacing.sm} ${theme.padding.screen}`,
        paddingBottom: `calc(${theme.spacing.sm} + var(--safe-area-bottom, 0px))`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: 'rgba(255,255,255,0.55)',
        fontSize: theme.typography.fontSize.xs,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      <span>ELFCHERRY</span>
      <span>Поддержка 24/7</span>
    </div>
  );
};

