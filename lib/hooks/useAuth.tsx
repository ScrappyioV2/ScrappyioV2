'use client'

import { useEffect, useState, useRef, createContext, useContext, ReactNode } from 'react'
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

type AuthContextType = {
  user: User | null
  userRole: UserRole | null
  loading: boolean
  logout: () => Promise<void>
  isAdmin: boolean
  hasPageAccess: (permissionKey: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const loadedUserId = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchUserRole = async (userId: string) => {
      if (loadedUserId.current === userId && userRole) return

      try {
        const { data } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        if (isMounted && data) {
          console.log(`[Auth] Role Loaded: ${data.role}`);
          setUserRole(data as UserRole)
          loadedUserId.current = userId
        }
      } catch (err) {
        console.error("Role fetch failed", err)
      }
    }

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (isMounted) {
          if (session?.user) {
            setUser(session.user)
            await fetchUserRole(session.user.id) 
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        if (session?.user) {
          setUser(session.user)
          if (loadedUserId.current !== session.user.id) {
             await fetchUserRole(session.user.id)
          }
        } else {
          setUser(null)
          setUserRole(null)
          loadedUserId.current = null
        }
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
    loadedUserId.current = null
    router.push('/login')
  }

  // ✅ STRICT PERMISSION CHECKER
  const hasPageAccess = (permissionKey: string): boolean => {
    // 1. Safety Check
    if (!userRole) return false;
    
    // 2. ADMIN BYPASS: Only if role is EXACTLY 'admin'
    if (userRole.role === 'admin') return true; 

    // 3. Public Pages
    if (permissionKey === 'public') return true;

    // 4. Admin Only Pages (Strict Block)
    if (permissionKey === 'admin-access') return false;

    // 5. REGULAR USER CHECK:
    // Ensure we are checking the actual allowed_pages array
    const pages = Array.isArray(userRole.allowed_pages) ? userRole.allowed_pages : [];
    
    return (
      pages.includes('*') || 
      pages.includes('all') || 
      pages.includes(permissionKey)
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      loading,
      logout,
      isAdmin: userRole?.role === 'admin',
      hasPageAccess
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    return useAuthFallback() 
  }
  return context
}

function useAuthFallback() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user)
      setLoading(false)
    })
  }, [])

  return {
    user,
    userRole: null,
    loading,
    logout: async () => {},
    isAdmin: false,
    hasPageAccess: () => false
  }
}