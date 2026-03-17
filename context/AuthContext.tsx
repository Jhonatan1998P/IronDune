import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

interface AuthContextType {
  session: ReturnType<typeof useAuthStore.getState>['session'];
  user: ReturnType<typeof useAuthStore.getState>['user'];
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return <>{children}</>;
};

export const useAuth = (): AuthContextType => {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const signOut = useAuthStore((state) => state.signOut);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return { session, user, loading, signOut };
};
