import axios from 'axios';
import { useToastStore } from '../store/useToastStore';
import { useAuthStore } from '../store/useAuthStore';

const API_BASE_URL = (import.meta.env?.VITE_API_URL as string) || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  let token: string | null = null;
  try {
    token = useAuthStore.getState().token;
  } catch {
  }
  if (!token) {
    try {
      token = localStorage.getItem('token');
    } catch {
      token = null;
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    console.error('API error:', error);
    try {
      const url = String(error?.config?.url || '');
      const isNetwork = !error?.response;
      const isTimeout = error?.code === 'ECONNABORTED' || String(error?.message || '').toLowerCase().includes('timeout');
      const status = error?.response?.status;
      const data = error?.response?.data;
      if (status === 401 && (url.includes('/auth/dev') || url.includes('/auth/verify') || url.includes('/auth/me'))) {
        if (url.includes('/auth/me')) {
          try {
            useAuthStore.getState().logout();
          } catch {
          }
        }
        return Promise.reject(error);
      }
      const serverMessage = typeof data?.error === 'string' ? data.error : '';
      const code = typeof data?.code === 'string' ? data.code : '';
      const missing = Array.isArray(data?.missing) ? data.missing : [];

      let message = serverMessage;
      if (!message) {
        if (isTimeout) message = 'Сервер не отвечает (таймаут)';
        else if (isNetwork) message = 'Нет соединения с сервером';
        if (status === 401) message = 'Требуется авторизация';
        else if (status === 403) message = 'Доступ запрещён';
        else if (status === 404) message = 'Не найдено';
        else if (status === 409) message = 'Недостаточно товара на складе';
        else if (status === 503 && code === 'SHEETS_NOT_CONFIGURED') {
          message = missing.length ? `Sheets не настроен: ${missing.join(', ')}` : 'Sheets не настроен';
        } else message = 'Ошибка запроса';
      }

      useToastStore.getState().push(message, 'error');
    } catch {
      // ignore
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  me: () => api.get('/auth/me'),
  verify: (initData: string) =>
    api.post('/auth/verify', { initData }),
  
  ageVerify: (initData: string) =>
    api.post('/auth/age-verify', { initData }),

  dev: () => api.post('/auth/dev'),
};

export const catalogAPI = {
  getProducts: (params: any) =>
    api.get('/catalog', { params }),
  
  getCategories: (city: string) =>
    api.get('/catalog/categories', { params: { city } }),
  
  getBrands: (city: string) =>
    api.get('/catalog/brands', { params: { city } }),
};

export const productAPI = {
  getById: (id: string, city: string) =>
    api.get(`/product/${encodeURIComponent(id)}`, { params: { city } }),
};

export const cartAPI = {
  getCart: (city: string) =>
    api.get('/cart', { params: { city } }),
  
  addItem: (data: any) =>
    api.post('/cart/add', data),
  
  removeItem: (itemId: string) =>
    api.post('/cart/remove', { itemId }),

  updateItem: (itemId: string, quantity: number) =>
    api.post('/cart/update', { itemId, quantity }),

  clear: (city: string) =>
    api.post('/cart/clear', { city }),
};

export const orderAPI = {
  createOrder: (data: any, idempotencyKey?: string) =>
    api.post('/order/create', data, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined),
  
  confirmOrder: (data: any) =>
    api.post('/order/confirm', data),
  
  processPayment: (data: any) =>
    api.post('/order/payment', data),
  
  getHistory: (city: string) =>
    api.get('/order/history', { params: { city } }),

  getById: (id: string, city: string) =>
    api.get(`/order/${encodeURIComponent(id)}`, { params: { city } }),
};

export const couriersAPI = {
  list: (city: string) =>
    api.get('/couriers', { params: { city } }),
};

export const courierAPI = {
  orders: (city: string) => api.get('/courier/orders', { params: { city } }),
  updateOrderStatus: (orderId: string, status: string, city: string) => api.post('/courier/orders/status', { orderId, status, city }),
};

export const adminAPI = {
  orders: (city: string) => api.get('/admin/orders', { params: { city } }),
  couriers: (city: string) => api.get('/admin/couriers', { params: { city } }),
  promos: (city: string) => api.get('/admin/promos', { params: { city } }),
  stats: (city: string, period: string) => api.get('/admin/stats', { params: { city, period } }),
  updateOrderStatus: (orderId: string, status: string, city: string) => api.post('/admin/orders/status', { orderId, status, city }),
  toggleCourierStatus: (courierId: string, active: boolean, city: string) => api.post('/admin/couriers/status', { courierId, active, city }),
  togglePromoStatus: (promoId: string, active: boolean) => api.post('/admin/promos/status', { promoId, active }),
  deletePromo: (promoId: string) => api.delete(`/admin/promos/${encodeURIComponent(promoId)}`),
  addCourier: (payload: { city: string; courierId: string; name: string; tgId?: string; timeFrom?: string; timeTo?: string }) => api.post('/admin/couriers/add', payload),
};

export const favoritesAPI = {
  list: (city: string) =>
    api.get('/favorites', { params: { city } }),
  toggle: (productId: string, enabled: boolean, product?: any) =>
    api.post('/favorites/toggle', { productId, enabled, product }),
};

export const bonusesAPI = {
  balance: () => api.get('/bonuses/balance'),
  history: () => api.get('/bonuses/history'),
  apply: (amount: number) => api.post('/bonuses/apply', { amount }),
};

export const referralAPI = {
  info: () => api.get('/referral/info'),
  claim: (ref: string) => api.post('/referral/claim', { ref }),
};

export const fortuneAPI = {
  state: () => api.get('/fortune/state'),
  spin: () => api.post('/fortune/spin'),
};

export const analyticsAPI = {
  event: (event: string, params?: any) => api.post('/analytics/event', { event, params }),
};

export const configAPI = {
  get: () => api.get('/config'),
};

export default api;
