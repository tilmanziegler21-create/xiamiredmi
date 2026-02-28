import React from 'react';

type Variant = 'classic' | 'green' | 'gold' | 'cosmic' | 'pink';

type Props = {
  variant?: Variant;
  size?: number;
};

export const CherryMascot: React.FC<Props> = ({ variant = 'classic', size = 44 }) => {
  const palette: Record<Variant, { a: string; b: string; glow: string }> = {
    classic: { a: '#ff2d55', b: '#b0003a', glow: 'rgba(255,45,85,0.35)' },
    green: { a: '#34d399', b: '#059669', glow: 'rgba(52,211,153,0.30)' },
    gold: { a: '#fbbf24', b: '#f59e0b', glow: 'rgba(251,191,36,0.30)' },
    cosmic: { a: '#60a5fa', b: '#8b5cf6', glow: 'rgba(139,92,246,0.32)' },
    pink: { a: '#fb7185', b: '#f43f5e', glow: 'rgba(251,113,133,0.30)' },
  };
  const p = palette[variant] || palette.classic;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 18px 38px rgba(0,0,0,0.45), 0 0 34px ${p.glow}`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <svg width={Math.max(28, Math.floor(size * 0.7))} height={Math.max(28, Math.floor(size * 0.7))} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="c1" x1="8" y1="10" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor={p.a} />
            <stop offset="1" stopColor={p.b} />
          </linearGradient>
          <radialGradient id="h1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(20 20) rotate(45) scale(22 22)">
            <stop stopColor="rgba(255,255,255,0.62)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <path
          d="M36 10c7 2 11 9 11 15 0 1-1 2-2 2-1 0-2-1-2-2 0-5-3-10-8-11-1 0-2-1-1-2 0-1 1-2 2-2Z"
          fill="rgba(255,255,255,0.65)"
        />
        <path d="M35 12c-7 5-10 12-10 20 0 1-1 2-2 2s-2-1-2-2c0-9 4-17 12-23 1-1 2-1 3 0 1 1 1 2-1 3Z" fill="rgba(34,197,94,0.85)" />
        <path d="M21 30c-7 0-13 6-13 14 0 7 5 13 12 14 9 2 18-4 19-13 1-9-6-15-18-15Z" fill="url(#c1)" />
        <path d="M44 28c-7 0-13 6-13 14 0 7 5 13 12 14 9 2 18-4 19-13 1-9-6-15-18-15Z" fill="url(#c1)" opacity="0.92" />
        <path d="M18 34c5-5 13-4 16 2 1 2 0 4-2 5-2 1-4 0-5-2-1-2-4-2-6 0-2 2-4 2-6 1-2-1-2-4 0-6Z" fill="rgba(0,0,0,0.28)" />
        <path d="M41 32c5-5 13-4 16 2 1 2 0 4-2 5-2 1-4 0-5-2-1-2-4-2-6 0-2 2-4 2-6 1-2-1-2-4 0-6Z" fill="rgba(0,0,0,0.28)" opacity="0.9" />
        <circle cx="24" cy="44" r="2" fill="rgba(255,255,255,0.78)" />
        <circle cx="47" cy="44" r="2" fill="rgba(255,255,255,0.78)" />
        <path d="M18 48c5 5 11 6 17 1" stroke="rgba(255,255,255,0.70)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M41 48c5 5 11 6 17 1" stroke="rgba(255,255,255,0.70)" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
        <path d="M10 20c10-6 18-7 27-2" stroke="rgba(255,255,255,0.18)" strokeWidth="4" strokeLinecap="round" />
        <path d="M18 20c6-2 11-2 16 0" stroke="url(#h1)" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(70% 60% at 30% 22%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 62%), radial-gradient(55% 55% at 80% 18%, ${p.glow} 0%, rgba(0,0,0,0) 65%)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
