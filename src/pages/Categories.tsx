import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, theme } from '../ui';
import { useConfigStore } from '../store/useConfigStore';

const Categories: React.FC = () => {
  const navigate = useNavigate();
  const { config } = useConfigStore();
  const tiles = config?.categoryTiles || [];

  return (
    <div style={{ padding: theme.padding.screen }}>
      <div
        style={{
          textAlign: 'center',
          color: theme.colors.dark.text,
          fontSize: theme.typography.fontSize['2xl'],
          fontWeight: theme.typography.fontWeight.bold,
          marginBottom: theme.spacing.lg,
        }}
      >
        Категории
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
        {!tiles.length ? (
          [...Array(4)].map((_, i) => (
            <GlassCard
              key={i}
              padding="md"
              variant="elevated"
              style={{ height: 140, borderRadius: theme.radius.lg, overflow: 'hidden' }}
            >
              <div style={{ height: 140 }} className="animate-pulse" />
            </GlassCard>
          ))
        ) : tiles.map((t) => (
          <GlassCard
            key={t.slug}
            padding="md"
            variant="elevated"
            style={{
              height: 140,
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              background: `linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.7) 100%), url(${t.imageUrl}) center/contain no-repeat`,
              cursor: 'pointer',
              position: 'relative',
            }}
            onClick={() => navigate(`/catalog?category=${encodeURIComponent(t.slug)}`)}
          >
            {t.badgeText ? (
              <div
                style={{
                  position: 'absolute',
                  top: theme.spacing.md,
                  right: theme.spacing.md,
                  background: theme.colors.dark.accentRed,
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.bold,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {t.badgeText}
              </div>
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: theme.spacing.md,
                right: theme.spacing.md,
                bottom: theme.spacing.md,
                textAlign: 'center',
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {t.title}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

export default Categories;
