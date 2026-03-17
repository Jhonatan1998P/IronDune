import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthStoreState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initialized: boolean;
  signOut: () => Promise<void>;
  bootstrap: () => void;
}

let isBootstrapping = false;

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  session: null,
  user: null,
  loading: true,
  initialized: false,
  signOut: async () => {
    await supabase.auth.signOut();
  },
  bootstrap: () => {
    if (get().initialized || isBootstrapping) return;
    isBootstrapping = true;
    set({ loading: true });

    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
        initialized: true,
      });
      isBootstrapping = false;
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
        initialized: true,
      });
      isBootstrapping = false;
    });
  },
}));
