import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { normalizeError, shortId } from '../lib/diagnosticLogger';

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
    console.log('[AuthStore] Sign out started');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[AuthStore] Sign out failed', {
          error: normalizeError(error),
        });
        throw error;
      }
      console.log('[AuthStore] Sign out succeeded');
    } catch (error) {
      console.error('[AuthStore] Sign out exception', {
        error: normalizeError(error),
      });
      throw error;
    }
  },
  bootstrap: () => {
    if (get().initialized || isBootstrapping) return;
    isBootstrapping = true;
    set({ loading: true });

    console.log('[AuthStore] Bootstrap started');

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[AuthStore] getSession failed', {
          error: normalizeError(error),
        });
      }

      console.log('[AuthStore] getSession result', {
        hasSession: Boolean(session),
        userId: shortId(session?.user?.id),
      });

      set({
        session,
        user: session?.user ?? null,
        loading: false,
        initialized: true,
      });
      isBootstrapping = false;
    });

    supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthStore] Auth state changed', {
        event,
        hasSession: Boolean(session),
        userId: shortId(session?.user?.id),
      });

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
