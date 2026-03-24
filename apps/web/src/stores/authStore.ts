import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens } from '@apiforge/shared';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  setAuth: (user: User, tokens: AuthTokens) => void;
  setAnonymous: (user: User) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isAnonymous: false,
      
      setAuth: (user, tokens) => set({ 
        user, 
        tokens, 
        isAuthenticated: true, 
        isAnonymous: false 
      }),
      
      setAnonymous: (user) => set({ 
        user, 
        tokens: null, 
        isAuthenticated: true, 
        isAnonymous: true 
      }),
      
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),
      
      logout: () => set({ 
        user: null, 
        tokens: null, 
        isAuthenticated: false, 
        isAnonymous: false 
      }),
      
      clearAuth: () => set({ 
        user: null, 
        tokens: null, 
        isAuthenticated: false, 
        isAnonymous: false 
      }),
    }),
    {
      name: 'apiforge-auth',
    }
  )
);
