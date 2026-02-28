import React from 'react';
import { theme } from './theme';
import { IconButton } from './IconButton';
import { ChipBadge } from './ChipBadge';
import { Coins, ShoppingCart, Heart } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { blurStyle } from './blur';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
  brand?: string; // Add brand for brand-based images
  isNew?: boolean;
  stock?: number; // Add stock for availability badges
  onAddToCart?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: boolean;
  onClick?: (id: string) => void;
  tasteProfile?: {
    sweetness: number;
    sourness?: number;
    fruitiness?: number;
    coolness?: number;
    strength?: number;
  };
  trustData?: {
    rating: number;
    reviewCount: number;
    weeklyOrders: number;
  };
  showTasteProfile?: boolean;
  showTrustIndicators?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  price,
  image,
  brand = '', // Add brand prop
  isNew = false,
  stock = 0, // Default stock
  onAddToCart,
  onToggleFavorite,
  isFavorite = false,
  onClick,
  tasteProfile,
  trustData,
  showTasteProfile = false,
  showTrustIndicators = false,
}) => {
  const assetUrl = (p: string) => {
    const base = String(import.meta.env.BASE_URL || '/');
    const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
    const path = p.startsWith('/') ? p : `/${p}`;
    return `${prefix}${path}`;
  };

  const normalizeProvidedImage = (v: string) => {
    const raw = String(v || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    if (['-', '—', '–', 'null', 'undefined', '0', 'нет', 'no', 'n/a', 'na'].includes(lower)) return '';
    if (lower.includes('via.placeholder.com')) return '';
    if (lower.startsWith('data:image/')) return raw;
    const base = lower.split('#')[0].split('?')[0];
    const isImageUrl = /\.(png|jpe?g|webp|gif|svg)$/.test(base);
    if (!isImageUrl) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/')) return assetUrl(raw);
    if (raw.startsWith('images/')) return assetUrl(`/${raw}`);
    return '';
  };

  const brandKey = (s: string) => {
    const cleaned = String(s || '')
      .toLowerCase()
      .trim()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]/g, '');
    return { cleaned, compact: cleaned.replace(/\s+/g, '') };
  };

  // Brand-based image logic with gradient fallback
  const getBrandImage = (brand: string, productImage: string) => {
    const normalized = normalizeProvidedImage(productImage);
    if (normalized) return normalized;
    
    if (!brand) return '';

    const k = brandKey(brand);

    if (k.compact.includes('elfliq')) return assetUrl('/images/brands/elfliq/elfliq_liquid.png');
    if (k.compact.includes('elfic')) return assetUrl('/images/brands/elfic_liquid.png');
    if (k.compact.includes('elflic')) return assetUrl('/images/brands/elfic_liquid.png');
    if (k.compact.includes('elfbar') || k.cleaned.includes('elf bar')) return assetUrl('/images/brands/elfbar/elfbar_liquid.png');
    if (k.compact.includes('geekvape') || k.cleaned.includes('geek vape')) return assetUrl('/images/brands/geekvape/geekvape_liquid.png');
    if (k.compact.includes('vaporesso')) return assetUrl('/images/brands/vaporesso/vaporesso_liquid.png');

    return '';
  };

  // Brand-based gradient backgrounds as fallback
  const getBrandGradient = (brand: string) => {
    if (!brand) return 'linear-gradient(135deg, #333 0%, #666 100%)';
    const k = brandKey(brand);
    if (k.compact.includes('elfliq')) return theme.gradients.primary;
    if (k.compact.includes('elfic')) return theme.gradients.primary;
    if (k.compact.includes('elflic')) return theme.gradients.primary;
    if (k.compact.includes('elfbar') || k.cleaned.includes('elf bar')) return theme.gradients.primary;
    if (k.compact.includes('geekvape') || k.cleaned.includes('geek vape')) return theme.gradients.secondary;
    if (k.compact.includes('vaporesso')) return theme.gradients.secondary;
    return 'linear-gradient(135deg, #333 0%, #666 100%)';
  };

  const token = brand || name;
  const resolvedImage = getBrandImage(token, image);
  const resolvedGradient = getBrandGradient(token);

  const hash01 = (s: string) => {
    let h = 2166136261;
    const str = String(s || '');
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
  };

  const h = hash01(`${id}:${token}`);
  const variant = h < 0.25 ? 'green' : h < 0.5 ? 'gold' : h < 0.75 ? 'cosmic' : 'pink';
  const atmos =
    variant === 'green'
      ? 'radial-gradient(120% 90% at 20% 18%, rgba(52,211,153,0.35) 0%, rgba(0,0,0,0) 58%), radial-gradient(100% 80% at 80% 22%, rgba(16,185,129,0.22) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.85) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)'
      : variant === 'gold'
      ? 'radial-gradient(120% 90% at 18% 18%, rgba(251,191,36,0.34) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(245,158,11,0.22) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.85) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)'
      : variant === 'cosmic'
      ? 'radial-gradient(120% 90% at 18% 18%, rgba(96,165,250,0.28) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(139,92,246,0.26) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.85) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)'
      : 'radial-gradient(120% 90% at 18% 18%, rgba(251,113,133,0.28) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(244,63,94,0.24) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.85) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)';

  const styles = {
    card: {
      position: 'relative' as const,
      height: '250px',
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      background: `${atmos}, ${resolvedGradient}`,
      boxShadow: theme.shadow.card,
    },
    bgImage: {
      position: 'absolute' as const,
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
      zIndex: 0,
      pointerEvents: 'none' as const,
      opacity: 1,
      filter: 'saturate(1.08) contrast(1.08)',
    },
    scrim: {
      position: 'absolute' as const,
      inset: 0,
      background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.05) 48%, rgba(0,0,0,0.86) 100%)',
      zIndex: 1,
      pointerEvents: 'none' as const,
    },
    content: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 2,
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'flex-start',
      padding: theme.spacing.md,
    },
    topRow: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      minWidth: 0,
    },
    title: {
      color: theme.colors.dark.text,
      fontSize: String(name || '').length > 26 ? 12 : 13,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      lineHeight: 1.05,
      letterSpacing: '0.05em',
      textShadow: '0 16px 30px rgba(0,0,0,0.55)',
      overflow: 'hidden',
      maxHeight: '2.1em',
    },
    pricePill: {
      position: 'absolute' as const,
      left: theme.spacing.md,
      bottom: theme.spacing.md,
      background: 'rgba(255,255,255,0.94)',
      color: '#0b0b0b',
      padding: '10px 12px',
      borderRadius: 16,
      fontSize: 18,
      fontWeight: theme.typography.fontWeight.bold,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      boxShadow: '0 18px 30px rgba(0,0,0,0.38)',
      flex: '0 0 auto',
    },
    newBadge: {
      position: 'absolute' as const,
      top: theme.spacing.md,
      right: theme.spacing.md,
    },
    stockBadge: {
      position: 'absolute' as const,
      top: theme.spacing.md,
      left: theme.spacing.md,
      padding: '6px 10px',
      borderRadius: 12,
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
    },
    inStock: {
      background: 'rgba(0,0,0,0.42)',
      color: 'rgba(255,255,255,0.92)',
      border: '1px solid rgba(255,255,255,0.14)',
    },
    outOfStock: {
      background: 'rgba(0,0,0,0.50)',
      color: theme.colors.dark.accentRed,
      border: '1px solid rgba(255,45,85,0.34)',
    },
    lowStock: {
      background: 'rgba(0,0,0,0.46)',
      color: 'rgba(255,255,255,0.92)',
      border: '1px solid rgba(255,255,255,0.14)',
    },
    overlayActions: {
      position: 'absolute' as const,
      right: 10,
      top: 54,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: theme.spacing.sm,
    },
    actionSquare: {
      width: 32,
      height: 32,
      borderRadius: 10,
      background: 'rgba(255,255,255,0.10)',
      border: '1px solid rgba(255,255,255,0.18)',
      ...blurStyle(theme.blur.glass),
      boxShadow: '0 16px 26px rgba(0,0,0,0.35)',
    },
    titleWrap: {
      position: 'absolute' as const,
      left: theme.spacing.md,
      right: 58,
      top: 52,
    },
  };

  return (
    <div
      style={{ ...styles.card, cursor: onClick ? 'pointer' : 'default' }}
      onClick={() => onClick?.(id)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {resolvedImage ? <img src={resolvedImage} alt="" style={styles.bgImage} loading="lazy" decoding="async" /> : null}
      <div style={styles.scrim} />
      {stock === 0 ? (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2, borderRadius: 'inherit', pointerEvents: 'none' }} />
      ) : null}
      <div style={styles.content}>
        {stock !== undefined && (
          <div 
            style={{
              ...styles.stockBadge,
              ...(stock === 0 ? styles.outOfStock : 
                  stock <= 5 ? styles.lowStock : styles.inStock)
            }}
          >
            {stock === 0 ? 'Нет в наличии' : 
             stock <= 5 ? `Осталось ${stock}` : 'В наличии'}
          </div>
        )}

        {isNew && (
          <div style={styles.newBadge}>
            <ChipBadge variant="new" size="sm">NEW</ChipBadge>
          </div>
        )}
        
        <div style={styles.overlayActions}>
          <IconButton
            icon={<Heart size={16} fill={isFavorite ? 'white' : 'none'} />}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(id);
            }}
            variant="glass"
            size="sm"
            style={styles.actionSquare}
          />
          <IconButton
            icon={<ShoppingCart size={16} />}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart?.(id);
            }}
            variant="glass"
            size="sm"
            style={styles.actionSquare}
          />
        </div>
        <div style={styles.titleWrap}>
          <h3 style={styles.title}>{name}</h3>
        </div>
        <div style={styles.pricePill}>
          <Coins size={16} />
          <span>{formatCurrency(price)}</span>
        </div>
      </div>
    </div>
  );
};
