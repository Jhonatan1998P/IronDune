import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthStoreState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  _setSession: (session: Session | null) => void;
  _setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStoreState>()((set) => ({
  session: null,
  user: null,
  loading: true,

  signOut: async () => {
    await supabase.auth.signOut();
  },

  _setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  _setLoading: (loading) => set({ loading }),
}));

let initialized = false;

export function initAuthStore() {
  if (initialized) return;
  initialized = true;

  supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState()._setSession(session);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState()._setSession(session);
  });
}
