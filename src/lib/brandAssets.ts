const IMAGE_CACHE_KEY = (import.meta.env?.VITE_IMAGE_CACHE_KEY as string) || '20260310';

const assetUrl = (p: string) => {
  const base = String(import.meta.env.BASE_URL || '/');
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  const path = p.startsWith('/') ? p : `/${p}`;
  return `${prefix}${path}`;
};

const normalizeBrand = (v: string) =>
  String(v || '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');

const compactBrand = (v: string) => normalizeBrand(v).replace(/\s+/g, '');

const withVersion = (p: string) => (/[?&]v=/.test(p) ? p : `${p}${p.includes('?') ? '&' : '?'}v=${IMAGE_CACHE_KEY}`);

const BRAND_IMAGE_RULES: Array<{ match: (cleaned: string, compact: string) => boolean; path: string }> = [
  { match: (_c, k) => k.includes('elfliq'), path: '/images/brands/elfliq/elfliq_liquid.png' },
  { match: (_c, k) => k.includes('elflic') || k.includes('elfic'), path: '/images/brands/elflic.png' },
  { match: (c, k) => k.includes('elfbar') || c.includes('elf bar'), path: '/images/brands/elfbar/elfbar_liquid.png' },
  { match: (c, k) => k.includes('geekvape') || c.includes('geek vape'), path: '/images/brands/geekvape/geekvape_liquid.png' },
  { match: (_c, k) => k.includes('vaporesso'), path: '/images/brands/vaporesso/vaporesso_liquid.png' },
  { match: (_c, k) => k.includes('vozolgear'), path: '/images/brands/vozolgear.png' },
  { match: (_c, k) => k.includes('vozol40'), path: '/images/brands/vozol40.png' },
  { match: (_c, k) => k.includes('iceking'), path: '/images/brands/iceking.png' },
  { match: (_c, k) => k.includes('lushking'), path: '/images/brands/lushking.png' },
  { match: (_c, k) => k.includes('sourking'), path: '/images/brands/sourking.png' },
  { match: (_c, k) => k.includes('sweetking'), path: '/images/brands/sweetking.png' },
  { match: (_c, k) => k.includes('nicking'), path: '/images/brands/nicking.png' },
  { match: (_c, k) => k.includes('trio'), path: '/images/brands/trio.png' },
  { match: (_c, k) => k.includes('rave'), path: '/images/brands/rave.png' },
  { match: (_c, k) => k.includes('bc45000'), path: '/images/brands/bc45000.png' },
  { match: (_c, k) => k.includes('ebcreate'), path: '/images/brands/ebcreate.png' },
  { match: (_c, k) => k.includes('moon'), path: '/images/brands/moon.png' },
  { match: (_c, k) => k.includes('rayad3'), path: '/images/brands/rayad3.png' },
];

export const normalizeProvidedImage = (v: string) => {
  const raw = String(v || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (['-', '—', '–', 'null', 'undefined', '0', 'нет', 'no', 'n/a', 'na'].includes(lower)) return '';
  if (lower.includes('via.placeholder.com')) return '';
  if (lower.startsWith('data:image/')) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    if (lower.includes('googleusercontent.com') || lower.includes('lh3.googleusercontent.com')) return raw;
    if (lower.includes('drive.google.com')) {
      const m1 = raw.match(/\/file\/d\/([^/]+)\//);
      const m2 = raw.match(/[?&]id=([^&]+)/);
      const id = (m1 && m1[1]) || (m2 && m2[1]) || '';
      if (id) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;
      return raw;
    }
  }
  const base = lower.split('#')[0].split('?')[0];
  const isImageUrl = /\.(png|jpe?g|webp|gif|svg)$/.test(base);
  if (!isImageUrl) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return assetUrl(withVersion(raw));
  if (raw.startsWith('images/')) return assetUrl(withVersion(`/${raw}`));
  return '';
};

export const getBrandImageUrl = (brand: string, providedImage = '') => {
  const normalized = normalizeProvidedImage(providedImage);
  if (normalized) return normalized;
  const cleaned = normalizeBrand(brand);
  const compact = compactBrand(brand);
  const hit = BRAND_IMAGE_RULES.find((r) => r.match(cleaned, compact));
  return hit ? assetUrl(withVersion(hit.path)) : '';
};

export const getBrandGradient = (brand: string, primary = 'linear-gradient(135deg, #8a1f38 0%, #2a0f1a 100%)', secondary = 'linear-gradient(135deg, #304b8a 0%, #1a1f3a 100%)') => {
  const cleaned = normalizeBrand(brand);
  const compact = compactBrand(brand);
  if (compact.includes('geekvape') || cleaned.includes('geek vape') || compact.includes('vaporesso')) return secondary;
  if (BRAND_IMAGE_RULES.some((r) => r.match(cleaned, compact))) return primary;
  return 'linear-gradient(135deg, #333 0%, #666 100%)';
};
