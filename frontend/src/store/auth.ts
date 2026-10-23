import { create } from 'zustand';
import type { AuthUser } from '../api/types';

interface AuthState { user: AuthUser | null; token: string | null; setSession: (user: AuthUser, token: string) => void; logout: () => void }
const KEY = 'seatview.session';
function load(): { user: AuthUser | null; token: string | null } {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* ignorar */ }
  return { user: null, token: null };
}
export const useAuthStore = create<AuthState>((set) => ({
  ...load(),
  setSession: (user, token) => { localStorage.setItem(KEY, JSON.stringify({ user, token })); set({ user, token }); },
  logout: () => { localStorage.removeItem(KEY); set({ user: null, token: null }); },
}));
