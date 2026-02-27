import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { Heart } from 'lucide-react';
import { cartAPI, favoritesAPI, productAPI } from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { useAnalytics } from '../hooks/useAnalytics';
import { AddToCartModal, GlassCard, IconButton, ProductCard, SectionDivider, theme } from '../ui';
import { useToastStore } from '../store/useToastStore';
import { formatCurrency } from '../lib/currency';
import { useCityStore } from '../store/useCityStore';
import { useFavoritesStore } from '../store/useFavoritesStore';

type ProductEntity = {
  id: string;
  sku?: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  qtyAvailable: number;
  description: string;
  image: string;
  tasteProfile?: unknown;
  favorite?: boolean;
};

type SimilarProduct = {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  image: string;
  sku?: string;
};

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

const Product: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToastStore();
  const { setCart } = useCartStore();
  const { trackProductView, trackAddToCart } = useAnalytics();
  const [product, setProduct] = React.useState<ProductEntity | null>(null);
  const [similar, setSimilar] = React.useState<SimilarProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { city } = useCityStore();
  const [addOpen, setAddOpen] = React.useState(false);
  const favorites = useFavoritesStore();

  const load = async () => {
    try {
      setLoading(true);
      if (!city) {
        toast.push('Выберите город', 'error');
        return;
      }
      const resp = await productAPI.getById(String(id || ''), city);
      const p: ProductEntity = resp.data.product;
      setProduct(p);
      setSimilar(resp.data.similar || []);
      trackProductView(p.id, p.name, p.category);
    } catch (e) {
      console.error('Failed to load product:', e);
      try {
        WebApp.showAlert('Ошибка загрузки товара');
      } catch {
        toast.push('Ошибка загрузки товара', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, [id, city]);

  const toggleFavorite = async () => {
    if (!product) return;
    const next = !Boolean(product.favorite);
    try {
      if (!city) {
        toast.push('Выберите город', 'error');
        return;
      }
      await favorites.toggle({
        city,
        product: {
          id: String(product.id),
          name: product.name,
          category: product.category,
          brand: product.brand,
          price: product.price,
          image: product.image,
        },
        enabled: next,
      });
      setProduct({ ...product, favorite: next });
      toast.push(next ? 'Добавлено в избранное' : 'Удалено из избранного', 'success');
    } catch {
      toast.push('Ошибка избранного', 'error');
    }
  };

  const addToCart = async (quantity: number, variant?: string) => {
    if (!product) return;
    if (!city) {
      toast.push('Выберите город', 'error');
      return;
    }
    try {
      await cartAPI.addItem({ productId: product.id, quantity, city, variant });
      const cartResp = await cartAPI.getCart(city);
      setCart(cartResp.data.cart);
      trackAddToCart(product.id, product.name, product.price, quantity);
      toast.push('Товар добавлен в корзину', 'success');
    } catch (e) {
      console.error('Add to cart failed:', e);
      toast.push('Ошибка добавления в корзину', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: theme.padding.screen }}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ height: 220 }} className="animate-pulse" />
        </GlassCard>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ padding: theme.padding.screen }}>
        <GlassCard padding="lg" variant="elevated">
          <div style={{ textAlign: 'center', color: theme.colors.dark.textSecondary }}>Товар не найден</div>
        </GlassCard>
      </div>
    );
  }

  const posterToken = product.brand || product.name;
  const posterImage = getBrandImage(posterToken, product.image);
  const posterGradient = getBrandGradient(posterToken);

  const styles = {
    pageTitle: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.md,
    },
    poster: {
      position: 'relative' as const,
      height: 220,
      borderRadius: theme.radius.lg,
      border: '1px solid rgba(255,255,255,0.14)',
      background: posterGradient,
      boxShadow: theme.shadow.card,
      overflow: 'hidden',
      margin: `0 ${theme.padding.screen}`,
    },
    posterImg: {
      position: 'absolute' as const,
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
      pointerEvents: 'none' as const,
    },
    posterScrim: {
      position: 'absolute' as const,
      inset: 0,
      background: 'linear-gradient(135deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.65) 100%)',
      pointerEvents: 'none' as const,
    },
    card: {
      margin: theme.spacing.md,
    },
    headerRow: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      alignItems: 'flex-start',
      marginBottom: theme.spacing.md,
    },
    title: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
      lineHeight: 1.15,
    },
    pricePill: {
      background: 'rgba(255,255,255,0.92)',
      color: '#000',
      borderRadius: 999,
      padding: '6px 12px',
      fontWeight: theme.typography.fontWeight.bold,
      boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
      whiteSpace: 'nowrap' as const,
    },
    description: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.dark.textSecondary,
      lineHeight: '1.5',
      marginBottom: theme.spacing.md,
    },
    tasteProfileSection: {
      marginBottom: theme.spacing.md,
    },
    trustSection: {
      marginBottom: theme.spacing.md,
    },
    flavorRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.06)',
      padding: '8px 12px',
      marginBottom: theme.spacing.md,
    },
    flavorPill: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      color: theme.colors.dark.text,
      fontSize: theme.typography.fontSize.sm,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    selectedPill: {
      borderRadius: 999,
      padding: '6px 12px',
      background: 'rgba(0,255,136,0.18)',
      border: '1px solid rgba(0,255,136,0.25)',
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
    },
    goldButton: {
      width: '100%',
      borderRadius: theme.radius.md,
      border: 'none',
      background: 'linear-gradient(180deg, rgba(255,214,10,0.90) 0%, rgba(245,158,11,0.92) 100%)',
      color: '#1b1405',
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.10em',
      textTransform: 'uppercase' as const,
      padding: '14px 16px',
      cursor: 'pointer',
      boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
      marginBottom: theme.spacing.sm,
    },
    disabledCta: {
      width: '100%',
      borderRadius: theme.radius.md,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.10)',
      color: 'rgba(255,255,255,0.55)',
      fontWeight: theme.typography.fontWeight.semibold,
      padding: '14px 16px',
      cursor: 'not-allowed',
      textTransform: 'none' as const,
    },
    flavorsWrap: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    chip: (active: boolean) => ({
      borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.14)',
      background: active ? 'rgba(0,255,136,0.18)' : 'rgba(255,255,255,0.06)',
      color: theme.colors.dark.text,
      padding: '8px 12px',
      cursor: 'pointer',
      fontSize: theme.typography.fontSize.sm,
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    }),
    reviewsSection: {
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.md,
      borderTop: '1px solid rgba(255,255,255,0.1)',
    },
    reviewItem: {
      marginBottom: theme.spacing.sm,
      padding: theme.spacing.sm,
      background: 'rgba(255,255,255,0.03)',
      borderRadius: theme.radius.sm,
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.dark.textSecondary,
    },
    similarProductsGrid: {
      padding: `0 ${theme.padding.screen}`,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
    },
  };

  return (
    <div style={{ paddingBottom: theme.spacing.xl }}>
      <div style={styles.pageTitle}>
        <div style={{ width: 40 }} />
        <div style={{ opacity: 0.7, fontSize: theme.typography.fontSize.sm, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Товар</div>
        <IconButton icon={<Heart size={20} fill={product.favorite ? 'white' : 'none'} />} onClick={toggleFavorite} variant="glass" size="md" />
      </div>

      <SectionDivider title={product.name} />

      <div style={styles.poster}>
        {posterImage ? <img src={posterImage} alt="" style={styles.posterImg} /> : null}
        <div style={styles.posterScrim} />
      </div>

      <GlassCard padding="lg" variant="elevated" style={styles.card}>
        <div style={styles.headerRow}>
          <div style={{ flex: 1 }}>
            <div style={styles.title}>{product.name}</div>
            <div style={{ color: theme.colors.dark.textSecondary, marginTop: theme.spacing.xs, fontSize: theme.typography.fontSize.sm }}>
              {product.brand}
            </div>
          </div>
          <div style={styles.pricePill}>{formatCurrency(product.price)}</div>
        </div>

        {/* Description */}
        <div style={styles.description}>
          {product.description}
        </div>

        <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, marginBottom: theme.spacing.md }}>
          Будьте первым, кто оставит отзыв
        </div>

        <button style={styles.goldButton} onClick={() => setAddOpen(true)}>
          Добавить в корзину
        </button>

        <button style={styles.disabledCta} disabled>
          В наличии: {product.qtyAvailable}
        </button>

      </GlassCard>

      {similar.length ? (
        <>
          <SectionDivider title="Похожие товары" />
          <div style={styles.similarProductsGrid}>
            {similar.slice(0, 6).map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                name={p.name}
                price={p.price}
                image={p.image}
                brand={p.brand} // Add brand prop
                onClick={(pid) => navigate(`/product/${pid}`)}
                onAddToCart={(pid) => navigate(`/product/${pid}`)}
              />
            ))}
          </div>
        </>
      ) : null}

      <AddToCartModal
        open={addOpen}
        product={{ id: product.id, name: product.name, price: product.price, image: product.image }}
        onClose={() => setAddOpen(false)}
        onConfirm={async ({ quantity, variant }) => {
          await addToCart(quantity, variant);
        }}
      />
    </div>
  );
};

export default Product;
