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

          // ✅ Query user_roles table with correct columns
          const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('id, user_id, email, full_name, role, allowed_pages, is_active')
            .eq('user_id', session.user.id)
            .single()

          if (!isMounted) return

          if (roleError) {
            console.error('Role fetch error:', roleError)
            setUserRole(null)
          } else if (roleData && roleData.is_active) {
            setUserRole(roleData as UserRole)
          } else {
            setUserRole(null)
            // Sign out inactive users
            if (roleData && !roleData.is_active) {
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
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        console.log('Auth event:', event)

        if (session?.user) {
          setUser(session.user)

          const { data: roleData } = await supabase
            .from('user_roles')
            .select('id, user_id, email, full_name, role, allowed_pages, is_active')
            .eq('user_id', session.user.id)
            .single()

          if (isMounted && roleData && roleData.is_active) {
            setUserRole(roleData as UserRole)
          } else {
            setUserRole(null)
          }
        } else {
          setUser(null)
          setUserRole(null)
        }
      }
    )

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const hasPageAccess = (pageKey: string): boolean => {
    if (!userRole) return false
    if (userRole.role === 'admin') return true
    return (
      userRole.allowed_pages.includes('*') ||
      userRole.allowed_pages.includes('all') ||
      userRole.allowed_pages.includes(pageKey)
    )
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
