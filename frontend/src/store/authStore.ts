import { create } from 'zustand';
import { User, LoginCredentials } from '../types';
import { authApi } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  init: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login(credentials);
      const { user, token } = response.data;

      localStorage.setItem('netbipi_token', token);
      localStorage.setItem('netbipi_user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      const message = error.response?.data?.error || 'Erro ao realizar login';
      set({ isLoading: false, error: message, isAuthenticated: false });
      throw new Error(message);
    }
  },

  logout: () => {
    localStorage.removeItem('netbipi_token');
    localStorage.removeItem('netbipi_user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  init: async () => {
    const token = localStorage.getItem('netbipi_token');
    const savedUser = localStorage.getItem('netbipi_user');

    if (!token) {
      set({ isLoading: false });
      return;
    }

    set({ isLoading: true });

    try {
      if (savedUser) {
        const user = JSON.parse(savedUser) as User;
        set({ user, token, isAuthenticated: true });
      }

      const response = await authApi.getMe();
      const user = response.data;

      localStorage.setItem('netbipi_user', JSON.stringify(user));
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      localStorage.removeItem('netbipi_token');
      localStorage.removeItem('netbipi_user');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));

// Expose logout for use in axios interceptor
(window as unknown as Record<string, unknown>).__netbipi_logout = () => {
  useAuthStore.getState().logout();
};
