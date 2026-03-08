import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { theme, GlassCard, CherryMascot } from '../ui';
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
  const bannerTouch = React.useRef<{ x: number; y: number } | null>(null);
  const bannerSwiped = React.useRef(false);

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
  }, false);

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
      height: 230,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      position: 'relative' as const,
      boxShadow: theme.shadow.card,
      border: '1px solid rgba(255,255,255,0.14)',
      cursor: 'pointer',
    },
    bannerContent: {
      position: 'absolute' as const,
      bottom: 28,
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
            onClick={() => {
              if (bannerSwiped.current) {
                bannerSwiped.current = false;
                return;
              }
              onBannerClick();
            }}
            role="button"
            onTouchStart={(e) => {
              if (!e.touches?.length) return;
              bannerSwiped.current = false;
              bannerTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }}
            onTouchMove={(e) => {
              const start = bannerTouch.current;
              if (!start) return;
              if (!e.touches?.length) return;
              const dx = e.touches[0].clientX - start.x;
              const dy = e.touches[0].clientY - start.y;
              if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
                try {
                  e.preventDefault();
                } catch {
                }
              }
            }}
            onTouchEnd={(e) => {
              const start = bannerTouch.current;
              bannerTouch.current = null;
              if (!start) return;
              const changed = e.changedTouches?.[0];
              if (!changed) return;
              const dx = changed.clientX - start.x;
              if (Math.abs(dx) < 40) return;
              bannerSwiped.current = true;
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
          </div>
        ) : (
          <div style={{ marginBottom: theme.spacing.lg }}>
            <GlassCard padding="lg" variant="elevated">
              <div style={{ height: 180 }} className="animate-pulse" />
            </GlassCard>
          </div>
        )}
        {banners.length ? (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentBanner(idx);
                }}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  border: 'none',
                  background: idx === currentBanner ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.36)',
                  transition: 'all 120ms ease',
                  cursor: 'pointer',
                  padding: 0,
                }}
                aria-label={`banner-${idx + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {config?.bundleConfig?.enabled ? (
        <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.lg }}>
          <div
            onClick={() => navigate('/bundle')}
            role="button"
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              position: 'relative',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.8) 0%, rgba(15,12,26,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.14)',
              padding: 12,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 2 }}>
              Вместе дешевле
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>
              Под + 2 жидкости
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 54, height: 54, borderRadius: 10, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CherryMascot variant="cosmic" size={40} />
              </div>
              <div style={{ width: 20, height: 20, borderRadius: 10, border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700 }}>+</div>
              <div style={{ width: 54, height: 54, borderRadius: 10, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CherryMascot variant="green" size={40} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800 }}>{config?.bundleConfig?.price || 50} €</span>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'rgba(34,197,94,0.18)', color: '#22c55e' }}>ВЫГОДНО</span>
            </div>
            <div style={{ width: '100%', padding: '8px 0', borderRadius: 10, background: 'rgba(255,255,255,0.10)', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Собрать набор →
            </div>
          </div>
        </div>
      ) : null}

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

      <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.md }}>
        <GlassCard
          padding="md"
          variant="elevated"
          style={{ height: 100, borderRadius: 16, cursor: 'pointer', position: 'relative', overflow: 'hidden', background: 'radial-gradient(120% 90% at 18% 18%, rgba(251,113,133,0.28) 0%, rgba(0,0,0,0) 58%), linear-gradient(160deg, rgba(8,6,14,0.88) 0%, rgba(15,12,26,1) 55%, rgba(8,6,14,0.92) 100%)' }}
          onClick={() => navigate('/catalog?category=наборы')}
        >
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily, fontSize: 30, letterSpacing: '0.12em', textTransform: 'uppercase' as const, zIndex: 2 }}>
            НАБОРЫ
          </div>
          <div style={{ position: 'absolute', right: -12, bottom: -14, zIndex: 1 }}>
            <CherryMascot variant="pink" size={120} />
          </div>
        </GlassCard>
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
