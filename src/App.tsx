import React, { Suspense, lazy, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { useAuthStore } from './store/useAuthStore';
import { authAPI } from './services/api';
import { SafeAreaProvider, AppShell, GlassCard, PrimaryButton, theme } from './ui';
const AgeVerify = lazy(() => import('./pages/AgeVerify'));
const Home = lazy(() => import('./pages/Home'));
const Catalog = lazy(() => import('./pages/Catalog'));
const Product = lazy(() => import('./pages/Product'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Account = lazy(() => import('./pages/Account'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Referral = lazy(() => import('./pages/Referral'));
const Support = lazy(() => import('./pages/Support'));
const Categories = lazy(() => import('./pages/Categories'));
const Brands = lazy(() => import('./pages/Brands'));
const Admin = lazy(() => import('./pages/Admin'));
const Courier = lazy(() => import('./pages/Courier'));
const Promotions = lazy(() => import('./pages/Promotions'));
const Bonuses = lazy(() => import('./pages/Bonuses'));
const FortuneWheel = lazy(() => import('./pages/FortuneWheel'));
const CourierRegistration = lazy(() => import('./pages/CourierRegistration'));
const BundleBuilder = lazy(() => import('./pages/BundleBuilder'));

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: theme.padding.screen }}>
          <GlassCard padding="lg" variant="elevated">
            <div style={{ color: theme.colors.dark.accentRed, fontWeight: theme.typography.fontWeight.bold, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: theme.spacing.md }}>
              Ошибка
            </div>
            <div style={{ color: theme.colors.dark.textSecondary, fontSize: theme.typography.fontSize.sm, marginBottom: theme.spacing.lg }}>
              Что-то пошло не так. Попробуйте обновить экран.
            </div>
            <PrimaryButton
              fullWidth
              onClick={() => {
                this.setState({ hasError: false });
                try {
                  window.location.reload();
                } catch {
                }
              }}
            >
              Обновить
            </PrimaryButton>
          </GlassCard>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { user, setUser, setLoading, isLoading } = useAuthStore();
  const authStartedRef = React.useRef(false);
  const [authErrorDetails, setAuthErrorDetails] = React.useState<string>('');
  const [showSmoke, setShowSmoke] = React.useState(true);

  const safeAlert = (message: string) => {
    try {
      WebApp.showAlert(message);
    } catch {
      window.alert(message);
    }
  };

  useEffect(() => {
    if (authStartedRef.current) return;
    authStartedRef.current = true;

    let cancelled = false;

    try {
      const ua = navigator.userAgent || '';
      const isTg = Boolean((window as any)?.Telegram?.WebApp) || /Telegram/i.test(ua);
      if (isTg) document.documentElement.classList.add('tg-webview');
      if (/Android/i.test(ua)) document.documentElement.classList.add('tg-android');
      if (/(iPhone|iPad|iPod)/i.test(ua)) document.documentElement.classList.add('tg-ios');
      if (isTg) {
        try {
          WebApp.ready();
        } catch {
        }
        try {
          WebApp.expand();
        } catch {
        }
      }
    } catch {
    }

    const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
      return await new Promise<T>((resolve, reject) => {
        const id = window.setTimeout(() => reject(new Error('AUTH_TIMEOUT')), ms);
        promise.then(
          (value) => {
            window.clearTimeout(id);
            resolve(value);
          },
          (err) => {
            window.clearTimeout(id);
            reject(err);
          },
        );
      });
    };

    const authenticate = async () => {
      setLoading(true);
      try {
        setAuthErrorDetails('');
        const forceDevAuth = import.meta.env.DEV && String(import.meta.env?.VITE_FORCE_DEV_AUTH || '') === '1';
        const storedToken = (() => {
          try {
            return localStorage.getItem('token');
          } catch {
            return null;
          }
        })();

        const innerAuth = async () => {
          if (storedToken) {
            try {
              const me = await authAPI.me();
              if (cancelled) return;
              setUser(me.data.user, storedToken);
              return;
            } catch {
              try {
                localStorage.removeItem('token');
              } catch {
                // ignore
              }
            }
          }

          const initData = WebApp.initData || (import.meta.env?.VITE_TG_INIT_DATA as string);
          if (!forceDevAuth && initData) {
            try {
              const response = await authAPI.verify(initData);
              if (cancelled) return;
              setUser(response.data.user, response.data.token);
              return;
            } catch (e) {
              try {
                const status = (e as any)?.response?.status;
                const msg = String((e as any)?.response?.data?.error || (e as any)?.message || '');
                const origin = (() => {
                  try {
                    return window.location.origin;
                  } catch {
                    return '';
                  }
                })();
                setAuthErrorDetails(`verify failed: status=${status || ''} ${msg || ''} origin=${origin}`);
              } catch {
              }
              if (!import.meta.env.DEV) throw e;
            }
          }

          if (import.meta.env.DEV) {
            const response = await authAPI.dev();
            if (cancelled) return;
            setUser(response.data.user, response.data.token);
            return;
          }

          setAuthErrorDetails('No initData available (open inside Telegram Mini App, not a browser link)');
          throw new Error('No initData available');
        };

        await withTimeout(innerAuth(), import.meta.env.DEV ? 8000 : 15000);

      } catch (error) {
        console.error('Authentication failed:', error);
        try {
          const existing = String(authErrorDetails || '');
          if (!existing) {
            const msg = String((error as any)?.message || '');
            setAuthErrorDetails(msg || 'Authentication failed');
          }
        } catch {
        }
        if (String((error as any)?.message || '') === 'AUTH_TIMEOUT') {
          safeAlert('Сервер долго отвечает, попробуйте ещё раз');
        } else {
          safeAlert('Ошибка авторизации');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    authenticate();
    return () => {
      cancelled = true;
    };
  }, [setUser, setLoading]);

  useEffect(() => {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setShowSmoke(false);
        return;
      }
    } catch {
    }
    const id = window.setTimeout(() => setShowSmoke(false), 1200);
    return () => window.clearTimeout(id);
  }, []);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        {showSmoke ? <div className="smoke-overlay" /> : null}
        <div style={{
          minHeight: '100vh',
          background: theme.colors.dark.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', padding: theme.padding.screen }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: `4px solid rgba(255,255,255,0.12)`,
              borderTop: `4px solid ${theme.colors.dark.primary}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }} />
            <p style={{ color: theme.colors.dark.text, fontSize: theme.typography.fontSize.base }}>Авторизация…</p>
          </div>
        </div>
      </SafeAreaProvider>
    );
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        {showSmoke ? <div className="smoke-overlay" /> : null}
        <div style={{
          minHeight: '100vh',
          background: theme.colors.dark.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', padding: theme.padding.screen, width: '100%', maxWidth: 420 }}>
            <GlassCard padding="lg" variant="elevated">
              <p style={{ color: theme.colors.dark.accentRed, marginBottom: theme.spacing.md, fontSize: theme.typography.fontSize.base }}>
                Ошибка авторизации
              </p>
            {authErrorDetails ? (
              <p style={{ color: theme.colors.dark.textSecondary, marginBottom: theme.spacing.md, fontSize: theme.typography.fontSize.xs, wordBreak: 'break-word' }}>
                {authErrorDetails}
              </p>
            ) : null}
            <PrimaryButton fullWidth onClick={() => WebApp.close()}>
              Закрыть
            </PrimaryButton>
            </GlassCard>
          </div>
        </div>
      </SafeAreaProvider>
    );
  }

  const routeFallback = (
    <div className="page-transition" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.12)', borderTop: `3px solid ${theme.colors.dark.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );
  const withBoundary = (node: React.ReactNode) => <ErrorBoundary>{node}</ErrorBoundary>;

  return (
    <SafeAreaProvider>
      <Router>
        <div className="min-h-screen bg-app safe-bottom">
          {showSmoke ? <div className="smoke-overlay" /> : null}
          <div className="aurora a1" />
          <div className="aurora a2" />
          <div className="noise" />
          <div className="hitech-grid" />
          <div className="hitech-scan" />
          <div className="hitech-vignette" />
          <div className="app-content">
            <Suspense fallback={routeFallback}>
              {!user.ageVerified ? (
                <Routes>
                  <Route path="/age" element={withBoundary(<AgeVerify />)} />
                  <Route path="*" element={<Navigate to="/age" replace />} />
                </Routes>
              ) : (
                <Routes>
                  <Route path="/" element={<Navigate to="/home" replace />} />
                  <Route path="/home" element={withBoundary(<AppShell><Home /></AppShell>)} />
                  <Route path="/categories" element={withBoundary(<AppShell><Categories /></AppShell>)} />
                  <Route path="/brands" element={withBoundary(<AppShell><Brands /></AppShell>)} />
                  <Route path="/catalog" element={withBoundary(<AppShell><Catalog /></AppShell>)} />
                  <Route path="/product/:id" element={withBoundary(<AppShell showMenu={false}><Product /></AppShell>)} />
                  <Route path="/cart" element={withBoundary(<AppShell showMenu={false}><Cart /></AppShell>)} />
                  <Route path="/checkout" element={withBoundary(<AppShell showMenu={false}><Checkout /></AppShell>)} />
                  <Route path="/orders" element={withBoundary(<AppShell><Orders /></AppShell>)} />
                  <Route path="/order/:id" element={withBoundary(<AppShell showMenu={false}><OrderDetails /></AppShell>)} />
                  <Route path="/favorites" element={withBoundary(<AppShell><Favorites /></AppShell>)} />
                  <Route path="/referral" element={withBoundary(<AppShell><Referral /></AppShell>)} />
                  <Route path="/support" element={withBoundary(<AppShell><Support /></AppShell>)} />
                  <Route path="/promotions" element={withBoundary(<AppShell><Promotions /></AppShell>)} />
                  <Route path="/bonuses" element={withBoundary(<AppShell><Bonuses /></AppShell>)} />
                  <Route path="/fortune" element={withBoundary(<AppShell><FortuneWheel /></AppShell>)} />
                  <Route path="/bundle" element={withBoundary(<AppShell showMenu={false}><BundleBuilder /></AppShell>)} />
                  <Route path="/profile" element={withBoundary(<AppShell><Account /></AppShell>)} />
                  <Route path="/courier" element={(user.status === 'courier' || user.status === 'admin') ? withBoundary(<AppShell><Courier /></AppShell>) : <Navigate to="/home" replace />} />
                  <Route path="/admin" element={user.status === 'admin' ? withBoundary(<AppShell><Admin /></AppShell>) : <Navigate to="/home" replace />} />
                  <Route path="/courier-registration" element={user.status === 'admin' ? withBoundary(<AppShell><CourierRegistration /></AppShell>) : <Navigate to="/home" replace />} />
                  <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
              )}
            </Suspense>
          </div>
        </div>
      </Router>
    </SafeAreaProvider>
  );
}

export default App;
