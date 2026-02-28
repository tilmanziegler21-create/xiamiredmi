import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { theme, GlassCard, CarouselDots, CherryMascot } from '../ui';
import { catalogAPI } from '../services/api';
import { RefreshCw, Search } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';
import { useCityStore } from '../store/useCityStore';
import { useConfigStore } from '../store/useConfigStore';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useAuthStore } from '../store/useAuthStore';

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
  const { user } = useAuthStore();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [brandDirectory, setBrandDirectory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { city } = useCityStore();
  const { config } = useConfigStore();
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
    if (type === 'route' && target) {
      navigate(target);
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
  }, [city]);

  const { pull, refreshing: ptrRefreshing, armed: ptrArmed } = usePullToRefresh(async () => {
    await loadProducts();
  }, true);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      if (!city) {
        setLoadError('Выберите город');
        setAllProducts([]);
        setBrandDirectory([]);
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
      try {
        const b = await catalogAPI.getBrands(city);
        setBrandDirectory(Array.isArray(b.data?.brands) ? b.data.brands : []);
      } catch {
        setBrandDirectory([]);
      }
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
      setBrandDirectory([]);
    } finally {
      setLoading(false);
    }
  };

  const brandRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allProducts) {
      const b = String(p.brand || '').trim();
      if (!b) continue;
      map.set(b, (map.get(b) || 0) + 1);
    }
    if (brandDirectory.length) {
      return brandDirectory
        .map((b) => ({ brand: String(b || '').trim(), count: map.get(String(b || '').trim()) || 0 }))
        .filter((r) => r.brand && r.count > 0);
    }
    return Array.from(map.entries()).map(([brand, count]) => ({ brand, count })).sort((a, b) => a.brand.localeCompare(b.brand));
  }, [allProducts, brandDirectory]);

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
    greeting: {
      padding: `0 ${theme.padding.screen}`,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    greetingTitle: {
      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
      fontSize: 26,
      letterSpacing: '0.10em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.92)',
      marginBottom: 2,
    },
    greetingSub: {
      fontSize: theme.typography.fontSize.xs,
      letterSpacing: '0.14em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.60)',
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
    categoryTitle: (title: string) => ({
      position: 'absolute' as const,
      left: 12,
      bottom: 12,
      maxWidth: '55%',
      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
      fontSize: String(title || '').length > 9 ? 17 : 22,
      color: '#fff',
      textShadow: '0 2px 8px rgba(0,0,0,0.9)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      lineHeight: 0.95,
      whiteSpace: 'nowrap' as const,
      zIndex: 2,
    }),
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
    brandList: {
      padding: `0 ${theme.padding.screen}`,
      display: 'grid',
      gap: '10px',
      marginBottom: theme.spacing.xl,
    },
    brandCard: {
      height: 80,
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(12, 10, 26, 0.62)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px',
    },
    brandTitle: {
      fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily,
      fontSize: 24,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.92)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    brandMeta: {
      fontSize: 12,
      color: theme.colors.dark.textSecondary,
      letterSpacing: '0.06em',
      marginTop: 2,
    },
    skeleton: {
      borderRadius: theme.radius.lg,
      height: 80,
      border: '1px solid rgba(255,255,255,0.10)',
    },
  };

  return (
    <div style={styles.container}>
      {pull > 0 || ptrRefreshing ? (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ height: Math.max(22, pull), display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ width: 34, height: 34, borderRadius: 999, background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={16} color="rgba(255,255,255,0.70)" style={{ transform: ptrRefreshing ? 'rotate(360deg)' : ptrArmed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }} />
            </div>
          </div>
        </div>
      ) : null}
      <div style={styles.greeting}>
        <div style={styles.greetingTitle}>
          Привет, {String(user?.firstName || user?.username || 'друг')}
        </div>
        <div style={styles.greetingSub}>
          Выбирай вкус • оформляй заказ
        </div>
      </div>
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
                onClick={() =>
                  ['Жидкости', 'Одноразки', 'Поды', 'Картриджи'].includes(String(category.slug || ''))
                    ? navigate(`/brands?category=${encodeURIComponent(category.slug)}`)
                    : navigate(`/catalog?category=${encodeURIComponent(category.slug)}`)
                }
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
                <div style={styles.categoryTitle(category.name)}>{category.name}</div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ padding: `0 ${theme.padding.screen}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
        <div style={{ fontSize: theme.typography.fontSize.xs, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily }}>
          БРЕНДЫ
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
          ВКУСЫ
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
        <div style={styles.brandList}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={styles.skeleton} className="skeleton-shimmer" />
          ))}
        </div>
      ) : (
        <div style={styles.brandList}>
          {brandRows.slice(0, 12).map((r) => (
            <div
              key={r.brand}
              style={styles.brandCard}
              role="button"
              onClick={() => navigate(`/catalog?brand=${encodeURIComponent(r.brand)}`)}
            >
              <div style={{ minWidth: 0 }}>
                <div style={styles.brandTitle}>{r.brand}</div>
                <div style={styles.brandMeta}>{r.count} вкусов</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, paddingRight: 4 }}>→</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
