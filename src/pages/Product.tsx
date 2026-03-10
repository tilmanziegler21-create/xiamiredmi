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
import { getBrandGradient, getBrandImageUrl } from '../lib/brandAssets';

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
  const posterImage = getBrandImageUrl(posterToken, product.image);
  const posterGradient = getBrandGradient(posterToken, theme.gradients.primary, theme.gradients.secondary);
  const volumeMatch = String(product.description || '').match(/(\d+\s?(?:мл|ml))/i);
  const nicotineMatch = String(product.description || '').match(/(\d+\s?(?:мг|mg))/i);
  const volume = volumeMatch ? volumeMatch[1] : '';
  const nicotine = nicotineMatch ? nicotineMatch[1] : '';
  const tpRaw: any = product.tasteProfile as any;
  const taste = tpRaw && typeof tpRaw === 'object'
    ? {
        sweetness: Math.max(0, Math.min(5, Number(tpRaw.sweetness || 0))),
        coolness: Math.max(0, Math.min(5, Number(tpRaw.coolness || 0))),
        fruitiness: Math.max(0, Math.min(5, Number(tpRaw.fruitiness || 0))),
        strength: Math.max(0, Math.min(5, Number(tpRaw.strength || 0))),
      }
    : null;
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
      inset: 0,
      height: '100%',
      width: '100%',
      objectFit: 'cover' as const,
      pointerEvents: 'none' as const,
      zIndex: 2,
      filter: 'none',
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
    tasteRow: {
      display: 'grid',
      gridTemplateColumns: '110px 1fr auto',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      color: theme.colors.dark.textSecondary,
      fontSize: theme.typography.fontSize.sm,
    },
  };

  return (
    <div style={{ paddingBottom: theme.spacing.xl }}>
      <div style={styles.poster}>
        {!posterImage ? (
          <div style={styles.posterMascot}>
            <CherryMascot variant="pink" size={180} />
          </div>
        ) : null}
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

        <SectionDivider title="Вкусовой профиль" />
        {taste ? (
          <div style={{ marginBottom: theme.spacing.md }}>
            {[
              ['Сладость', taste.sweetness],
              ['Холодок', taste.coolness],
              ['Фруктовость', taste.fruitiness],
              ['Крепость', taste.strength],
            ].map(([label, value]) => (
              <div key={String(label)} style={styles.tasteRow}>
                <div>{label}</div>
                <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.10)' }}>
                  <div style={{ height: '100%', width: `${Math.round((Number(value) / 5) * 100)}%`, background: theme.gradients.primary }} />
                </div>
                <div>{Number(value).toFixed(1)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginBottom: theme.spacing.md, color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
            Профиль вкуса пока не указан
          </div>
        )}

        <SectionDivider title="Отзывы" />
        <div style={{ marginBottom: theme.spacing.md, color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm }}>
          Отзывов пока нет
        </div>

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
        product={{ id: product.id, name: product.name, price: product.price, image: posterImage || product.image, brand: product.brand, category: product.category }}
        onClose={() => setAddOpen(false)}
        onConfirm={async ({ quantity, variant }) => {
          await addToCart(quantity, variant);
        }}
      />
    </div>
  );
};

export default Product;
