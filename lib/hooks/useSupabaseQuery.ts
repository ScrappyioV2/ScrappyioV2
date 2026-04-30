import useSWR, { SWRConfiguration } from 'swr';
import { supabase } from '@/lib/supabaseClient';

interface UseSupabaseQueryOptions extends SWRConfiguration {
  table: string;
  select?: string;
  filters?: Record<string, any>;
  order?: { column: string; ascending: boolean };
  enabled?: boolean;
}

export function useSupabaseQuery<T = any>({
  table,
  select = '*',
  filters = {},
  order,
  enabled = true,
  ...swrOptions
}: UseSupabaseQueryOptions) {
  const key = enabled ? `${table}:${select}:${JSON.stringify(filters)}:${JSON.stringify(order)}` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    key,
    async () => {
      let query = supabase.from(table).select(select);

      Object.entries(filters).forEach(([col, val]) => {
        if (Array.isArray(val)) {
          query = query.in(col, val);
        } else if (val === null) {
          query = query.is(col, null);
        } else {
          query = query.eq(col, val);
        }
      });

      if (order) {
        query = query.order(order.column, { ascending: order.ascending });
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
      return (data ?? []) as T[];
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
      errorRetryCount: 3,
      errorRetryInterval: 3000,
      loadingTimeout: 15000,
      ...swrOptions,
    }
  );

  return {
    data: data ?? [],
    error,
    isLoading,
    isValidating,
    isError: !!error,
    mutate,
    refresh: () => mutate(),
  };
}
