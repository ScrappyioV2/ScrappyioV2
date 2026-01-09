// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

export const getSupabaseClient = () => {
  if (typeof window === 'undefined') return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase env variables missing')
    return null
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}
