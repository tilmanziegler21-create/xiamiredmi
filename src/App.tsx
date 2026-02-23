import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { useAuthStore } from './store/useAuthStore';
import { authAPI } from './services/api';
import { SafeAreaProvider, AppShell } from './ui';
import AgeVerify from './pages/AgeVerify';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Profile from './pages/Profile';
import Orders from './pages/Orders';
import OrderDetails from './pages/OrderDetails';
import Favorites from './pages/Favorites';
import Referral from './pages/Referral';
import Support from './pages/Support';
import Categories from './pages/Categories';
import Admin from './pages/Admin';
import Courier from './pages/Courier';
import Promotions from './pages/Promotions';
import Bonuses from './pages/Bonuses';
import FortuneWheel from './pages/FortuneWheel';
import CourierRegistration from './pages/CourierRegistration';

function App() {
  const { user, setUser, setLoading, isLoading } = useAuthStore();
  const authStartedRef = React.useRef(false);
  const [authErrorDetails, setAuthErrorDetails] = React.useState<string>('');

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
              localStorage.setItem('token', response.data.token);
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
            localStorage.setItem('token', response.data.token);
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

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0c0a1a 0%, #1a0c2e 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(255,45,85,0.26)',
              borderTop: '4px solid #ff2d55',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }} />
            <p style={{ color: '#ffffff', fontSize: '16px' }}>Авторизация...</p>
          </div>
        </div>
      </SafeAreaProvider>
    );
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0c0a1a 0%, #1a0c2e 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#ff3b30', marginBottom: '16px', fontSize: '16px' }}>Ошибка авторизации</p>
            {authErrorDetails ? (
              <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '16px', fontSize: '12px', maxWidth: 340, wordBreak: 'break-word' }}>
                {authErrorDetails}
              </p>
            ) : null}
            <button 
              onClick={() => WebApp.close()}
              style={{
                background: 'linear-gradient(135deg, #ff2d55 0%, #b0003a 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Router>
        <div className="min-h-screen bg-app safe-bottom">
          {!user.ageVerified ? (
            <Routes>
              <Route path="/age" element={<AgeVerify />} />
              <Route path="*" element={<Navigate to="/age" replace />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<AppShell><Home /></AppShell>} />
              <Route path="/categories" element={<AppShell><Categories /></AppShell>} />
              <Route path="/catalog" element={<AppShell><Catalog /></AppShell>} />
              <Route path="/product/:id" element={<AppShell showMenu={false}><Product /></AppShell>} />
              <Route path="/cart" element={<AppShell showMenu={false}><Cart /></AppShell>} />
              <Route path="/checkout" element={<AppShell showMenu={false}><Checkout /></AppShell>} />
              <Route path="/orders" element={<AppShell><Orders /></AppShell>} />
              <Route path="/order/:id" element={<AppShell showMenu={false}><OrderDetails /></AppShell>} />
              <Route path="/favorites" element={<AppShell><Favorites /></AppShell>} />
              <Route path="/referral" element={<AppShell><Referral /></AppShell>} />
              <Route path="/support" element={<AppShell><Support /></AppShell>} />
              <Route path="/promotions" element={<AppShell><Promotions /></AppShell>} />
              <Route path="/bonuses" element={<AppShell><Bonuses /></AppShell>} />
              <Route path="/fortune" element={<AppShell><FortuneWheel /></AppShell>} />
              <Route path="/profile" element={<AppShell><Profile /></AppShell>} />
              <Route path="/courier" element={(user.status === 'courier' || user.status === 'admin') ? <AppShell><Courier /></AppShell> : <Navigate to="/home" replace />} />
              <Route path="/admin" element={user.status === 'admin' ? <AppShell><Admin /></AppShell> : <Navigate to="/home" replace />} />
              <Route path="/courier-registration" element={user.status === 'admin' ? <AppShell><CourierRegistration /></AppShell> : <Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          )}
        </div>
      </Router>
    </SafeAreaProvider>
  );
}

export default App;
