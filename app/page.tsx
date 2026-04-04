'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { APP_ROUTES } from '@/lib/config/routes'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | '', text: string }>({ type: '', text: '' })
  const router = useRouter()

  // Helper: Find first accessible route based on user permissions
  const getFirstAllowedRoute = (allowedPages: string[]): string => {
    // 1. Admin gets dashboard
    if (allowedPages.includes('*') || allowedPages.includes('all')) return '/dashboard'

    // 2. Flatten routes to search them
    const allRoutes = APP_ROUTES.flatMap(r => [r, ...(r.subRoutes || [])]);

    // 3. Find first route that matches user permissions
    const validRoute = allRoutes.find(route => allowedPages.includes(route.permission));
    
    return validRoute ? validRoute.path : '/dashboard';
  }

  // Check if user is already logged in
  useEffect(() => {
    if (!supabase) return
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // We let the dashboard guard handle redirection if they are already logged in
        router.push('/dashboard') 
      }
    }
    checkUser()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    if (!supabase) return

    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('email', email)
        .single()

      if (!roleData || !roleData.is_active) {
        await supabase.auth.signOut()
        throw new Error('Account inactive or not found.')
      }

      // --- SMART REDIRECT ---
      // Instead of blindly sending to /dashboard, send them to their workspace
      const nextPath = getFirstAllowedRoute(roleData.allowed_pages || []);
      router.push(nextPath);

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="w-full max-w-md">
        <div className="bg-[#111111] shadow-2xl rounded-2xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">🚀 Scrappy V2</h1>
            <p className="text-gray-500">Sign in to your account</p>
          </div>

          {message.text && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-500 mb-2">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="w-full px-4 py-3 border border-white/[0.06] rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-500 mb-2">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="w-full px-4 py-3 border border-white/[0.06] rounded-lg" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition">
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}