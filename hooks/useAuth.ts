import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
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
