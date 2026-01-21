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

    const checkUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!isMounted) return

        if (error) {
          console.error('Auth error:', error)
          setUser(null)
          setUserRole(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)

          // Fetch user role
          const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', session.user.id)
            .single()

          if (!isMounted) return

          if (roleError) {
            console.error('Role fetch error:', roleError)
          }

          if (roleData && roleData.is_active) {
            setUserRole(roleData)
          } else {
            setUserRole(null)
            // If user has no active role, sign them out
            if (!roleData?.is_active) {
              await supabase.auth.signOut()
              setUser(null)
            }
          }
        } else {
          setUser(null)
          setUserRole(null)
        }
      } catch (error) {
        console.error('Unexpected auth error:', error)
        if (isMounted) {
          setUser(null)
          setUserRole(null)
        }
      } finally {
        // CRITICAL: Always set loading to false
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    checkUser()

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        console.log('Auth state changed:', event)

        if (session?.user) {
          setUser(session.user)

          const { data: roleData } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', session.user.id)
            .single()

          if (isMounted && roleData && roleData.is_active) {
            setUserRole(roleData)
          } else {
            setUserRole(null)
          }
        } else {
          setUser(null)
          setUserRole(null)
        }

        // Set loading false after auth change is processed
        if (isMounted) {
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const hasPageAccess = (pagePath: string): boolean => {
    if (!userRole) return false
    if (userRole.role === 'admin') return true
    if (userRole.allowed_pages.includes('*')) return true
    return userRole.allowed_pages.some(page => pagePath.includes(page))
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserRole(null)
    router.push('/')
  }

  return {
    user,
    userRole,
    loading,
    hasPageAccess,
    logout,
    isAdmin: userRole?.role === 'admin',
  }
}
