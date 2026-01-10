import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient | null = null

export const getSupabaseClient = () => {
  if (typeof window === 'undefined') return null

  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    supabase = createClient(url, key)
  }

  return supabase
}
