import React, { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const _setSession = useAuthStore((s) => s._setSession);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      _setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      _setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
};

export const useAuth = () => {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);
  return { session, user, loading, signOut };
};
