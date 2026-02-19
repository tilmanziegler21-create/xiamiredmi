import { create } from 'zustand';

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
  setLoading: (loading: boolean) => void;
}

export const useCartStore = create<CartState>((set) => ({
  cart: null,
  isLoading: false,
  setCart: (cart) => set({ cart }),
  setLoading: (loading) => set({ isLoading: loading })
}));
