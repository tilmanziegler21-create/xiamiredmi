import React from 'react';
import { useNavigate } from 'react-router-dom';
import { catalogAPI, cartAPI } from '../services/api';
import { ProductCard, PrimaryButton, SecondaryButton, SectionDivider, theme } from '../ui';
import { useCityStore } from '../store/useCityStore';
import { useCartStore } from '../store/useCartStore';
import { useToastStore } from '../store/useToastStore';
import { useConfigStore } from '../store/useConfigStore';

type Product = {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  image: string;
  qtyAvailable?: number;
  isNew?: boolean;
};

const normText = (v: string) =>
  String(v || '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-zа-я0-9 ]/gi, '');

const isPodCategory = (category: string) => {
  const c = normText(category);
  return c === 'pods';
};

const isLiquidCategory = (category: string) => {
  const c = normText(category);
  return c === 'жидкости' || c === 'liquids' || c.includes('жидк') || c.includes('liquid');
};

const BundleBuilder: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { city } = useCityStore();
  const { setCart } = useCartStore();
  const { config } = useConfigStore();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [pods, setPods] = React.useState<Product[]>([]);
  const [liquids, setLiquids] = React.useState<Product[]>([]);
  const [selectedPod, setSelectedPod] = React.useState<Product | null>(null);
  const [selectedLiquids, setSelectedLiquids] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const bundlePrice = Number(config?.bundleConfig?.price || 50);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        if (!city) {
          setPods([]);
          setLiquids([]);
          return;
        }
        const response = await catalogAPI.getProducts({ city });
        const all = (response.data.products || []) as Product[];
        const inStock = all.filter((p) => Number(p.qtyAvailable || 0) > 0);
        const nextPods = inStock.filter((p) => isPodCategory(p.category));
        const nextLiquids = inStock.filter((p) => isLiquidCategory(p.category));
        setPods(nextPods);
        setLiquids(nextLiquids);
      } catch (e) {
        console.error('Bundle builder load failed:', e);
        toast.push('Ошибка загрузки товаров', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [city]);

  const toggleLiquid = (p: Product) => {
    setSelectedLiquids((prev) => {
      const exists = prev.some((x) => x.id === p.id);
      if (exists) return prev.filter((x) => x.id !== p.id);
      if (prev.length >= 2) return prev;
      return [...prev, p];
    });
  };

  const submitBundle = async () => {
    if (!city || !selectedPod || selectedLiquids.length !== 2) return;
    try {
      setSubmitting(true);
      await cartAPI.addBundle({
        city,
        podProductId: selectedPod.id,
        liquidProducts: selectedLiquids.map((l) => ({ productId: l.id })),
      });
      const resp = await cartAPI.getCart(city);
      setCart(resp.data.cart);
      navigate('/cart');
    } catch (e) {
      console.error('Bundle add failed:', e);
      toast.push('Не удалось добавить набор', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: theme.padding.screen }}>
        <div style={{ height: 180, borderRadius: 16, border: '1px solid rgba(255,255,255,0.10)' }} className="skeleton-shimmer" />
      </div>
    );
  }

  return (
    <div className="content-fade-in" style={{ paddingBottom: theme.spacing.xl }}>
      <SectionDivider title="Собрать набор" />
      <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.lg }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr 28px 1fr', alignItems: 'center', gap: 8 }}>
          {[1, 2, 3].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ width: 28, height: 28, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: step >= s ? theme.gradients.primary : 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 800, justifySelf: 'center' }}>{s}</div>
              {i < 2 ? <div style={{ height: 2, background: step > s ? 'rgba(255,45,85,0.9)' : 'rgba(255,255,255,0.16)' }} /> : null}
            </React.Fragment>
          ))}
        </div>
      </div>

      {step === 1 ? (
        <>
          <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.md, color: theme.colors.dark.textSecondary }}>Шаг 1: выбери под</div>
          <div style={{ padding: `0 ${theme.padding.screen}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
            {pods.map((p) => (
              <div key={p.id} onClick={() => { setSelectedPod(p); setStep(2); }}>
                <ProductCard id={p.id} name={p.name} price={p.price} image={p.image} brand={p.brand} category={p.category} stock={Number(p.qtyAvailable || 0)} />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div style={{ padding: `0 ${theme.padding.screen}`, marginBottom: theme.spacing.md, color: theme.colors.dark.textSecondary }}>
            Шаг 2: выбери 2 жидкости • Выбрано: {selectedLiquids.length}/2
          </div>
          <div style={{ padding: `0 ${theme.padding.screen}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
            {liquids.map((p) => {
              const selected = selectedLiquids.some((x) => x.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleLiquid(p)}
                  style={{ borderRadius: 16, border: selected ? '2px solid rgba(255,45,85,0.95)' : '2px solid transparent' }}
                >
                  <ProductCard id={p.id} name={p.name} price={p.price} image={p.image} brand={p.brand} category={p.category} stock={Number(p.qtyAvailable || 0)} />
                </div>
              );
            })}
          </div>
          <div style={{ padding: `0 ${theme.padding.screen}`, marginTop: theme.spacing.md, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm }}>
            <SecondaryButton fullWidth onClick={() => setStep(1)}>Назад</SecondaryButton>
            <PrimaryButton fullWidth onClick={() => setStep(3)} disabled={selectedLiquids.length !== 2}>Далее</PrimaryButton>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <div style={{ padding: `0 ${theme.padding.screen}`, display: 'grid', gap: theme.spacing.md }}>
          <div style={{ color: theme.colors.dark.textSecondary }}>Шаг 3: проверь состав</div>
          <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(12, 10, 26, 0.62)', padding: theme.spacing.md }}>
            <div style={{ marginBottom: 8 }}>Под: {selectedPod?.name || '—'}</div>
            <div style={{ marginBottom: 8 }}>Жидкость 1: {selectedLiquids[0]?.name || '—'}</div>
            <div style={{ marginBottom: 8 }}>Жидкость 2: {selectedLiquids[1]?.name || '—'}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 12 }}>{bundlePrice} €</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm }}>
            <SecondaryButton fullWidth onClick={() => setStep(2)}>Назад</SecondaryButton>
            <PrimaryButton fullWidth onClick={submitBundle} disabled={submitting || !selectedPod || selectedLiquids.length !== 2}>
              {submitting ? 'Добавление…' : 'Добавить в корзину'}
            </PrimaryButton>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BundleBuilder;
