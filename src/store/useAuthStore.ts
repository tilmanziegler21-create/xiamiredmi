import { create } from 'zustand';

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  setUser: (user, token) => set({ user, token }),
  setAgeVerified: (verified) => set((state) => ({
    user: state.user ? { ...state.user, ageVerified: verified } : null
  })),
  logout: () => {
    try {
      localStorage.removeItem('token');
    } catch {
      // ignore
    }
    set({ user: null, token: null });
  },
  setLoading: (loading) => set({ isLoading: loading })
}));
