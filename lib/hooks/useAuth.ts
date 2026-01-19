'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import{supabase } from '@/lib/supabaseClient'

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
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        
        // Fetch user role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        
        if (roleData) {
          setUserRole(roleData)
        }
      }
      
      setLoading(false)
    }

    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', session.user.id)
            .single()
          
          if (roleData) {
            setUserRole(roleData)
          }
        } else {
          setUser(null)
          setUserRole(null)
        }
      }
    )

    return () => {
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
