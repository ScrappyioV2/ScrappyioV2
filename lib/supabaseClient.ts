import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check your .env file.");
}

const CACHE_TTL = 30_000;
const queryCache = new Map<string, { body: string; status: number; statusText: string; headers: [string, string][]; ts: number }>();
const nativeFetch = globalThis.fetch.bind(globalThis);

// Tables that should NOT trigger cache invalidation (background/polling)
const IGNORE_TABLES = ['chat_user_presence', 'chat_participants', 'chat_messages', 'chat_conversations', 'user_activity_log'];

const shouldInvalidateCache = (url: string): boolean => {
  return !IGNORE_TABLES.some(table => url.includes(table));
};

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
  const method = (init?.method || 'GET').toUpperCase();
  const isRestApi = url.includes('/rest/v1/');

  if ((method === 'GET' || method === 'HEAD') && isRestApi) {
    const cacheKey = `${method}:${url}`;
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: new Headers(cached.headers),
      });
    }

    const response = await nativeFetch(input, init);
    if (response.ok) {
      const body = await response.text();
      const headers: [string, string][] = [];
      response.headers.forEach((v, k) => headers.push([k, v]));
      queryCache.set(cacheKey, { body, status: response.status, statusText: response.statusText, headers, ts: Date.now() });
      return new Response(body, { status: response.status, statusText: response.statusText, headers: new Headers(headers) });
    }
    return response;
  }

  if ((method === 'POST' || method === 'PATCH' || method === 'DELETE') && isRestApi) {
    if (shouldInvalidateCache(url)) {
      queryCache.clear();
    }
  }

  return nativeFetch(input, init);
};

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export default supabase;
