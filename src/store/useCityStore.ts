import { create } from 'zustand';

const STORAGE_KEY = 'city';

type CityState = {
  city: string | null;
  setCity: (city: string) => void;
  ensureCity: (cities: string[]) => string | null;
  clearCity: () => void;
};

function readInitialCity(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? String(raw) : null;
  } catch {
    return null;
  }
}

export const useCityStore = create<CityState>((set, get) => ({
  city: readInitialCity(),
  setCity: (city) => {
    try {
      localStorage.setItem(STORAGE_KEY, city);
    } catch {
      // ignore
    }
    set({ city });
  },
  ensureCity: (cities) => {
    const current = get().city;
    if (current && cities.includes(current)) return current;
    const next = cities[0] ? String(cities[0]) : null;
    if (next) get().setCity(next);
    return next;
  },
  clearCity: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({ city: null });
  },
}));

