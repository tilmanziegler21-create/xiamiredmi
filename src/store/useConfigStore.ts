import { create } from 'zustand';
import { configAPI } from '../services/api';

export type AppConfig = {
  cities: Array<{ code: string; title: string; currencySymbol?: string; managerChatUrl?: string }>;
  cityCodes?: string[];
  currency: string;
  currencySymbol?: string;
  groupUrl: string;
  reviewsUrl: string;
  reservationTtlMs: number;
  bonusMultiplier?: number;
  quantityDiscount?: { minQty: number; unitPrice: number };
  support: {
    managerUsername: string;
    managerPhone: string;
    supportUrl?: string;
    faqBlocks?: Array<{ title: string; text: string }>;
  };
  banners?: Array<{ title?: string; subtitle?: string; gradient?: string; imageUrl: string; linkType?: string; linkTarget?: string }>;
  categoryTiles?: Array<{ slug: string; title: string; imageUrl: string; badgeText?: string }>;
  pickupPoints?: Array<{ id: string; title: string; address: string }>;
  referralRules?: { title: string; description: string; ctaText?: string };
  promos?: Array<{ id: string; title: string; description: string; type: string; value: number; minTotal?: number; startsAt?: string; endsAt?: string }>;
  contests?: Array<{ id: string; title: string; description: string; ctaText?: string; route?: string }>;
};

type ConfigState = {
  config: AppConfig | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<AppConfig | null>;
};

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  isLoading: false,
  error: null,
  load: async () => {
    if (get().isLoading) return get().config;
    set({ isLoading: true, error: null });
    try {
      const resp = await configAPI.get();
      set({ config: resp.data, isLoading: false, error: null });
      return resp.data;
    } catch (e) {
      console.error('Failed to load config:', e);
      set({ isLoading: false, error: 'CONFIG_LOAD_FAILED' });
      return null;
    }
  },
}));
