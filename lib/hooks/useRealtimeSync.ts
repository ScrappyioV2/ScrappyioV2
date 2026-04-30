import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { KeyedMutator } from 'swr';

export function useRealtimeSync(
  table: string,
  mutate: KeyedMutator<any>,
  channelName?: string
) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(channelName || `swr-${table}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => mutate(), 500);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          mutate();
        }
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [table, mutate, channelName]);
}
