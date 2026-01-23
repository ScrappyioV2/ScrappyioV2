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

    // Helper: Fetch Role (Runs in background)
    const fetchUserRole = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        if (isMounted && data) {
          setUserRole(data as UserRole)
        }
      } catch (err) {
        console.error("Background role fetch failed", err)
      }
    }

    // 1. Check Session
    const initAuth = async () => {
      try {
        // Get session from local storage immediately
        const { data: { session } } = await supabase.auth.getSession()
        
        if (isMounted) {
          if (session?.user) {
            setUser(session.user)
            // ⚡️ NON-BLOCKING: Fetch role in background
            fetchUserRole(session.user.id) 
          }
          // ✅ STOP LOADING IMMEDIATELY
          setLoading(false) 
        }
      } catch (error) {
        if (isMounted) setLoading(false)
      }
    }

    initAuth()

    // 2. Listen for Changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        
        if (session?.user) {
          setUser(session.user)
          // ⚡️ NON-BLOCKING
          if (!userRole) fetchUserRole(session.user.id)
        } else {
          setUser(null)
          setUserRole(null)
        }
        
        // ✅ STOP LOADING IMMEDIATELY
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