import React from 'react';
import WebApp from '@twa-dev/sdk';
import { Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cartAPI } from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { AddToCartModal, CherryMascot, GlassCard, PrimaryButton, ProductCard, SectionDivider, theme } from '../ui';
import { useToastStore } from '../store/useToastStore';
import { useCityStore } from '../store/useCityStore';
import { useFavoritesStore } from '../store/useFavoritesStore';

type FavItem = {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  image: string;
};

const Favorites: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { setCart } = useCartStore();
  const { city } = useCityStore();
  const favorites = useFavoritesStore();
  const [addOpen, setAddOpen] = React.useState(false);
  const [addItem, setAddItem] = React.useState<FavItem | null>(null);

  const load = async () => {
    try {
      if (!city) {
        toast.push('Выберите город', 'error');
        return;
      }
      await favorites.load(city);
    } catch (e) {
      console.error('Favorites load error:', e);
      try {
        WebApp.showAlert('Ошибка загрузки избранного');
      } catch {
        toast.push('Ошибка загрузки избранного', 'error');
      }
    }
  };

  React.useEffect(() => {
    load();
  }, [city]);

  const remove = async (productId: string) => {
    try {
      if (!city) {
        toast.push('Выберите город', 'error');
        return;
      }
      const it = favorites.items.find((x) => String(x.id) === String(productId));
      await favorites.toggle({
        city,
        product: it || { id: productId, name: '', category: '', brand: '', price: 0, image: '' },
        enabled: false,
      });
      toast.push('Удалено из избранного', 'success');
    } catch {
      toast.push('Ошибка избранного', 'error');
    }
  };

  const styles = {
    title: {
      textAlign: 'center' as const,
      padding: `0 ${theme.padding.screen}`,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.md,
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    },
    grid: {
      padding: `0 ${theme.padding.screen}`,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },
  };

  return (
    <div>
      <div style={styles.title}>Избранное</div>
      <SectionDivider title="Товары" />

      <div style={styles.grid}>
        {favorites.isLoading ? (
          [...Array(6)].map((_, i) => (
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
          ))
        ) : favorites.items.length ? (
          favorites.items.map((p) => (
            <ProductCard
              key={p.id}
              id={p.id}
              name={p.name}
              price={p.price}
              image={p.image}
              isFavorite
              onClick={() => setAddItem(p)}
              onToggleFavorite={() => remove(p.id)}
              onAddToCart={() => {
                setAddItem(p);
                setAddOpen(true);
              }}
            />
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1' }}>
            <GlassCard padding="lg" variant="elevated">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.xl }}>
                <CherryMascot variant="pink" size={140} />
                <div style={{ fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase' as const, fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily }}>
                  Здесь пока пусто
                </div>
                <PrimaryButton fullWidth onClick={() => navigate('/catalog')} style={{ borderRadius: 12 }}>
                  В каталог
                </PrimaryButton>
              </div>
            </GlassCard>
          </div>
        )}
      </div>

      <AddToCartModal
        open={addOpen}
        product={addItem ? { id: addItem.id, name: addItem.name, price: addItem.price, image: addItem.image } : null}
        onClose={() => setAddOpen(false)}
        onConfirm={async ({ quantity, variant }) => {
          if (!addItem) return;
          if (!city) {
            toast.push('Выберите город', 'error');
            return;
          }
          try {
            await cartAPI.addItem({ productId: addItem.id, quantity, city, price: addItem.price, variant });
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

export default Favorites;
