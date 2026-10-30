import { create } from 'zustand';
import type { AuthUser } from '../api/types';

interface AuthState { user: AuthUser | null; token: string | null; setSession: (user: AuthUser, token: string, remember?: boolean) => void; logout: () => void }
const KEY = 'seatview.session';
/** "Mantener la sesión iniciada" guarda en localStorage; si no, la sesión dura lo que la pestaña (sessionStorage). */
function load(): { user: AuthUser | null; token: string | null } {
  for (const storage of [localStorage, sessionStorage]) {
    try { const raw = storage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* ignorar */ }
  }
  return { user: null, token: null };
}
function clear() { for (const storage of [localStorage, sessionStorage]) { try { storage.removeItem(KEY); } catch { /* ignorar */ } } }
export const useAuthStore = create<AuthState>((set) => ({
  ...load(),
  setSession: (user, token, remember = true) => {
    clear();
    try { (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify({ user, token })); } catch { /* sin almacenamiento: solo en memoria */ }
    set({ user, token });
  },
  logout: () => { clear(); set({ user: null, token: null }); },
}));
