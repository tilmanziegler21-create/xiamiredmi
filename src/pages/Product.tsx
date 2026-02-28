import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { Heart } from 'lucide-react';
import { cartAPI, favoritesAPI, productAPI } from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { useAnalytics } from '../hooks/useAnalytics';
import { AddToCartModal, CherryMascot, GlassCard, IconButton, ProductCard, SectionDivider, theme } from '../ui';
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
  const volumeMatch = String(product.description || '').match(/(\d+\s?(?:мл|ml))/i);
  const nicotineMatch = String(product.description || '').match(/(\d+\s?(?:мг|mg))/i);
  const volume = volumeMatch ? volumeMatch[1] : '';
  const nicotine = nicotineMatch ? nicotineMatch[1] : '';
  const statusText = product.qtyAvailable === 0 ? 'нет в наличии' : product.qtyAvailable <= 5 ? `осталось ${product.qtyAvailable}` : 'в наличии';

  const styles = {
    poster: {
      position: 'relative' as const,
      height: 300,
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.14)',
      background: posterGradient,
      boxShadow: theme.shadow.card,
      overflow: 'hidden',
      margin: `0 ${theme.padding.screen}`,
    },
    posterScrim: {
      position: 'absolute' as const,
      inset: 0,
      background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.06) 55%, rgba(0,0,0,0.84) 100%)',
      pointerEvents: 'none' as const,
    },
    posterMascot: {
      position: 'absolute' as const,
      left: '50%',
      bottom: 18,
      transform: 'translateX(-50%)',
      opacity: 0.85,
      pointerEvents: 'none' as const,
      zIndex: 1,
    },
    posterBottle: {
      position: 'absolute' as const,
      left: '50%',
      bottom: 10,
      transform: 'translateX(-50%)',
      height: '80%',
      width: '100%',
      objectFit: 'contain' as const,
      pointerEvents: 'none' as const,
      zIndex: 2,
      filter: 'drop-shadow(0 20px 34px rgba(0,0,0,0.55))',
    },
    card: {
      margin: `${theme.spacing.md} ${theme.padding.screen}`,
    },
    title: {
      fontSize: 28,
      fontWeight: 800,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.12em',
      lineHeight: 1.05,
      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
    },
    pricePill: {
      background: 'rgba(255,255,255,0.92)',
      color: '#000',
      borderRadius: 12,
      padding: '10px 14px',
      fontWeight: theme.typography.fontWeight.bold,
      boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
      whiteSpace: 'nowrap' as const,
      fontSize: 18,
    },
    status: {
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 8,
      padding: '6px 10px',
      border: product.qtyAvailable === 0 ? '1px solid rgba(192,25,58,0.4)' : '1px solid rgba(255,255,255,0.12)',
      background: product.qtyAvailable === 0 ? 'rgba(15,8,10,0.8)' : 'rgba(0,0,0,0.34)',
      color: product.qtyAvailable === 0 ? '#c0193a' : 'rgba(255,255,255,0.86)',
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
    },
    description: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.dark.textSecondary,
      lineHeight: '1.5',
      marginBottom: theme.spacing.md,
    },
    metaGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    metaCard: {
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(0,0,0,0.18)',
      padding: theme.spacing.md,
    },
    metaLabel: {
      fontSize: 11,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.65)',
      marginBottom: 6,
    },
    metaValue: {
      fontSize: theme.typography.fontSize.base,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.92)',
      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
    },
    ctaRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 52px',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    favSquare: {
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.06)',
      width: 52,
      height: 52,
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
      <div style={styles.poster}>
        <div style={styles.posterMascot}>
          <CherryMascot variant="pink" size={180} />
        </div>
        {posterImage ? <img src={posterImage} alt="" style={styles.posterBottle} /> : null}
        <div style={styles.posterScrim} />
      </div>

      <GlassCard padding="lg" variant="elevated" style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.title}>{product.name}</div>
            <div style={{ marginTop: theme.spacing.sm, display: 'flex', gap: theme.spacing.sm, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <div style={styles.status}>{statusText}</div>
              <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {product.brand}
              </div>
            </div>
          </div>
          <div style={styles.pricePill}>{formatCurrency(product.price)}</div>
        </div>

        <div style={styles.metaGrid}>
          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Объём</div>
            <div style={styles.metaValue}>{volume || '—'}</div>
          </div>
          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Никотин</div>
            <div style={styles.metaValue}>{nicotine || '—'}</div>
          </div>
          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Производитель</div>
            <div style={styles.metaValue}>{product.brand || '—'}</div>
          </div>
          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Категория</div>
            <div style={styles.metaValue}>{product.category || '—'}</div>
          </div>
        </div>

        <div style={styles.description}>{product.description}</div>

        <div style={styles.ctaRow}>
          <button
            onClick={() => setAddOpen(true)}
            style={{
              width: '100%',
              borderRadius: 12,
              border: 'none',
              background: 'var(--cherry)',
              color: '#fff',
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '16px 16px',
              cursor: product.qtyAvailable === 0 ? 'not-allowed' : 'pointer',
              opacity: product.qtyAvailable === 0 ? 0.55 : 1,
            }}
            disabled={product.qtyAvailable === 0}
          >
            В корзину
          </button>
          <IconButton
            icon={<Heart size={18} fill={product.favorite ? 'rgba(255,255,255,0.70)' : 'none'} color="rgba(255,255,255,0.70)" />}
            onClick={toggleFavorite}
            variant="glass"
            size="md"
            style={styles.favSquare}
          />
        </div>

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
