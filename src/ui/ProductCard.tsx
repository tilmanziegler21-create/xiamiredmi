import React from 'react';
import { theme } from './theme';
import { ChipBadge } from './ChipBadge';
import WebApp from '@twa-dev/sdk';
import { Bell, ShoppingCart, Heart } from 'lucide-react';
import { blurStyle } from './blur';
import { CherryMascot } from './CherryMascot';
import { useToastStore } from '../store/useToastStore';
import { getBrandGradient, getBrandImageUrl } from '../lib/brandAssets';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
  category?: string;
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
  category = '',
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
  const toast = useToastStore();
  const token = brand || name;
  const resolvedImage = getBrandImageUrl(token, image);
  const resolvedGradient = getBrandGradient(token, theme.gradients.primary, theme.gradients.secondary);
  const [imageFailed, setImageFailed] = React.useState(false);
  React.useEffect(() => {
    setImageFailed(false);
  }, [resolvedImage]);

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

  const norm = (v: any) => String(v || '').trim().toLowerCase();
  const bgByCategory = () => {
    const c = norm(category);
    if (c === 'жидкости' || c === 'liquids') return 'radial-gradient(ellipse at 80% 50%, rgba(30,120,60,0.5), transparent 65%), #060e08';
    if (c === 'одноразки' || c === 'disposables') return 'radial-gradient(ellipse at 80% 50%, rgba(180,120,20,0.45), transparent 65%), #0d0a04';
    if (c === 'поды' || c === 'pods') return 'radial-gradient(ellipse at 80% 50%, rgba(50,80,200,0.4), transparent 65%), #05060f';
    if (c === 'картриджи' || c === 'cartridges') return 'radial-gradient(ellipse at 80% 50%, rgba(180,20,50,0.4), transparent 65%), #0d0406';
    return atmos;
  };
  const bg = bgByCategory();
  const mascotVariant: any =
    norm(category) === 'жидкости' || norm(category) === 'liquids'
      ? 'green'
      : norm(category) === 'одноразки' || norm(category) === 'disposables'
      ? 'gold'
      : norm(category) === 'поды' || norm(category) === 'pods'
      ? 'cosmic'
      : norm(category) === 'картриджи' || norm(category) === 'cartridges'
      ? 'pink'
      : variant;

  const currencySymbol = (import.meta.env?.VITE_CURRENCY_SYMBOL as string) || '€';
  const amount = Math.round(Number(price || 0)).toLocaleString();
  const cleanBrand = String(brand || '').trim();

  const styles = {
    card: {
      position: 'relative' as const,
      height: 230,
      borderRadius: 16,
      overflow: 'hidden',
      background: `${bg}, ${resolvedGradient}`,
      boxShadow: theme.shadow.card,
    },
    scrim: {
      position: 'absolute' as const,
      inset: 0,
      background: 'linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.04) 52%, rgba(0,0,0,0.86) 100%)',
      zIndex: 1,
      pointerEvents: 'none' as const,
    },
    content: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 2,
      padding: 0,
    },
    title: {
      position: 'absolute' as const,
      bottom: 50,
      left: 10,
      right: 10,
      color: '#fff',
      fontSize: 14,
      fontWeight: 800,
      textTransform: 'uppercase' as const,
      lineHeight: 1.05,
      letterSpacing: '0.08em',
      textShadow: '0 1px 6px rgba(0,0,0,1)',
      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical' as const,
      overflow: 'hidden',
      zIndex: 3,
    },
    pricePill: {
      position: 'absolute' as const,
      right: 10,
      top: 10,
      background: 'rgba(255,255,255,0.95)',
      color: '#0b0b0b',
      padding: '3px 10px',
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      boxShadow: '0 14px 26px rgba(0,0,0,0.38)',
      flex: '0 0 auto',
      zIndex: 3,
    },
    stockBadge: {
      position: 'absolute' as const,
      top: 10,
      left: 10,
      padding: '4px 6px',
      borderRadius: 6,
      fontSize: 8,
      fontWeight: 800,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      zIndex: 4,
    },
    inStock: {
      background: 'rgba(0,0,0,0.34)',
      color: 'rgba(255,255,255,0.86)',
      border: '1px solid rgba(255,255,255,0.12)',
    },
    topMeta: {
      position: 'absolute' as const,
      left: 10,
      right: 56,
      top: 34,
      zIndex: 4,
      pointerEvents: 'none' as const,
    },
    topBrand: {
      fontSize: 12,
      fontWeight: 800,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em',
      color: 'rgba(255,255,255,0.95)',
      textShadow: '0 1px 4px rgba(0,0,0,0.75)',
      display: '-webkit-box',
      WebkitLineClamp: 1,
      WebkitBoxOrient: 'vertical' as const,
      overflow: 'hidden',
    },
    outOfStock: {
      background: 'rgba(15,8,10,0.8)',
      color: '#c0193a',
      border: '1px solid rgba(192,25,58,0.4)',
    },
    lowStock: {
      background: 'rgba(0,0,0,0.34)',
      color: 'rgba(255,255,255,0.86)',
      border: '1px solid rgba(255,255,255,0.12)',
    },
    overlayActions: {
      position: 'absolute' as const,
      right: 10,
      bottom: 10,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 10,
      zIndex: 4,
    },
    actionSquare: {
      width: 32,
      height: 32,
      borderRadius: 10,
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      ...blurStyle('6px'),
      boxShadow: '0 16px 26px rgba(0,0,0,0.35)',
    },
    mascot: {
      position: 'absolute' as const,
      left: '50%',
      bottom: 40,
      transform: 'translateX(-50%)',
      height: '55%',
      opacity: 0.85,
      pointerEvents: 'none' as const,
      zIndex: 1,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      width: '100%',
    },
    bottle: {
      position: 'absolute' as const,
      inset: 0,
      height: '100%',
      width: '100%',
      objectFit: 'cover' as const,
      pointerEvents: 'none' as const,
      zIndex: 2,
      filter: 'none',
    },
  };

  return (
    <div
      style={{ ...styles.card, cursor: onClick ? 'pointer' : 'default' }}
      onClick={() => onClick?.(id)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div style={styles.scrim} />
      {stock === 0 ? (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2, borderRadius: 'inherit', pointerEvents: 'none' }} />
      ) : null}
      <div style={styles.content}>
        <div style={styles.mascot}>
          <div style={{ height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <CherryMascot variant={mascotVariant} size={140} />
          </div>
        </div>
        {resolvedImage && !imageFailed ? <img src={resolvedImage} alt="" style={styles.bottle} loading="lazy" decoding="async" onError={() => setImageFailed(true)} /> : null}

        {stock !== undefined ? (
          <div 
            style={{
              ...styles.stockBadge,
              ...(stock === 0 ? styles.outOfStock : 
                  stock <= 5 ? styles.lowStock : styles.inStock)
            }}
          >
            {stock === 0 ? 'нет в наличии' : stock <= 5 ? `осталось ${stock}` : 'в наличии'}
          </div>
        ) : null}
        {cleanBrand ? (
          <div style={styles.topMeta}>
            <div style={styles.topBrand}>{cleanBrand}</div>
          </div>
        ) : null}

        {isNew ? (
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 4 }}>
            <ChipBadge variant="new" size="sm">NEW</ChipBadge>
          </div>
        ) : null}
        
        <div style={styles.overlayActions}>
          <button
            style={{ ...styles.actionSquare, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(id);
            }}
          >
            <Heart size={13} color="rgba(255,255,255,0.55)" fill={isFavorite ? 'rgba(255,255,255,0.55)' : 'none'} />
          </button>
          {stock === 0 ? (
            <button
              style={{ ...styles.actionSquare, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  WebApp?.HapticFeedback?.notificationOccurred?.('success');
                } catch {
                }
                toast.push('Уведомим когда появится', 'success');
              }}
            >
              <Bell size={13} color="rgba(255,255,255,0.55)" />
            </button>
          ) : (
            <button
              style={{ ...styles.actionSquare, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart?.(id);
              }}
            >
              <ShoppingCart size={13} color="rgba(255,255,255,0.55)" />
            </button>
          )}
        </div>
        <h3 style={styles.title}>{name}</h3>
        <div style={styles.pricePill}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{amount}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.55)' }}>{currencySymbol}</span>
        </div>
      </div>
    </div>
  );
};
