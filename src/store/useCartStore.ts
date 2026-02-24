import { create } from 'zustand';

const STORAGE_KEY = 'cart';

interface CartItem {
  id: string;
  productId: string;
  variant?: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  quantity: number;
  image: string;
}

interface Cart {
  id: string;
  city: string;
  items: CartItem[];
  total: number;
}

interface CartState {
  cart: Cart | null;
  isLoading: boolean;
  setCart: (cart: Cart) => void;
  clearCart: () => void;
  setLoading: (loading: boolean) => void;
}

function readInitialCart(): Cart | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.id || !parsed.city || !Array.isArray(parsed.items)) return null;
    return parsed as Cart;
  } catch {
    return null;
  }
}

export const useCartStore = create<CartState>((set) => ({
  cart: readInitialCart(),
  isLoading: false,
  setCart: (cart) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
    }
    set({ cart });
  },
  clearCart: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
    set({ cart: null });
  },
  setLoading: (loading) => set({ isLoading: loading })
}));
