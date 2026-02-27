import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import WebApp from '@twa-dev/sdk';
import { catalogAPI, cartAPI } from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { useAnalytics } from '../hooks/useAnalytics';
import { AddToCartModal, ProductCard, GlassCard, SecondaryButton, PrimaryButton, SectionDivider, theme } from '../ui';
import { useToastStore } from '../store/useToastStore';
import { useCityStore } from '../store/useCityStore';
import { useFavoritesStore } from '../store/useFavoritesStore';
import { blurStyle } from '../ui/blur';

interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  qtyAvailable: number;
  discount?: number;
  isNew?: boolean;
  description: string;
  image: string;
  tasteProfile?: {
    sweetness: number;
    coolness: number;
    fruitiness: number;
    strength: number;
  };
}

const Catalog: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { setCart } = useCartStore();
  const { trackAddToCart, trackFilterUse, trackCategoryView } = useAnalytics();
  const { city } = useCityStore();
  const favorites = useFavoritesStore();
  const [searchParams] = useSearchParams();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addProduct, setAddProduct] = useState<Product | null>(null);
  const [visibleCount, setVisibleCount] = useState(40);
  
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    price_min: '',
    price_max: '',
    discount: false,
    new: false,
    taste_sweetness_min: '',
    taste_sweetness_max: '',
    taste_coolness_min: '',
    taste_fruitiness_min: '',
  });

  const liteCards = (() => {
    try {
      return document.documentElement.classList.contains('tg-webview');
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    const qCategory = searchParams.get('category');
    setFilters((s) => ({ ...s, category: qCategory ? String(qCategory) : '' }));
  }, [searchParams]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 200);
    return () => window.clearTimeout(t);
  }, [query]);

  const applyFilters = (source: Product[]) => {
    const toNum = (v: string) => {
      const n = Number(String(v || '').replace(',', '.'));
      return Number.isFinite(n) ? n : NaN;
    };
    const norm = (v: any) => String(v || '').trim().toLowerCase();
    const categoryAlias: Record<string, string> = {
      'жидкости': 'liquids',
      'одноразки': 'disposables',
      'поды': 'pods',
      'картриджи': 'cartridges',
    };
    const priceMin = toNum(filters.price_min);
    const priceMax = toNum(filters.price_max);
    const tSweetMin = toNum(filters.taste_sweetness_min);
    const tSweetMax = toNum(filters.taste_sweetness_max);
    const tCoolMin = toNum(filters.taste_coolness_min);
    const tFruitMin = toNum(filters.taste_fruitiness_min);

    let out = source.slice();
    const rawCategory = String(filters.category || '');
    const catKey = norm(rawCategory);
    const mappedCategory = categoryAlias[catKey] || rawCategory;
    const hasAnyNew = source.some((p) => Boolean((p as any).isNew));
    if (catKey === 'новинки') {
      if (hasAnyNew) out = out.filter((p) => Boolean((p as any).isNew));
    } else if (catKey === 'хиты') {
      // no-op: avoid empty catalog due to mismatched labels
    } else if (rawCategory) {
      out = out.filter((p) => norm(p.category) === norm(mappedCategory));
    }
    if (filters.brand) out = out.filter((p) => norm(p.brand) === norm(filters.brand));
    if (Number.isFinite(priceMin)) out = out.filter((p) => Number(p.price || 0) >= priceMin);
    if (Number.isFinite(priceMax)) out = out.filter((p) => Number(p.price || 0) <= priceMax);
    if (filters.discount) out = out.filter((p) => Number((p as any).discount || 0) > 0);
    if (filters.new) out = out.filter((p) => Boolean((p as any).isNew));
    if (Number.isFinite(tSweetMin)) out = out.filter((p) => Number(p.tasteProfile?.sweetness || 0) >= tSweetMin);
    if (Number.isFinite(tSweetMax)) out = out.filter((p) => Number(p.tasteProfile?.sweetness || 0) <= tSweetMax);
    if (Number.isFinite(tCoolMin)) out = out.filter((p) => Number(p.tasteProfile?.coolness || 0) >= tCoolMin);
    if (Number.isFinite(tFruitMin)) out = out.filter((p) => Number(p.tasteProfile?.fruitiness || 0) >= tFruitMin);
    return out;
  };

  useEffect(() => {
    if (!city) {
      setLoading(false);
      setAllProducts([]);
      setProducts([]);
      setCategories([]);
      setBrands([]);
      return;
    }
    favorites.load(city);
    (async () => {
      try {
        setLoading(true);
        const response = await catalogAPI.getProducts({ city });
        const list: Product[] = response.data.products || [];
        setAllProducts(list);
        setProducts(applyFilters(list));
        setCategories(Array.from(new Set(list.map((p) => String(p.category || '')).filter(Boolean))).sort());
        setBrands(Array.from(new Set(list.map((p) => String(p.brand || '')).filter(Boolean))).sort());
      } catch (error) {
        console.error('Failed to load catalog:', error);
        try {
          const status = (error as any)?.response?.status;
          const msg = String((error as any)?.response?.data?.error || '');
          WebApp.showAlert(`Ошибка загрузки каталога${status ? ` (${status})` : ''}${msg ? `: ${msg}` : ''}`);
        } catch {
          toast.push('Ошибка загрузки каталога', 'error');
        }
        setAllProducts([]);
        setProducts([]);
        setCategories([]);
        setBrands([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [city]);

  useEffect(() => {
    if (!city) return;
    setVisibleCount(40);
    const id = window.setTimeout(() => setProducts(applyFilters(allProducts)), 60);
    // Track filter usage
    if (filters.category) trackCategoryView(filters.category);
    if (filters.brand) trackFilterUse('brand', filters.brand);
    if (filters.discount) trackFilterUse('discount', 'true');
    if (filters.new) trackFilterUse('new', 'true');
    if (filters.price_min || filters.price_max) {
      trackFilterUse('price_range', `${filters.price_min || 0}-${filters.price_max || '∞'}`);
    }
    return () => window.clearTimeout(id);
  }, [city, filters, allProducts]);

  const openAdd = (product: Product) => {
    setAddProduct(product);
    setAddOpen(true);
  };

  const resetFilters = () => {
    setFilters({
      category: '',
      brand: '',
      price_min: '',
      price_max: '',
      discount: false,
      new: false,
      taste_sweetness_min: '',
      taste_sweetness_max: '',
      taste_coolness_min: '',
      taste_fruitiness_min: '',
    });
  };

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (products.length === 0) return [];
    if (!q) {
      return products;
    }
    const result = products.filter((p) =>
      [p.name, p.brand, p.category].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
    return result;
  }, [products, debouncedQuery]);

  const visible = useMemo(() => {
    return filtered.slice(0, Math.max(0, visibleCount));
  }, [filtered, visibleCount]);

  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    if (visibleCount >= filtered.length) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisibleCount((n) => Math.min(filtered.length, n + (liteCards ? 20 : 40)));
            break;
          }
        }
      },
      { root: null, rootMargin: '400px', threshold: 0.01 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [filtered.length, liteCards, visibleCount]);

  const styles = {
    container: {
      paddingBottom: theme.spacing.xl,
    },
    searchRow: {
      padding: `0 ${theme.padding.screen}`,
      display: 'flex',
      gap: theme.spacing.sm,
      alignItems: 'center',
    },
    searchBox: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.06)',
      ...blurStyle(theme.blur.glass),
      padding: '10px 14px',
      boxShadow: theme.shadow.card,
    },
    input: {
      flex: 1,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: theme.colors.dark.text,
      fontSize: theme.typography.fontSize.sm,
    },
    grid: {
      padding: `${theme.spacing.lg} ${theme.padding.screen}`,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
    },
    overlay: {
      position: 'fixed' as const,
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 1200,
      display: 'flex',
      alignItems: 'flex-end',
      padding: theme.padding.screen,
      paddingBottom: `calc(${theme.padding.screen} + var(--safe-area-bottom, 0px))`,
    },
    sheet: {
      width: '100%',
      borderRadius: theme.radius.lg,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(12, 10, 26, 0.78)',
      ...blurStyle(theme.blur.glass),
      boxShadow: theme.shadow.card,
      padding: theme.spacing.lg,
      maxHeight: '82vh',
      overflowY: 'auto' as const,
      WebkitOverflowScrolling: 'touch' as any,
    },
    label: {
      fontSize: theme.typography.fontSize.xs,
      letterSpacing: '0.14em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.55)',
      marginBottom: theme.spacing.xs,
    },
    select: {
      width: '100%',
      borderRadius: theme.radius.md,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.06)',
      color: theme.colors.dark.text,
      padding: '10px 12px',
      outline: 'none',
    },
    checkboxRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    check: {
      display: 'flex',
      gap: theme.spacing.sm,
      alignItems: 'center',
      color: theme.colors.dark.text,
      fontSize: theme.typography.fontSize.sm,
    },
    togglePill: (active: boolean) => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      padding: '10px 12px',
      borderRadius: 999,
      cursor: 'pointer',
      userSelect: 'none' as const,
      background: active ? 'rgba(255,45,85,0.18)' : 'rgba(255,255,255,0.06)',
      border: active ? '1px solid rgba(255,45,85,0.38)' : '1px solid rgba(255,255,255,0.14)',
      color: active ? theme.colors.dark.primary : theme.colors.dark.text,
      fontSize: theme.typography.fontSize.sm,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    }),
  };

  return (
    <div style={styles.container}>
      <SectionDivider title="Все товары" />

      <div style={styles.searchRow}>
        <div style={styles.searchBox}>
          <Search size={18} color="rgba(255,255,255,0.65)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск"
            style={styles.input}
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'transparent', border: 'none', color: theme.colors.dark.text, cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
        <SecondaryButton
          onClick={() => setShowFilters(true)}
          style={{ borderRadius: 999, padding: '10px 14px' }}
        >
          <SlidersHorizontal size={18} />
        </SecondaryButton>
      </div>

      {loading ? (
        <div style={styles.grid}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 280,
                borderRadius: theme.radius.lg,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.08)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : (
        <div style={styles.grid}>
          {allProducts.length > 0 && filtered.length === 0 ? (
            <GlassCard padding="lg" variant="elevated" style={{ gridColumn: '1 / -1' }}>
              <div style={{ color: theme.colors.dark.text, fontWeight: theme.typography.fontWeight.semibold, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: theme.spacing.sm }}>
                Ничего не найдено
              </div>
              <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, lineHeight: '1.45', marginBottom: theme.spacing.md }}>
                Похоже, фильтры или категория не совпадают с данными. Сбросьте фильтры и попробуйте снова.
              </div>
              <PrimaryButton
                fullWidth
                onClick={() => {
                  setQuery('');
                  resetFilters();
                  try {
                    navigate('/catalog', { replace: true });
                  } catch {
                  }
                }}
              >
                Сбросить фильтры
              </PrimaryButton>
            </GlassCard>
          ) : null}
          {allProducts.length === 0 && !loading ? (
            <GlassCard padding="lg" variant="elevated" style={{ gridColumn: '1 / -1' }}>
              <div style={{ color: theme.colors.dark.text, fontWeight: theme.typography.fontWeight.semibold, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: theme.spacing.sm }}>
                Каталог пуст
              </div>
              <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, lineHeight: '1.45', marginBottom: theme.spacing.md }}>
                Если товары есть в таблице, значит запрос не прошёл или вернул пустой список. Попробуйте обновить экран или открыть каталог заново.
              </div>
              <PrimaryButton
                fullWidth
                onClick={() => {
                  try {
                    window.location.reload();
                  } catch {
                  }
                }}
              >
                Обновить
              </PrimaryButton>
            </GlassCard>
          ) : null}
          {visible.map((p) => (
            <ProductCard
              key={p.id}
              id={p.id}
              name={p.name}
              price={p.price}
              image={p.image || ''}
              brand={p.brand}
              isNew={Boolean((p as any).isNew)}
              stock={(p as any).qtyAvailable || 0}
              onClick={(id) => navigate(`/product/${id}`)}
              onAddToCart={() => openAdd(p)}
              isFavorite={favorites.isFavorite(p.id)}
              onToggleFavorite={async () => {
                if (!city) {
                  toast.push('Выберите город', 'error');
                  return;
                }
                const enabled = !favorites.isFavorite(p.id);
                try {
                  await favorites.toggle({
                    city,
                    product: {
                      id: p.id,
                      name: p.name,
                      category: p.category,
                      brand: p.brand,
                      price: p.price,
                      image: p.image,
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
          {visibleCount < filtered.length ? (
            <div ref={loadMoreRef} style={{ height: 1 }} />
          ) : null}
        </div>
      )}

      <AddToCartModal
        open={addOpen}
        product={
          addProduct
            ? {
                id: addProduct.id,
                name: addProduct.name,
                price: addProduct.price,
                image: addProduct.image,
              }
            : null
        }
        onClose={() => setAddOpen(false)}
        onConfirm={async ({ quantity, variant }) => {
          if (!addProduct) return;
          if (!city) {
            toast.push('Выберите город', 'error');
            return;
          }
          try {
            await cartAPI.addItem({
              productId: addProduct.id,
              quantity,
              city,
              price: addProduct.price,
              variant,
            });
            const response = await cartAPI.getCart(city);
            setCart(response.data.cart);
            trackAddToCart(addProduct.id, addProduct.name, addProduct.price, quantity);
            toast.push('Товар добавлен в корзину', 'success');
          } catch (error) {
            console.error('Add to cart failed:', error);
            toast.push('Ошибка добавления в корзину', 'error');
          }
        }}
      />

      {showFilters ? (
        <div
          style={styles.overlay}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setShowFilters(false);
          }}
        >
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
              <div style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold }}>Фильтры</div>
              <button
                onClick={() => setShowFilters(false)}
                style={{ background: 'transparent', border: 'none', color: theme.colors.dark.text, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: theme.spacing.md }}>
              <div>
                <div style={styles.label}>Категория</div>
                <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} style={styles.select}>
                  <option value="">Все</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={styles.label}>Бренд</div>
                <select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })} style={styles.select}>
                  <option value="">Все</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                <div>
                  <div style={styles.label}>Цена от</div>
                  <input value={filters.price_min} onChange={(e) => setFilters({ ...filters, price_min: e.target.value })} style={styles.select} inputMode="numeric" />
                </div>
                <div>
                  <div style={styles.label}>Цена до</div>
                  <input value={filters.price_max} onChange={(e) => setFilters({ ...filters, price_max: e.target.value })} style={styles.select} inputMode="numeric" />
                </div>
              </div>

              <div>
                <div style={styles.label}>Сладость (1-5)</div>
                <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                  <input 
                    value={filters.taste_sweetness_min} 
                    onChange={(e) => setFilters({ ...filters, taste_sweetness_min: e.target.value })} 
                    style={styles.select} 
                    inputMode="numeric" 
                    placeholder="От"
                  />
                  <input 
                    value={filters.taste_sweetness_max} 
                    onChange={(e) => setFilters({ ...filters, taste_sweetness_max: e.target.value })} 
                    style={styles.select} 
                    inputMode="numeric" 
                    placeholder="До"
                  />
                </div>
              </div>

              <div>
                <div style={styles.label}>Холодность (1-5)</div>
                <input 
                  value={filters.taste_coolness_min} 
                  onChange={(e) => setFilters({ ...filters, taste_coolness_min: e.target.value })} 
                  style={styles.select} 
                  inputMode="numeric" 
                  placeholder="Минимум"
                />
              </div>

              <div>
                <div style={styles.label}>Фруктовость (1-5)</div>
                <input 
                  value={filters.taste_fruitiness_min} 
                  onChange={(e) => setFilters({ ...filters, taste_fruitiness_min: e.target.value })} 
                  style={styles.select} 
                  inputMode="numeric" 
                  placeholder="Минимум"
                />
              </div>

              <div style={styles.checkboxRow}>
                <button
                  type="button"
                  style={styles.togglePill(filters.discount)}
                  onClick={() => setFilters({ ...filters, discount: !filters.discount })}
                >
                  Скидки
                </button>
                <button
                  type="button"
                  style={styles.togglePill(filters.new)}
                  onClick={() => setFilters({ ...filters, new: !filters.new })}
                >
                  Новинки
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md, marginTop: theme.spacing.md }}>
                <SecondaryButton fullWidth onClick={resetFilters}>
                  Сбросить
                </SecondaryButton>
                <PrimaryButton fullWidth onClick={() => setShowFilters(false)}>
                  Применить
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 && !loading ? (
        <div style={{ padding: theme.padding.screen }}>
          <GlassCard padding="lg" variant="elevated">
            <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, textAlign: 'center' }}>
              Товары не найдены
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
};

export default Catalog;
