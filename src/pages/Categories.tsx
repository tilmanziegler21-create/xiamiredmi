import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CherryMascot, ChipBadge, GlassCard, theme } from '../ui';
import { useConfigStore } from '../store/useConfigStore';

const Categories: React.FC = () => {
  const navigate = useNavigate();
  const { config } = useConfigStore();
  const tiles = config?.categoryTiles || [];
  const titleFontSize = (title: string) => (String(title || '').trim().length > 9 ? 17 : 22);
  const atmos: Record<string, { bg: string; mascot: any }> = {
    'Жидкости': { bg: 'radial-gradient(120% 90% at 20% 18%, rgba(52,211,153,0.35) 0%, rgba(0,0,0,0) 58%), radial-gradient(110% 90% at 78% 26%, rgba(16,185,129,0.22) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)', mascot: 'green' },
    'Одноразки': { bg: 'radial-gradient(120% 90% at 18% 18%, rgba(251,191,36,0.34) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(245,158,11,0.22) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)', mascot: 'gold' },
    'Поды': { bg: 'radial-gradient(120% 90% at 18% 18%, rgba(96,165,250,0.28) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(139,92,246,0.26) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)', mascot: 'cosmic' },
    'Картриджи': { bg: 'radial-gradient(120% 90% at 18% 18%, rgba(251,113,133,0.28) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(244,63,94,0.24) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)', mascot: 'pink' },
  };

  const extra = [
    { slug: 'Все', title: 'Все товары', imageUrl: '/assets/elfcherry/banners/banner-1.jpg', badgeText: '', to: '/catalog', key: 'all' },
    { slug: 'Новинки', title: 'Новинки', imageUrl: '/assets/elfcherry/banners/banner-2.jpg', badgeText: 'NEW', to: '/catalog?category=Новинки', key: 'new' },
    { slug: 'Хиты', title: 'Хиты', imageUrl: '/assets/elfcherry/banners/banner-3.jpg', badgeText: 'TOP', to: '/catalog?category=Хиты', key: 'hits' },
  ];
  const all = [...extra, ...tiles.map((t: any) => ({ ...t, to: `/catalog?category=${encodeURIComponent(t.slug)}`, key: String(t.slug) }))];

  return (
    <div style={{ padding: theme.padding.screen }}>
      <div
        style={{
          textAlign: 'center',
          color: theme.colors.dark.text,
          fontSize: theme.typography.fontSize['2xl'],
          fontWeight: theme.typography.fontWeight.bold,
          marginBottom: theme.spacing.lg,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
        }}
      >
        Категории
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
        {!all.length ? (
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
        ) : all.map((t: any) => (
          (() => {
            const a = atmos[String(t.slug)] || atmos[String(t.title)];
            const bg = a?.bg || 'linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.7) 100%)';
            const mascot = a?.mascot || 'classic';
            return (
          <GlassCard
            key={t.key}
            padding="md"
            variant="elevated"
            style={{
              height: 140,
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              background: bg,
              cursor: 'pointer',
              position: 'relative',
            }}
            onClick={() => navigate(String(t.to))}
          >
            {t.imageUrl ? (
              <img
                src={String(t.imageUrl)}
                alt=""
                loading="lazy"
                decoding="async"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.22, filter: 'saturate(1.1) contrast(1.05)' }}
              />
            ) : null}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.82) 100%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', right: -36, bottom: -34, width: 220, height: 220, pointerEvents: 'none', zIndex: 1 }}>
              <CherryMascot variant={mascot} size={196} />
            </div>
            {t.badgeText ? (
              <div style={{ position: 'absolute', top: theme.spacing.md, right: theme.spacing.md, zIndex: 3 }}>
                <ChipBadge variant="new" size="sm">{t.badgeText}</ChipBadge>
              </div>
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: theme.spacing.md,
                right: theme.spacing.md,
                bottom: theme.spacing.md,
                textAlign: 'left',
                fontSize: titleFontSize(String(t.title)),
                fontWeight: theme.typography.fontWeight.bold,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textShadow: '0 12px 30px rgba(0,0,0,0.60)',
                fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
                zIndex: 2,
                maxWidth: '60%',
                whiteSpace: 'nowrap',
              }}
            >
              {t.title}
            </div>
          </GlassCard>
            );
          })()
        ))}
      </div>
    </div>
  );
};

export default Categories;
