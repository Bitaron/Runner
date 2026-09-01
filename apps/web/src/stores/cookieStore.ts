import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Cookie } from '@apiforge/shared';

interface CookieState {
  cookies: Cookie[];
  setCookies: (cookies: Cookie[]) => void;
  addCookie: (cookie: Cookie) => void;
  updateCookie: (index: number, updates: Partial<Cookie>) => void;
  removeCookie: (index: number) => void;
  clearCookies: (domain?: string) => void;
  getCookiesForUrl: (url: string) => Cookie[];
  upsertCookiesFromResponse: (cookies: Cookie[], requestUrl: string) => void;
}

const domainMatches = (cookieDomain: string | undefined, urlHost: string): boolean => {
  if (!cookieDomain) return true; // host-only? treat as match for now
  const cd = cookieDomain.replace(/^\./, '').toLowerCase();
  const host = urlHost.toLowerCase();
  return host === cd || host.endsWith(`.${cd}`);
};

export const useCookieStore = create<CookieState>()(
  persist(
    (set, get) => ({
      cookies: [],

      setCookies: (cookies) => set({ cookies }),

      addCookie: (cookie) =>
        set((state) => ({
          cookies: [...state.cookies, cookie],
        })),

      updateCookie: (index, updates) =>
        set((state) => ({
          cookies: state.cookies.map((c, i) => (i === index ? { ...c, ...updates } : c)),
        })),

      removeCookie: (index) =>
        set((state) => ({
          cookies: state.cookies.filter((_, i) => i !== index),
        })),

      clearCookies: (domain) =>
        set((state) => ({
          cookies: domain ? state.cookies.filter((c) => c.domain !== domain) : [],
        })),

      getCookiesForUrl: (url: string) => {
        try {
          const host = new URL(url).hostname;
          const now = new Date();
          return get().cookies.filter((c) => {
            if (c.expires) {
              const exp = new Date(c.expires);
              if (!isNaN(exp.getTime()) && exp < now) return false;
            }
            return domainMatches(c.domain, host) && (!c.path || url.includes(c.path));
          });
        } catch {
          return [];
        }
      },

      upsertCookiesFromResponse: (cookies, requestUrl) => {
        if (!cookies.length) return;
        let host = '';
        try { host = new URL(requestUrl).hostname; } catch {}
        set((state) => {
          const next = [...state.cookies];
          for (const nc of cookies) {
            const domain = nc.domain || host;
            const idx = next.findIndex((c) => c.name === nc.name && (c.domain || host) === domain && (c.path || '/') === (nc.path || '/'));
            if (idx >= 0) next[idx] = { ...next[idx], ...nc, domain };
            else next.push({ ...nc, domain });
          }
          return { cookies: next };
        });
      },
    }),
    {
      name: 'apiforge-cookies',
      partialize: (state) => ({ cookies: state.cookies }),
    }
  )
);
