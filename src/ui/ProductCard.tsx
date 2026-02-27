import React from 'react';
import { theme } from './theme';
import { IconButton } from './IconButton';
import { ChipBadge } from './ChipBadge';
import { ShoppingCart, Heart } from 'lucide-react';
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
    if (k.compact.includes('elfliq')) return 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)';
    if (k.compact.includes('elfic')) return 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)';
    if (k.compact.includes('elflic')) return 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)';
    if (k.compact.includes('elfbar') || k.cleaned.includes('elf bar')) return 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)';
    if (k.compact.includes('geekvape') || k.cleaned.includes('geek vape')) return 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)';
    if (k.compact.includes('vaporesso')) return 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)';
    return 'linear-gradient(135deg, #333 0%, #666 100%)';
  };

  const token = brand || name;
  const resolvedImage = getBrandImage(token, image);
  const resolvedGradient = getBrandGradient(token);

  const styles = {
    card: {
      position: 'relative' as const,
      height: '220px',
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      background: resolvedGradient,
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
    },
    scrim: {
      position: 'absolute' as const,
      inset: 0,
      background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 60%)',
      zIndex: 1,
      pointerEvents: 'none' as const,
    },
    content: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 2,
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'flex-end',
      padding: theme.spacing.md,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.sm,
    },
    title: {
      color: theme.colors.dark.text,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      lineHeight: '1.15',
      letterSpacing: '0.06em',
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
      whiteSpace: 'nowrap' as const,
    },
    pricePill: {
      background: '#ffffff',
      color: '#0b0b0b',
      padding: '4px 12px',
      borderRadius: 999,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
    actions: {
      display: 'flex',
      gap: theme.spacing.sm,
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
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
    },
    inStock: {
      background: '#ffffff',
      color: '#0b0b0b',
    },
    outOfStock: {
      background: theme.colors.dark.accentRed,
      color: '#ffffff',
    },
    lowStock: {
      background: '#ffffff',
      color: '#0b0b0b',
    },
    overlayActions: {
      position: 'absolute' as const,
      right: theme.spacing.md,
      top: theme.spacing.md,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: theme.spacing.sm,
    },
    roundAction: {
      background: 'rgba(255,255,255,0.15)',
      border: '1px solid rgba(255,255,255,0.10)',
      ...blurStyle(theme.blur.glass),
    },
    bottomRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
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
        {/* Stock Status Badge */}
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

        {/* New Badge */}
        {isNew && (
          <div style={styles.newBadge}>
            <ChipBadge variant="new" size="sm">NEW</ChipBadge>
          </div>
        )}
        
        <div style={styles.overlayActions}>
          <IconButton
            icon={<Heart size={18} fill={isFavorite ? 'white' : 'none'} />}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(id);
            }}
            variant="glass"
            size="sm"
            style={styles.roundAction}
          />
          <IconButton
            icon={<ShoppingCart size={18} />}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart?.(id);
            }}
            variant="glass"
            size="sm"
            style={styles.roundAction}
          />
        </div>

        <div style={styles.bottomRow}>
          <div style={styles.pricePill}>
            <span>{formatCurrency(price)}</span>
          </div>
          <h3 style={styles.title}>{name}</h3>
        </div>
      </div>
    </div>
  );
};
