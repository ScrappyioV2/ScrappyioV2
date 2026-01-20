'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | '', text: string }>({ type: '', text: '' })
  const router = useRouter()

  // Check if user is already logged in
  useEffect(() => {
    if (!supabase) return

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
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

      // Check if user has a role assigned
      // Check if user has a role assigned
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('email', email) // ✅ Use email instead of user_id
        .single()

      console.log('Role query result:', { roleData, roleError }) // ✅ Add debug log

      if (!roleData) {
        await supabase.auth.signOut()
        throw new Error('Your account is not activated yet. Please contact the administrator.')
      }

      if (!roleData.is_active) {
        await supabase.auth.signOut()
        throw new Error('Your account has been deactivated. Please contact the administrator.')
      }

      // Auto-redirect to dashboard
      router.push('/dashboard')
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white shadow-2xl rounded-2xl p-8 border border-gray-100">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🚀 Scrappy V2</h1>
            <p className="text-gray-600">Sign in to your account</p>
            <p className="text-xs text-gray-500 mt-2">Secure authentication powered by Supabase</p>
          </div>

          {/* Message Display */}
          {message.text && (
            <div className="mb-4 p-3 rounded-lg text-sm">
              <div className={message.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300 p-3 rounded-lg'
                : 'bg-red-100 text-red-800 border border-red-300 p-3 rounded-lg'}>
                {message.text}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
                minLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg transition transform hover:scale-1.02 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing In...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Info Message */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800 text-center">
              🔒 <strong>Note:</strong> Sign up is disabled. Contact your administrator to create an account.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          © 2026 Scrappy V2. All rights reserved.
        </p>
      </div>
    </div>
  )
}
