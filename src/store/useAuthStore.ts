import { create } from 'zustand';

const STORAGE_KEY = 'token';

interface User {
  tgId: string;
  username: string;
  firstName: string;
  ageVerified: boolean;
  status: string;
  bonusBalance: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User, token: string) => void;
  setAgeVerified: (verified: boolean) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

function readInitialToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? String(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: readInitialToken(),
  isLoading: false,
  setUser: (user, token) => {
    try {
      localStorage.setItem(STORAGE_KEY, token);
    } catch {
      // ignore
    }
    set({ user, token });
  },
  setAgeVerified: (verified) => set((state) => ({
    user: state.user ? { ...state.user, ageVerified: verified } : null
  })),
  logout: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem('cart');
    } catch {
    }
    set({ user: null, token: null });
  },
  setLoading: (loading) => set({ isLoading: loading })
}));
