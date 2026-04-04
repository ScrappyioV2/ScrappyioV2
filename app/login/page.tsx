'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const router = useRouter()

  useEffect(() => {
    if (!supabase) return

    const params = new URLSearchParams(window.location.search)
    if (params.get('logout') === 'true') return

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        window.location.href = '/dashboard'
      }
    }

    checkUser()
  }, [router])

  const handleAuth = async (e: React.FormEvent) => {
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

      console.log('✅ Auth successful, checking role...', email)

      // Check if user has a role assigned
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('email', email)
        .single()

      if (roleError) {
        console.error('❌ Role query error:', roleError)
        await supabase.auth.signOut()
        throw new Error(`Database error: ${roleError.message}. Please contact administrator.`)
      }

      if (!roleData) {
        await supabase.auth.signOut()
        throw new Error('Your account is not activated yet. Please contact the administrator.')
      }

      if (!roleData.is_active) {
        await supabase.auth.signOut()
        throw new Error('Your account has been deactivated. Please contact the administrator.')
      }

      console.log('✅ Role check passed')

      // ✅ CRITICAL FIX: Store role in localStorage for immediate access
      if (typeof window !== 'undefined') {
        localStorage.setItem('scrappy_user_role', JSON.stringify(roleData))
      }

      // Redirect based on role
      if (roleData.role === 'admin') {
        console.log('🔑 Admin detected, redirecting to dashboard')
        window.location.href = '/dashboard'
      } else {
        const firstPage = roleData.allowed_pages.find(
          (page: string) => page !== 'dashboard' && page !== '*'
        )

        if (firstPage) {
          window.location.href = `/dashboard/${firstPage}`
        } else {
          throw new Error('No pages assigned to your account. Contact administrator.')
        }
      }
    } catch (error: any) {
      console.error('❌ Login error:', error)
      setMessage({
        type: 'error',
        text: error.message || 'Authentication failed',
      })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-md w-full space-y-8 p-10 bg-[#111111] rounded-xl shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Secure authentication powered by Supabase
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-white/[0.1] placeholder-gray-500 text-white rounded-t-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-white/[0.1] placeholder-gray-500 text-white rounded-b-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          {message.text && (
            <div
              className={`rounded-md p-4 ${
                message.type === 'error'
                  ? 'bg-red-50 text-red-800'
                  : 'bg-green-50 text-green-800'
              }`}
            >
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <p className="mt-2 text-center text-xs text-gray-500">
            <strong>Note:</strong> Sign up is disabled. Contact your administrator to create an account.
          </p>
        </form>
      </div>
    </div>
  )
}





// 'use client'
// export const dynamic = 'force-dynamic'

// import { useState, useEffect } from 'react'
// import { useRouter } from 'next/navigation'
// import { supabase } from '@/lib/supabaseClient'

// export default function LoginPage() {
//   const [email, setEmail] = useState('')
//   const [password, setPassword] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [message, setMessage] = useState({ type: '', text: '' })
//   const router = useRouter()

//   // Check if user is already logged in
//   useEffect(() => {
//     if (!supabase) return
    
//     const checkUser = async () => {
//       const { data: { session } } = await supabase.auth.getSession()
//       if (session) {
//         router.push('/dashboard')
//       }
//     }
    
//     checkUser()
//   }, [router])

//   const handleAuth = async (e: React.FormEvent) => {
//     if (!supabase) return
    
//     e.preventDefault()
//     setLoading(true)
//     setMessage({ type: '', text: '' })

//     try {
//       // LOGIN
//       const { error } = await supabase.auth.signInWithPassword({
//         email,
//         password,
//       })

//       if (error) throw error

//       console.log('✅ Auth successful, checking role...', email)

//       // Check if user has a role assigned
//       const { data: roleData, error: roleError } = await supabase
//         .from('user_roles')
//         .select('*')
//         .eq('email', email)
//         .single()

//       console.log('Role data:', roleData)

//       if (!roleData) {
//         await supabase.auth.signOut()
//         throw new Error('Your account is not activated yet. Please contact the administrator.')
//       }

//       if (!roleData.is_active) {
//         await supabase.auth.signOut()
//         throw new Error('Your account has been deactivated. Please contact the administrator.')
//       }

//       console.log('✅ Role check passed, redirecting based on role...')

//       // ✅ Redirect based on role
//       if (roleData.role === 'admin') {
//         console.log('Admin detected, redirecting to dashboard')
//         router.push('/dashboard')
//       } else {
//         // Non-admin: redirect to first allowed page
//         const firstPage = roleData.allowed_pages.find((page: string) => page !== 'dashboard' && page !== '*')
        
//         console.log('Non-admin detected, first page:', firstPage)
        
//         if (firstPage) {
//           router.push(`/dashboard/${firstPage}`)
//         } else {
//           throw new Error('No pages assigned to your account. Contact administrator.')
//         }
//       }
//     } catch (error: any) {
//       console.error('❌ Login error:', error)
//       setMessage({ 
//         type: 'error', 
//         text: error.message || 'Authentication failed' 
//       })
//     } finally {
//       setLoading(false)
//     }
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
//       <div className="bg-[#111111] rounded-2xl shadow-xl p-8 w-full max-w-md">
//         {/* Logo */}
//         <div className="text-center mb-8">
//           <div className="inline-block p-3 bg-blue-100 rounded-full mb-4">
//             <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
//             </svg>
//           </div>
//           <h1 className="text-2xl font-bold text-white">🚀 Scrappy V2</h1>
//           <p className="text-gray-500 mt-2">Sign in to your account</p>
//           <p className="text-xs text-gray-400 mt-1">Secure authentication powered by Supabase</p>
//         </div>

//         {/* Error/Success Message */}
//         {message.text && (
//           <div className={`mb-4 p-3 rounded-lg text-sm ${
//             message.type === 'error' 
//               ? 'bg-red-50 text-red-800 border border-red-200' 
//               : 'bg-green-50 text-green-800 border border-green-200'
//           }`}>
//             {message.text}
//           </div>
//         )}

//         {/* Form */}
//         <form onSubmit={handleAuth} className="space-y-4">
//           {/* Email */}
//           <div>
//             <label className="block text-sm font-medium text-gray-500 mb-2">
//               Email Address
//             </label>
//             <input
//               type="email"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               className="w-full px-4 py-2 border border-white/[0.1] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               placeholder="you@example.com"
//               required
//               disabled={loading}
//             />
//           </div>

//           {/* Password */}
//           <div>
//             <label className="block text-sm font-medium text-gray-500 mb-2">
//               Password
//             </label>
//             <input
//               type="password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               className="w-full px-4 py-2 border border-white/[0.1] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               placeholder="••••••••"
//               required
//               disabled={loading}
//             />
//           </div>

//           {/* Submit Button */}
//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
//           >
//             {loading ? (
//               <span className="flex items-center justify-center">
//                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
//                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//                 </svg>
//                 Signing in...
//               </span>
//             ) : 'Sign In'}
//           </button>
//         </form>

//         {/* Sign Up Disabled Notice */}
//         <div className="mt-6 text-center">
//           <p className="text-sm text-gray-500">
//             🔒 <strong>Note:</strong> Sign up is disabled. Contact your administrator to create an account.
//           </p>
//         </div>

//         {/* Footer */}
//         <div className="mt-8 text-center text-xs text-gray-400">
//           © 2026 Scrappy V2. All rights reserved.
//         </div>
//       </div>
//     </div>
//   )
// }
