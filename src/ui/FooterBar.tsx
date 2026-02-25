import React from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from './theme';

export const FooterBar: React.FC = () => {
  const navigate = useNavigate();
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
      <span
        role="button"
        tabIndex={0}
        onClick={() => navigate('/support')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate('/support');
          }
        }}
        style={{ cursor: 'pointer', color: theme.colors.dark.text }}
      >
        Поддержка 24/7
      </span>
    </div>
  );
};
