import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const ROLE_PRIORITY = ['Dev', 'Admin', 'Moderador', 'Premium', 'Usuario'];
const DEFAULT_ROLE = 'Usuario';

const normalizeRole = (role?: string | null) => {
  if (!role || typeof role !== 'string') return DEFAULT_ROLE;
  const trimmed = role.trim();
  if (!trimmed) return DEFAULT_ROLE;
  const match = ROLE_PRIORITY.find(r => r.toLowerCase() === trimmed.toLowerCase());
  return match || DEFAULT_ROLE;
};

export const useProfileRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<string>(DEFAULT_ROLE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setRole(DEFAULT_ROLE);
      return;
    }

    let isMounted = true;
    const loadRole = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.warn('[Role] Failed to load profile role:', error.message);
        setRole(DEFAULT_ROLE);
        setLoading(false);
        return;
      }

      if (!data) {
        setRole(DEFAULT_ROLE);
        setLoading(false);
        return;
      }

      setRole(normalizeRole(data?.role));
      setLoading(false);
    };

    loadRole();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const isPrivileged = useMemo(() => ['Dev', 'Admin', 'Moderador'].includes(role), [role]);

  return { role, isPrivileged, loading };
};
