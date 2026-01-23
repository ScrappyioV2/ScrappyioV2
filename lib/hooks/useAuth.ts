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

    // Helper: Fetch Role
    const fetchUserRole = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        if (error || !data) return null
        return data as UserRole
      } catch (err) {
        return null
      }
    }

    // 1. Initial Session Check
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!isMounted) return

        if (session?.user) {
          setUser(session.user)
          const role = await fetchUserRole(session.user.id)
          if (isMounted) setUserRole(role)
        }
      } catch (error) {
        console.error('Session check failed', error)
      } finally {
        // ✅ CRITICAL FIX: Always stop loading after initial check
        if (isMounted) setLoading(false)
      }
    }

    checkSession()

    // 2. Realtime Listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        
        if (session?.user) {
          setUser(session.user)
          // Only fetch role if we don't have it yet or user changed
          if (!userRole || userRole.user_id !== session.user.id) {
             const role = await fetchUserRole(session.user.id)
             if (isMounted) setUserRole(role)
          }
        } else {
          setUser(null)
          setUserRole(null)
        }
        
        // ✅ CRITICAL FIX: Force loading to false when auth state changes
        // This stops the infinite spinner immediately upon login
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