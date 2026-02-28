import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { theme, GlassCard, ChipBadge, ProductCard, CarouselDots, SectionDivider, AddToCartModal, CherryMascot } from '../ui';
import { useCartStore } from '../store/useCartStore';
import { cartAPI, catalogAPI } from '../services/api';
import { Search } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';
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

  const tabs = useMemo(() => (['Все', 'Новинки', 'Скидки', 'Жидкости']), []);

  const categoryAtmos = useMemo(() => {
    return {
      'Жидкости': {
        bg: 'radial-gradient(120% 90% at 20% 18%, rgba(52,211,153,0.35) 0%, rgba(0,0,0,0) 58%), radial-gradient(110% 90% at 78% 26%, rgba(16,185,129,0.22) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
        mascot: 'green' as const,
      },
      'Одноразки': {
        bg: 'radial-gradient(120% 90% at 18% 18%, rgba(251,191,36,0.34) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(245,158,11,0.22) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
        mascot: 'gold' as const,
      },
      'Поды': {
        bg: 'radial-gradient(120% 90% at 18% 18%, rgba(96,165,250,0.28) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(139,92,246,0.26) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
        mascot: 'cosmic' as const,
      },
      'Картриджи': {
        bg: 'radial-gradient(120% 90% at 18% 18%, rgba(251,113,133,0.28) 0%, rgba(0,0,0,0) 58%), radial-gradient(120% 90% at 78% 28%, rgba(244,63,94,0.24) 0%, rgba(0,0,0,0) 62%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)',
        mascot: 'pink' as const,
      },
    };
  }, []);

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

  const titleFontSize = (title: string) => {
    const len = String(title || '').trim().length;
    if (len <= 8) return 26;
    if (len <= 10) return 22;
    return 18;
  };

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
      fontSize: 36,
      fontWeight: theme.typography.fontWeight.bold,
      marginBottom: theme.spacing.xs,
      textShadow: '0 10px 30px rgba(0,0,0,0.55)',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
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
      height: 150,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      position: 'relative' as const,
      boxShadow: theme.shadow.card,
      border: '1px solid rgba(255,255,255,0.14)',
      cursor: 'pointer',
      touchAction: 'manipulation' as const,
    },
    categoryTitleWrap: {
      position: 'absolute' as const,
      left: theme.spacing.md,
      bottom: theme.spacing.md,
      maxWidth: '56%',
      zIndex: 2,
    },
    categoryTitle: (title: string) => ({
      fontSize: titleFontSize(title),
      fontWeight: theme.typography.fontWeight.bold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      textShadow: '0 12px 30px rgba(0,0,0,0.60)',
      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
      lineHeight: 0.95,
    }),
    categoryMascot: {
      position: 'absolute' as const,
      right: -30,
      bottom: -32,
      width: 200,
      height: 200,
      pointerEvents: 'none' as const,
      zIndex: 1,
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
  };

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
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
            <div className="home-banner-mascot">
              <CherryMascot
                variant={currentBanner % 5 === 1 ? 'green' : currentBanner % 5 === 2 ? 'gold' : currentBanner % 5 === 3 ? 'cosmic' : currentBanner % 5 === 4 ? 'pink' : 'classic'}
                size={210}
              />
            </div>
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

      <div style={{ padding: `0 ${theme.padding.screen}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
        <div style={{ fontSize: theme.typography.fontSize.xs, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
          Категории
        </div>
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
          categories.slice(0, 4).map((category) => {
            const a = (categoryAtmos as any)[String(category.slug || category.name)] || (categoryAtmos as any)[String(category.name)];
            const bg = a?.bg || 'linear-gradient(160deg, rgba(8,6,14,0.90) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)';
            const mascot = a?.mascot || 'classic';
            return (
              <div
                key={category.name}
                style={{
                  ...styles.categoryCard,
                  background: bg,
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
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.18, filter: 'saturate(1.1) contrast(1.05)' }}
                  />
                ) : null}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.82) 100%)', pointerEvents: 'none' }} />
                <div style={styles.categoryMascot}>
                  <CherryMascot variant={mascot} size={176} />
                </div>
                {category.badgeText ? (
                  <div style={{ position: 'absolute', top: theme.spacing.md, right: theme.spacing.md, zIndex: 3 }}>
                    <ChipBadge variant="new" size="sm">{category.badgeText}</ChipBadge>
                  </div>
                ) : null}
                <div style={styles.categoryTitleWrap}>
                  <div style={styles.categoryTitle(category.name)}>{category.name}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <SectionDivider title={tab === 'Все' ? 'Все товары' : tab} />

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
        </div>
      )}

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
