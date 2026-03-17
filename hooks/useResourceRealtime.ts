import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useResourceStore } from '../stores/resourceStore';

export const useResourceRealtime = () => {
  const { user } = useAuth();
  const applyServerSnapshot = useResourceStore((state) => state.applyServerSnapshot);
  const setConnected = useResourceStore((state) => state.setRealtimeConnected);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const bootstrapSnapshot = async () => {
      const { data, error } = await supabase
        .from('player_resources')
        .select('*')
        .eq('player_id', user.id)
        .single();

      if (!cancelled && !error && data) {
        applyServerSnapshot(data);
      }
    };

    bootstrapSnapshot();

    const channel = supabase
      .channel(`resources:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'player_resources',
        filter: `player_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.new) {
          applyServerSnapshot(payload.new as any);
        }
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      cancelled = true;
      setConnected(false);
      supabase.removeChannel(channel);
    };
  }, [user?.id, applyServerSnapshot, setConnected]);
};
