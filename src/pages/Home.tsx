import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { theme, GlassCard, PrimaryButton, SecondaryButton, ChipBadge, ProductCard, CarouselDots, SectionDivider, AddToCartModal } from '../ui';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { cartAPI, catalogAPI } from '../services/api';
import { ChevronRight, Grid, Gift, Star, Search, ShoppingCart, History, Info } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';
import { formatCurrency } from '../lib/currency';
import { useCityStore } from '../store/useCityStore';
import { useFavoritesStore } from '../store/useFavoritesStore';
import { useConfigStore } from '../store/useConfigStore';

interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  image: string;
  isNew?: boolean;
  discount?: number;
  qtyAvailable?: number;
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { setCart } = useCartStore();
  const { user } = useAuthStore();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addProduct, setAddProduct] = useState<Product | null>(null);
  const { city } = useCityStore();
  const favorites = useFavoritesStore();
  const { config } = useConfigStore();
  const [tab, setTab] = useState<string>('Все');
  const bannerTouch = React.useRef<{ x: number; t: number } | null>(null);

  const ultraLite = (() => {
    try {
      const el = document.documentElement;
      return el.classList.contains('tg-webview') && el.classList.contains('tg-ios');
    } catch {
      return false;
    }
  })();

  const banners = (config?.banners || []).map((b) => ({
    title: b.title || '',
    subtitle: b.subtitle || '',
    gradient: b.gradient || theme.gradients.primary,
    image: b.imageUrl,
    linkType: b.linkType || '',
    linkTarget: b.linkTarget || '',
  }));

  const categories = (config?.categoryTiles || []).map((t) => ({
    slug: t.slug,
    name: t.title,
    image: t.imageUrl,
    badgeText: t.badgeText || '',
  }));

  const tabs = useMemo(() => {
    const base = ['Все', 'Новинки', 'Скидки', 'Жидкости', 'Одноразки', 'Поды', 'Картриджи'];
    const fromConfig = (config?.categoryTiles || [])
      .map((t) => String(t.slug || '').trim())
      .filter(Boolean);
    const merged = Array.from(new Set([...base, ...fromConfig]));
    return merged.slice(0, 10);
  }, [config?.categoryTiles]);

  const qtyDiscount = config?.quantityDiscount;
  const qtyDiscountMin = Number(qtyDiscount?.minQty || 3);
  const qtyDiscountPrice = Number(qtyDiscount?.unitPrice || 40);

  useEffect(() => {
    if (ultraLite) return;
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (banners.length ? (prev + 1) % banners.length : 0));
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length, ultraLite]);

  const onBannerClick = () => {
    const b = banners[currentBanner];
    if (!b) return;
    const type = String(b.linkType || '');
    const target = String(b.linkTarget || '');
    if (type === 'category') {
      navigate(`/catalog?category=${encodeURIComponent(target)}`);
      return;
    }
    if (type === 'product') {
      navigate(`/product/${encodeURIComponent(target)}`);
      return;
    }
    if (type === 'url' && target) {
      try {
        if (WebApp.openTelegramLink && target.startsWith('https://t.me/')) {
          WebApp.openTelegramLink(target);
          return;
        }
      } catch (e) {
        console.error('Banner open link failed:', e);
      }
      window.open(target, '_blank');
    }
  };

  useEffect(() => {
    loadProducts();
    if (city) favorites.load(city);
  }, [city]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      if (!city) {
        setLoadError('Выберите город');
        setAllProducts([]);
        return;
      }
      const response = await catalogAPI.getProducts({ city });
      const list: Product[] = (response.data.products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        brand: p.brand,
        price: p.price,
        image: p.image || '',
        isNew: Boolean(p.isNew),
        discount: Number(p.discount || 0),
        qtyAvailable: Number(p.qtyAvailable || 0),
      }));
      setAllProducts(list);
    } catch (error) {
      console.error('Failed to load products:', error);
      const status = (error as any)?.response?.status;
      if (status === 503) {
        const missing = (error as any)?.response?.data?.missing || [];
        setLoadError(`Sheets не настроен. Добавь env: ${missing.join(', ')}`);
      } else {
        setLoadError('Не удалось загрузить каталог');
      }
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const norm = (v: any) => String(v || '').trim().toLowerCase();
    const t = norm(tab);
    if (t === 'все' || !t) return allProducts;
    if (t === 'новинки') return allProducts.filter((p) => Boolean(p.isNew));
    if (t === 'скидки') return allProducts.filter((p) => Number(p.discount || 0) > 0);
    const alias: Record<string, string> = {
      'жидкости': 'liquids',
      'одноразки': 'disposables',
      'поды': 'pods',
      'картриджи': 'cartridges',
    };
    const mapped = alias[t] || tab;
    return allProducts.filter((p) => norm(p.category) === norm(mapped));
  }, [allProducts, tab]);

  const featured = useMemo(() => {
    return filteredProducts.slice(0, 6);
  }, [filteredProducts]);

  const styles = {
    container: {
      minHeight: '100vh',
      color: theme.colors.dark.text,
      fontFamily: theme.typography.fontFamily,
    },
    hero: {
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.lg,
    },
    heroTop: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    heroBrand: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 6,
    },
    heroEyebrow: {
      fontSize: theme.typography.fontSize.xs,
      letterSpacing: '0.18em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.70)',
    },
    heroTitle: {
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      lineHeight: 1.05,
    },
    heroSubtitle: {
      fontSize: theme.typography.fontSize.sm,
      color: 'rgba(255,255,255,0.72)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
      lineHeight: 1.35,
    },
    heroCta: {
      display: 'flex',
      gap: theme.spacing.sm,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    banner: {
      height: 240,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      position: 'relative' as const,
      boxShadow: theme.shadow.card,
      border: '1px solid rgba(255,255,255,0.14)',
      cursor: 'pointer',
      touchAction: 'manipulation' as const,
    },
    bannerContent: {
      position: 'absolute' as const,
      bottom: 40,
      left: theme.spacing.lg,
      right: theme.spacing.lg,
      zIndex: 2,
    },
    bannerTitle: {
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      marginBottom: theme.spacing.xs,
      textShadow: '0 10px 30px rgba(0,0,0,0.55)',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
    },
    bannerSubtitle: {
      fontSize: theme.typography.fontSize.sm,
      opacity: 0.9,
      textShadow: '0 6px 18px rgba(0,0,0,0.55)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
    },
    tabsRow: {
      display: 'flex',
      gap: 10,
      overflowX: 'auto' as const,
      padding: '2px 2px 0 2px',
      marginTop: theme.spacing.md,
      WebkitOverflowScrolling: 'touch' as const,
    },
    tabPill: (active: boolean) => ({
      flex: '0 0 auto',
      borderRadius: 999,
      padding: '10px 12px',
      border: active ? '1px solid rgba(255,45,85,0.55)' : '1px solid rgba(255,255,255,0.14)',
      background: active ? 'rgba(255,45,85,0.16)' : 'rgba(255,255,255,0.06)',
      color: active ? theme.colors.dark.primary : 'rgba(255,255,255,0.86)',
      fontSize: theme.typography.fontSize.xs,
      letterSpacing: '0.10em',
      textTransform: 'uppercase' as const,
      cursor: 'pointer',
      userSelect: 'none' as const,
    }),
    quickActionsGrid: {
      padding: `0 ${theme.padding.screen}`,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    quickActionButton: {
      height: 100,
      borderRadius: theme.radius.lg,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      background: 'linear-gradient(135deg, rgba(255,45,85,0.16) 0%, rgba(176,0,58,0.10) 100%)',
      border: '1px solid rgba(255,45,85,0.24)',
      color: theme.colors.dark.text,
      textDecoration: 'none',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      touchAction: 'manipulation' as const,
    },
    quickActionIcon: {
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickActionText: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      textAlign: 'center' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
    },
    searchSection: {
      padding: `0 ${theme.padding.screen}`,
      marginBottom: theme.spacing.lg,
    },
    searchButton: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      color: theme.colors.dark.textSecondary,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      touchAction: 'manipulation' as const,
    },
    categoryGrid: {
      padding: `0 ${theme.padding.screen}`,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },
    categoryCard: {
      height: 160,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      position: 'relative' as const,
      boxShadow: theme.shadow.card,
      border: '1px solid rgba(255,255,255,0.14)',
      cursor: 'pointer',
      touchAction: 'manipulation' as const,
    },
    categoryTitle: {
      position: 'absolute' as const,
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.14em',
      textShadow: '0 10px 30px rgba(0,0,0,0.55)',
    },
    productGrid: {
      padding: `0 ${theme.padding.screen}`,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },
    skeleton: {
      background: 'rgba(255,255,255,0.08)',
      borderRadius: theme.radius.lg,
      height: 280,
      animation: 'pulse 1.5s ease-in-out infinite',
      border: '1px solid rgba(255,255,255,0.10)',
    },
    orderHistoryButton: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: theme.colors.dark.text,
      cursor: 'pointer',
      margin: `0 ${theme.padding.screen} ${theme.spacing.lg}`,
      transition: 'all 0.2s ease',
      touchAction: 'manipulation' as const,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <div style={styles.heroTop}>
          <div style={styles.heroBrand}>
            <div style={styles.heroEyebrow}>{city ? `город ${city}` : 'выберите город'}</div>
            <div style={styles.heroTitle}>ELFCHERRY</div>
            <div style={styles.heroSubtitle}>
              {user?.firstName ? `${user.firstName}, добро пожаловать` : 'mini app 24/7'}
            </div>
          </div>
          <div style={styles.heroCta}>
            <SecondaryButton
              onClick={() => navigate('/catalog')}
              style={{ borderRadius: 999, padding: '10px 12px' }}
            >
              <Search size={18} />
            </SecondaryButton>
            <SecondaryButton
              onClick={() => navigate('/cart')}
              style={{ borderRadius: 999, padding: '10px 12px' }}
            >
              <ShoppingCart size={18} />
            </SecondaryButton>
          </div>
        </div>

        {banners.length ? (
          <div
            className="home-banner"
            style={{
              ...styles.banner,
              background: banners[currentBanner].gradient,
              cursor: 'pointer',
            }}
            onClick={onBannerClick}
            role="button"
            onPointerDown={(e) => {
              if (ultraLite) return;
              bannerTouch.current = { x: e.clientX, t: Date.now() };
            }}
            onPointerUp={(e) => {
              if (ultraLite) return;
              const start = bannerTouch.current;
              bannerTouch.current = null;
              if (!start) return;
              const dx = e.clientX - start.x;
              const dt = Date.now() - start.t;
              if (Math.abs(dx) < 44 || dt > 900) return;
              if (dx < 0) setCurrentBanner((p) => (banners.length ? (p + 1) % banners.length : 0));
              if (dx > 0) setCurrentBanner((p) => (banners.length ? (p - 1 + banners.length) % banners.length : 0));
            }}
          >
            {!ultraLite && banners[currentBanner].image ? (
              <img
                className="home-banner-media"
                src={banners[currentBanner].image}
                alt=""
                loading="lazy"
                decoding="async"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : null}
            <div className="home-banner-overlay" />
            <div className="home-banner-shine" />
            <div style={styles.bannerContent}>
              <h2 style={styles.bannerTitle}>{banners[currentBanner].title}</h2>
              <p style={styles.bannerSubtitle}>{banners[currentBanner].subtitle}</p>
            </div>
            <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0 }}>
              <CarouselDots total={banners.length} current={currentBanner} onDotClick={setCurrentBanner} />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: theme.spacing.lg }}>
            <GlassCard padding="lg" variant="elevated">
              <div style={{ height: 180 }} className="animate-pulse" />
            </GlassCard>
          </div>
        )}

        <div style={styles.tabsRow}>
          {tabs.map((t) => (
            <div key={t} style={styles.tabPill(String(tab) === String(t))} role="button" onClick={() => setTab(t)}>
              {t}
            </div>
          ))}
        </div>
      </div>

      <SectionDivider title="Быстрые действия" />

      {/* Quick Action Buttons */}
      <div style={styles.quickActionsGrid}>
        <div
          style={styles.quickActionButton}
          onClick={() => navigate('/catalog')}
          role="button"
        >
          <div style={styles.quickActionIcon}>
            <Grid size={24} color={theme.colors.dark.primary} />
          </div>
          <div style={styles.quickActionText}>Каталог</div>
        </div>
        <div
          style={styles.quickActionButton}
          onClick={() => navigate('/promotions')}
          role="button"
        >
          <div style={styles.quickActionIcon}>
            <Gift size={24} color={theme.colors.dark.primary} />
          </div>
          <div style={styles.quickActionText}>Акции</div>
        </div>
        <div
          style={styles.quickActionButton}
          onClick={() => navigate('/cart')}
          role="button"
        >
          <div style={styles.quickActionIcon}>
            <ShoppingCart size={24} color={theme.colors.dark.primary} />
          </div>
          <div style={styles.quickActionText}>Корзина</div>
        </div>
        <div
          style={styles.quickActionButton}
          onClick={() => navigate('/bonuses')}
          role="button"
        >
          <div style={styles.quickActionIcon}>
            <Star size={24} color={theme.colors.dark.primary} />
          </div>
          <div style={styles.quickActionText}>Бонусы</div>
        </div>
      </div>

      {/* Search Section */}
      <div style={styles.searchSection}>
        <div
          style={styles.searchButton}
          onClick={() => navigate('/catalog')}
          role="button"
        >
          <Search size={18} color={theme.colors.dark.textSecondary} />
          <span>Поиск товаров...</span>
        </div>
      </div>

      {/* Order History Button */}
      <div
        style={styles.orderHistoryButton}
        onClick={() => navigate('/orders')}
        role="button"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <History size={20} color={theme.colors.dark.textSecondary} />
          <span>История заказов</span>
        </div>
        <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.dark.textSecondary }}>
          Повторить заказ
        </span>
      </div>

      <div style={styles.categoryGrid}>
        {categories.length === 0 ? (
          [...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.categoryCard,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))
        ) : (
          categories.map((category) => (
            <div
              key={category.name}
              style={{
                ...styles.categoryCard,
                background: 'linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.7) 100%)',
              }}
              onClick={() => navigate(`/catalog?category=${encodeURIComponent(category.slug)}`)}
              role="button"
            >
              {!ultraLite && category.image ? (
                <img
                  src={category.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : null}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.7) 100%)', pointerEvents: 'none' }} />
              {category.badgeText ? (
                <div style={{ position: 'absolute', top: theme.spacing.md, right: theme.spacing.md }}>
                  <ChipBadge variant="new" size="sm">{category.badgeText}</ChipBadge>
                </div>
              ) : null}
              <div style={styles.categoryTitle}>{category.name}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: `0 ${theme.padding.screen}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: theme.typography.fontSize.xs, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
            Подборка
          </div>
          <div style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {tab === 'Все' ? 'Все товары' : tab}
          </div>
        </div>
        <div
          role="button"
          onClick={() => {
            if (tab === 'Все') return navigate('/catalog');
            if (tab === 'Скидки') return navigate('/catalog');
            return navigate(`/catalog?category=${encodeURIComponent(tab)}`);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'rgba(255,255,255,0.80)',
            fontSize: theme.typography.fontSize.xs,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            padding: '10px 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
          }}
        >
          Смотреть все <ChevronRight size={16} />
        </div>
      </div>

      {loadError ? (
        <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.lg }}>
          <GlassCard padding="lg" variant="elevated">
            <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, lineHeight: '1.4' }}>{loadError}</div>
          </GlassCard>
        </div>
      ) : null}

      {loading ? (
        <div style={styles.productGrid}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={styles.skeleton} />
          ))}
        </div>
      ) : (
        <div style={styles.productGrid}>
          {featured.map((product) => (
            <ProductCard
              key={product.id}
              {...product}
              onClick={(id) => navigate(`/product/${id}`)}
              onAddToCart={() => {
                setAddProduct(product);
                setAddOpen(true);
              }}
                isFavorite={favorites.isFavorite(product.id)}
                onToggleFavorite={async () => {
                  if (!city) {
                    toast.push('Выберите город', 'error');
                    return;
                  }
                  const enabled = !favorites.isFavorite(product.id);
                  try {
                    await favorites.toggle({
                      city,
                      product: {
                        id: product.id,
                        name: product.name,
                        category: product.category,
                        brand: product.brand,
                        price: product.price,
                        image: product.image,
                      },
                      enabled,
                    });
                    toast.push(enabled ? 'Добавлено в избранное' : 'Удалено из избранного', 'success');
                  } catch {
                    toast.push('Ошибка избранного', 'error');
                  }
                }}
            />
          ))}
          <GlassCard
            padding="lg"
            variant="elevated"
            style={{
              height: 280,
              borderRadius: theme.radius.lg,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'linear-gradient(135deg, rgba(255,45,85,0.22) 0%, rgba(176,0,58,0.14) 100%)',
              border: '1px solid rgba(255,255,255,0.14)',
            }}
          >
            <div style={{ marginBottom: theme.spacing.sm, opacity: 0.9 }}>
              <Info size={36} />
            </div>
            <div style={{ textAlign: 'center', fontSize: theme.typography.fontSize.sm, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.9, marginBottom: theme.spacing.md }}>
              При покупке {qtyDiscountMin}+ шт. цена за 1 шт. составит
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.92)',
              color: '#000',
              borderRadius: 999,
              padding: '8px 14px',
              fontWeight: theme.typography.fontWeight.bold,
              boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
            }}>
              {formatCurrency(qtyDiscountPrice)}
            </div>
          </GlassCard>
        </div>
      )}

      <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.xl }}>
        <PrimaryButton fullWidth onClick={() => navigate('/referral')}>
          Пригласить друга
        </PrimaryButton>
      </div>

      <AddToCartModal
        open={addOpen}
        product={addProduct ? { id: addProduct.id, name: addProduct.name, price: addProduct.price, image: addProduct.image } : null}
        onClose={() => setAddOpen(false)}
        onConfirm={async ({ quantity, variant }) => {
          if (!addProduct) return;
          if (!city) {
            toast.push('Выберите город', 'error');
            return;
          }
          try {
            await cartAPI.addItem({ productId: addProduct.id, quantity, city, price: addProduct.price, variant });
            const resp = await cartAPI.getCart(city);
            setCart(resp.data.cart);
            toast.push('Товар добавлен в корзину', 'success');
          } catch {
            toast.push('Ошибка добавления в корзину', 'error');
          }
        }}
      />
    </div>
  );
};

export default Home;
