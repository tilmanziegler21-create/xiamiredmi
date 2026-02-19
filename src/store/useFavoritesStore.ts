import { create } from 'zustand';
import { favoritesAPI } from '../services/api';

export type FavoriteItem = {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  image: string;
};

type FavoritesState = {
  city: string | null;
  items: FavoriteItem[];
  ids: Record<string, true>;
  isLoading: boolean;
  error: string | null;
  load: (city: string) => Promise<void>;
  isFavorite: (productId: string) => boolean;
  toggle: (payload: { city: string; product: FavoriteItem; enabled: boolean }) => Promise<void>;
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  city: null,
  items: [],
  ids: {},
  isLoading: false,
  error: null,
  load: async (city) => {
    set({ isLoading: true, error: null, city });
    try {
      const resp = await favoritesAPI.list(city);
      const items: FavoriteItem[] = resp.data.favorites || resp.data.items || [];
      const ids: Record<string, true> = {};
      for (const it of items) ids[String(it.id)] = true;
      set({ items, ids, isLoading: false, error: null, city });
    } catch (e) {
      console.error('Failed to load favorites:', e);
      set({ isLoading: false, error: 'FAVORITES_LOAD_FAILED' });
    }
  },
  isFavorite: (productId) => Boolean(get().ids[String(productId)]),
  toggle: async ({ city, product, enabled }) => {
    const productId = String(product.id);
    const prevIds = get().ids;
    const prevItems = get().items;

    const nextIds = { ...prevIds };
    let nextItems = prevItems;
    if (enabled) {
      nextIds[productId] = true;
      if (!prevIds[productId]) {
        nextItems = [product, ...prevItems.filter((x) => String(x.id) !== productId)];
      }
    } else {
      delete nextIds[productId];
      nextItems = prevItems.filter((x) => String(x.id) !== productId);
    }
    set({ ids: nextIds, items: nextItems, city });

    try {
      await favoritesAPI.toggle(productId, enabled, product);
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
      set({ ids: prevIds, items: prevItems });
      throw e;
    }
  },
}));
