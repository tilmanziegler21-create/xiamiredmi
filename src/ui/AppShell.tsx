import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { DrawerMenu } from './DrawerMenu';
import { FooterBar } from './FooterBar';
import { ToastHost } from './ToastHost';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useConfigStore } from '../store/useConfigStore';
import { useCityStore } from '../store/useCityStore';
import { CityPickerModal } from './CityPickerModal';
import { useToastStore } from '../store/useToastStore';
import { cartAPI, referralAPI } from '../services/api';

type Props = {
  children: React.ReactNode;
  showMenu?: boolean;
};

export const AppShell: React.FC<Props> = ({ children, showMenu = true }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToastStore();
  const { cart, setCart } = useCartStore();
  const { user } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const { config, load } = useConfigStore();
  const { city, setCity, ensureCity } = useCityStore();
  const [cityModalOpen, setCityModalOpen] = React.useState(false);

  const cityTitle = React.useMemo(() => {
    if (!city) return '';
    const found = (config?.cities || []).find((c) => String(c.code) === String(city));
    return String(found?.title || city);
  }, [city, config?.cities]);

  // Determine if we should show back button
  const showBackButton = location.pathname !== '/home' && location.pathname !== '/';

  React.useEffect(() => {
    (async () => {
      const cfg = await load();
      const cities = cfg?.cities || [];
      const codes = cities.map((c) => String(c.code || '')).filter(Boolean);
      if (!codes.length) {
        toast.push('Города не настроены', 'error');
        return;
      }
      const selected = ensureCity(codes);
      if (!selected) {
        setCityModalOpen(true);
      }
    })();
  }, [ensureCity, load, toast]);

  React.useEffect(() => {
    if (!config?.cities?.length) return;
    if (!city) setCityModalOpen(true);
  }, [city, config?.cities?.length]);

  React.useEffect(() => {
    (async () => {
      try {
        if (!user?.tgId) return;
        const params = new URLSearchParams(location.search || '');
        const ref = String(params.get('ref') || '').trim();
        if (!ref) return;
        const key = `ref_claimed:${user.tgId}:${ref}`;
        if (localStorage.getItem(key)) return;
        await referralAPI.claim(ref);
        localStorage.setItem(key, '1');
        params.delete('ref');
        navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
      } catch {
      }
    })();
  }, [location.pathname, location.search, navigate, user?.tgId]);

  return (
    <>
      <TopBar
        onMenuClick={showMenu ? () => setDrawerOpen(true) : () => undefined}
        onCartClick={() => navigate('/cart')}
        cartCount={cart?.items?.length || 0}
        userName={user?.firstName}
        bonusMultiplier={config?.bonusMultiplier || 4}
        showBackButton={showBackButton}
        showSettings={user?.status === 'admin'}
        onSettingsClick={() => navigate('/admin')}
      />
      <DrawerMenu
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        cartItemsCount={cart?.items?.length || 0}
        userBalance={user?.bonusBalance || 0}
        userStatus={user?.status}
        city={cityTitle || city}
        onCityClick={() => {
          setDrawerOpen(false);
          setCityModalOpen(true);
        }}
      />
      <div style={{ paddingBottom: '72px' }}>
        <div key={location.key} className="page-transition">{children}</div>
      </div>
      <FooterBar />
      <ToastHost />
      <CityPickerModal
        open={cityModalOpen}
        cities={(config?.cities || []).map((c) => ({ code: c.code, title: c.title || c.code }))}
        selectedCity={city}
        onSelect={(next) => {
          const prevCity = city;
          if (prevCity && prevCity !== next) {
            if (cart?.city && cart.city !== next) {
              setCart({ id: String(cart.id || ''), city: next, items: [], total: 0 });
            }
            cartAPI.clear(prevCity).catch(() => {});
            toast.push('Город изменён, корзина очищена', 'info');
          }
          setCity(next);
          setCityModalOpen(false);
        }}
        onClose={config?.cities?.length ? () => setCityModalOpen(false) : undefined}
      />
    </>
  );
};
