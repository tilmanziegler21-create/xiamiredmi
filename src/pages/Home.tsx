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

  const tabs = useMemo(() => (['Все', 'Новинки', 'Скидки', 'Жидкости', 'Одноразки']), []);

  const categoryAtmos = useMemo(() => {
    return {
      'Жидкости': {
        bg: 'radial-gradient(ellipse at 80% 50%, rgba(30,120,60,0.5), transparent 65%), #060e08',
        mascot: 'green' as const,
      },
      'Одноразки': {
        bg: 'radial-gradient(ellipse at 80% 50%, rgba(180,120,20,0.45), transparent 65%), #0d0a04',
        mascot: 'gold' as const,
      },
      'Поды': {
        bg: 'radial-gradient(ellipse at 80% 50%, rgba(50,80,200,0.4), transparent 65%), #05060f',
        mascot: 'cosmic' as const,
      },
      'Картриджи': {
        bg: 'radial-gradient(ellipse at 80% 50%, rgba(180,20,50,0.4), transparent 65%), #0d0406',
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
    if (t === 'жидкости') return allProducts.filter((p) => ['жидкости', 'liquids'].includes(norm(p.category)));
    if (t === 'одноразки') return allProducts.filter((p) => ['одноразки', 'disposables'].includes(norm(p.category)));
    if (t === 'поды') return allProducts.filter((p) => ['поды', 'pods'].includes(norm(p.category)));
    if (t === 'картриджи') return allProducts.filter((p) => ['картриджи', 'cartridges'].includes(norm(p.category)));
    return allProducts;
  }, [allProducts, tab]);

  const featured = useMemo(() => {
    return filteredProducts.slice(0, 6);
  }, [filteredProducts]);

  const bannerBottleUrl = useMemo(() => {
    const norm = (v: any) => String(v || '').trim().toLowerCase();
    const current = banners[currentBanner];
    const target = current?.linkType === 'category' ? String(current?.linkTarget || '') : '';
    const categoryHint = target ? norm(target) : '';
    const byHint =
      categoryHint === 'жидкости'
        ? allProducts.find((p) => p.image && norm(p.category) === 'жидкости')
        : categoryHint === 'одноразки'
        ? allProducts.find((p) => p.image && norm(p.category) === 'одноразки')
        : allProducts.find((p) => p.image);
    return byHint?.image ? String(byHint.image) : '';
  }, [allProducts, banners, currentBanner]);

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
      zIndex: 4,
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
      padding: '2px 20px 0 2px',
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
      gap: '10px',
      marginBottom: theme.spacing.xl,
    },
    categoryCard: {
      height: 155,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative' as const,
      boxShadow: theme.shadow.card,
      border: '1px solid rgba(255,255,255,0.14)',
      cursor: 'pointer',
      touchAction: 'manipulation' as const,
    },
    categoryTitle: {
      position: 'absolute' as const,
      left: 12,
      bottom: 12,
      maxWidth: '55%',
      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
      fontSize: 22,
      color: '#fff',
      textShadow: '0 2px 8px rgba(0,0,0,0.9)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      lineHeight: 0.95,
      whiteSpace: 'normal' as const,
      wordBreak: 'break-word' as const,
      zIndex: 2,
    },
    categoryBadge: {
      position: 'absolute' as const,
      top: 10,
      left: 10,
      borderRadius: 4,
      padding: '4px 6px',
      background: 'rgba(255,255,255,0.12)',
      border: '1px solid rgba(255,255,255,0.18)',
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: '0.10em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.92)',
      zIndex: 3,
    },
    categoryMascot: {
      position: 'absolute' as const,
      right: -12,
      bottom: -8,
      height: '85%',
      width: '60%',
      pointerEvents: 'none' as const,
      zIndex: 1,
    },
    productGrid: {
      padding: `0 ${theme.padding.screen}`,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '10px',
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
            {!ultraLite && bannerBottleUrl ? (
              <img
                className="home-banner-product"
                src={bannerBottleUrl}
                alt=""
                loading="lazy"
                decoding="async"
              />
            ) : null}
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
            <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, zIndex: 5 }}>
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

      <div style={{ padding: `0 ${theme.padding.screen}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
        <div style={{ fontSize: theme.typography.fontSize.xs, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily }}>
          КАТЕГОРИИ
        </div>
        <div
          role="button"
          onClick={() => navigate('/categories')}
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
          ВСЕ
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
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.68) 100%)', pointerEvents: 'none' }} />
                <div style={styles.categoryMascot}>
                  <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                    <CherryMascot variant={mascot} size={140} />
                  </div>
                </div>
                {category.badgeText ? (
                  <div style={styles.categoryBadge}>{category.badgeText}</div>
                ) : null}
                <div style={styles.categoryTitle}>{category.name}</div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ padding: `0 ${theme.padding.screen}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
        <div style={{ fontSize: theme.typography.fontSize.xs, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily }}>
          ВСЕ ТОВАРЫ
        </div>
        <div
          role="button"
          onClick={() => navigate('/catalog')}
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
          СМОТРЕТЬ ВСЕ
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
