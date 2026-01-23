'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

export type UserRole = {
  id: string
  user_id: string
  email: string
  full_name: string | null
  role: 'admin' | 'validation' | 'purchase' | 'viewer' | string
  allowed_pages: string[]
  is_active: boolean
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    // 1. Define the role fetcher to reuse it
    const fetchUserRole = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        if (error) {
          console.warn('Error fetching role:', error.message)
          return null
        }
        return data as UserRole
      } catch (err) {
        return null
      }
    }

    // 2. Initial Session Check
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!isMounted) return

        if (session?.user) {
          setUser(session.user)
          const role = await fetchUserRole(session.user.id)
          if (isMounted) setUserRole(role)
        }
      } catch (error) {
        console.error('Session check failed', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    checkSession()

    // 3. Realtime Listener (The Fix: Now handles loading state)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        
        // console.log('Auth event:', event) // Uncomment for debugging

        if (session?.user) {
          setUser(session.user)
          const role = await fetchUserRole(session.user.id)
          if (isMounted) setUserRole(role)
        } else {
          setUser(null)
          setUserRole(null)
        }
        
        // ✅ CRITICAL FIX: Ensure loading is disabled after any auth event
        setLoading(false)
      }
    )

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserRole(null)
    router.push('/login')
  }

  return {
    user,
    userRole,
    loading,
    logout,
    isAdmin: userRole?.role === 'admin',
  }
}