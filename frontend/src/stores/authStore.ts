import { create } from 'zustand';
import type { User } from '../types';
import client from '../api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,

  login: async (email: string, password: string) => {
    const { data } = await client.post('/auth/login', { email, password });
    localStorage.setItem('token', data.access_token);
    set({ user: data.user, token: data.access_token, isAuthenticated: true });
  },

  register: async (email: string, password: string) => {
    const { data } = await client.post('/auth/register', { email, password });
    localStorage.setItem('token', data.access_token);
    set({ user: data.user, token: data.access_token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    try {
      set({ loading: true });
      const { data } = await client.get('/auth/me');
      set({ user: data, loading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, loading: false });
    }
  },
}));