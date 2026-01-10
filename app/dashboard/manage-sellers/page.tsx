'use client'
import { supabase } from '@/lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface CountryProgress {
  country: string
  totalLinks: number
  copiedLinks: number
}

export default function ManageSellersPage() {
  const router = useRouter()

  // ✅ AUTH STATE
  const [user, setUser] = useState<any>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [authMessage, setAuthMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const [progress, setProgress] = useState<Record<string, CountryProgress>>({
    usa: { country: 'usa', totalLinks: 0, copiedLinks: 0 },
    india: { country: 'india', totalLinks: 0, copiedLinks: 0 },
    uae: { country: 'uae', totalLinks: 0, copiedLinks: 0 },
    uk: { country: 'uk', totalLinks: 0, copiedLinks: 0 }
  })

  const sellerCards = [
    { country: 'usa', label: 'Add USA Seller', code: 'US', flag: '🇺🇸', count: progress.usa.totalLinks, color: 'bg-blue-500' },
    { country: 'india', label: 'Add India Seller', code: 'IN', flag: '🇮🇳', count: progress.india.totalLinks, color: 'bg-orange-500' },
    { country: 'uae', label: 'Add UAE Seller', code: 'AE', flag: '🇦🇪', count: progress.uae.totalLinks, color: 'bg-green-500' },
    { country: 'uk', label: 'Add UK Seller', code: 'GB', flag: '🇬🇧', count: progress.uk.totalLinks, color: 'bg-red-500' },
  ]

  // ✅ AUTH CHECK
  useEffect(() => {
    const checkAuth = async () => {
      if (!supabase) return
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    checkAuth()

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
      })

      return () => subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    fetchProgress()

    // ✅ SET UP REAL-TIME SUBSCRIPTIONS
    if (!supabase) return

    const subscriptions: any[] = []
    const countries = ['usa', 'india', 'uae', 'uk']

    countries.forEach((country) => {
      const tableName = country === 'usa' ? 'us_sellers' : `${country}_sellers`

      const subscription = supabase
        .channel(`${country}_realtime_copy`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: tableName,
          },
          (payload) => {
            console.log(`✅ Real-time: ${country} link copied!`, payload)
            fetchProgress() // Refresh progress immediately
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: tableName,
          },
          () => {
            console.log(`➕ Real-time: New ${country} link added`)
            fetchProgress()
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: tableName,
          },
          () => {
            console.log(`🗑️ Real-time: ${country} link deleted`)
            fetchProgress()
          }
        )
        .subscribe()

      subscriptions.push(subscription)
    })

    // Cleanup subscriptions on unmount
    return () => {
      subscriptions.forEach(sub => sub.unsubscribe())
    }
  }, [])


  const fetchProgress = async () => {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const countries = ['usa', 'india', 'uae', 'uk']
      const progressData: Record<string, CountryProgress> = {}

      for (const country of countries) {
        const tableName = country === 'usa' ? 'us_sellers' : `${country}_sellers`

        const { data: allLinks } = await supabase
          .from(tableName)
          .select('id, is_copied')
          .eq('user_id', user.id)

        const totalLinks = allLinks?.length || 0
        const copiedLinks = allLinks?.filter(link => link.is_copied).length || 0

        progressData[country] = {
          country,
          totalLinks,
          copiedLinks
        }
      }

      setProgress(progressData)
    } catch (error) {
      console.error('Error fetching progress:', error)
    }
  }

  const resetAllCopied = async (country: string) => {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const tableName = country === 'usa' ? 'us_sellers' : `${country}_sellers`

      await supabase
        .from(tableName)
        .update({ is_copied: false })
        .eq('user_id', user.id)

      fetchProgress()
      setAuthMessage({ text: `Reset completed for ${country.toUpperCase()}!`, type: 'success' })
      setTimeout(() => setAuthMessage(null), 3000)
    } catch (error) {
      console.error('Error resetting copied status:', error)
      setAuthMessage({ text: 'Error resetting progress', type: 'error' })
      setTimeout(() => setAuthMessage(null), 3000)
    }
  }

  // ✅ AUTH FUNCTIONS
  const handleAuth = async () => {
    if (!supabase) return

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setAuthMessage({ text: 'Logged in successfully!', type: 'success' })
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setAuthMessage({ text: 'Account created! Check your email to verify.', type: 'success' })
      }
      setShowLoginModal(false)
      setEmail('')
      setPassword('')
      setTimeout(() => setAuthMessage(null), 3000)
    } catch (error: any) {
      setAuthMessage({ text: error.message, type: 'error' })
    }
  }

  const handleLogout = async () => {
    if (!supabase) return
    try {
      await supabase.auth.signOut()
      setUser(null)
      setAuthMessage({ text: 'Logged out successfully!', type: 'success' })
      setTimeout(() => setAuthMessage(null), 3000)
    } catch (error: any) {
      setAuthMessage({ text: error.message, type: 'error' })
    }
  }

  const handleCardClick = (country: string) => {
    router.push(`/dashboard/manage-sellers/add-seller?country=${country}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">

        {/* ✅ HEADER WITH LOGIN */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manage Sellers</h1>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{user.email}</div>
                <div className="text-xs text-gray-500">Logged in</div>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition shadow-md"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition shadow-md flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Login / Sign Up
            </button>
          )}
        </div>

        {/* ✅ AUTH MESSAGE */}
        {authMessage && (
          <div className={`mb-6 p-4 rounded-lg ${authMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {authMessage.text}
          </div>
        )}

        {/* Header Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-bold">No of Sellers</h2>
          </div>
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold">Seller Scraping Progress Bar</h2>
          </div>
        </div>

        {/* Country Rows - Each card aligned with its progress bar */}
        <div className="space-y-4">
          {sellerCards.map((card) => {
            const countryProgress = progress[card.country]
            const percentage = countryProgress.totalLinks > 0
              ? Math.round((countryProgress.copiedLinks / countryProgress.totalLinks) * 100)
              : 0

            return (
              <div
                key={card.country}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center"
              >
                {/* Left: Country Card */}
                <div
                  onClick={() => handleCardClick(card.country)}
                  className={`${card.color} text-white p-6 rounded-xl cursor-pointer hover:opacity-90 transition-all hover:scale-105 shadow-lg`}
                >
                  <p className="text-sm mb-2 opacity-90">{card.label}</p>
                  <div className="flex justify-between items-center">
                    <h2 className="text-5xl font-bold">{card.count}</h2>
                    <span className="text-5xl">{card.flag}</span>
                  </div>
                </div>

                {/* Right: Progress Bar */}
                <div className="lg:col-span-2">
                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 shadow-xl border border-gray-700">
                    {/* Header with Icon and Reset Button */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div className="bg-gray-700 rounded-lg p-2.5">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>

                        {/* Text */}
                        <div>
                          <h3 className="text-white font-semibold text-lg">
                            Copy Progress <span className="ml-2">{card.code}</span>
                          </h3>
                          <p className="text-sm mt-1">
                            <span className="text-green-400 font-bold text-lg">
                              {countryProgress.copiedLinks.toLocaleString()} copied
                            </span>
                            <span className="text-gray-400 mx-2">/</span>
                            <span className="text-gray-300 font-semibold">
                              {countryProgress.totalLinks.toLocaleString()} total
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Reset Button */}
                      <button
                        onClick={() => resetAllCopied(card.country)}
                        disabled={countryProgress.copiedLinks === 0}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 text-gray-300 hover:text-white font-semibold rounded-lg transition-all border border-gray-600 hover:border-gray-500"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Reset All Copied
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative w-full h-3 bg-gray-700 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 transition-all duration-700 ease-out rounded-full shadow-lg"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {/* Percentage Text */}
                    <div className="mt-3 flex justify-between items-center">
                      <span className="text-gray-400 text-sm font-medium uppercase">
                        {card.country}
                      </span>
                      <span className="text-gray-300 text-sm font-bold">
                        {percentage}% Complete
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </div>

      {/* ✅ LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-2xl font-bold mb-4">
              {isLogin ? 'Login' : 'Sign Up'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              {authMessage && (
                <div className={`p-3 rounded-lg text-sm ${authMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {authMessage.text}
                </div>
              )}

              <button
                onClick={handleAuth}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
              >
                {isLogin ? 'Login' : 'Sign Up'}
              </button>

              <button
                onClick={() => setIsLogin(!isLogin)}
                className="w-full text-sm text-blue-600 hover:text-blue-700"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
              </button>

              <button
                onClick={() => {
                  setShowLoginModal(false)
                  setAuthMessage(null)
                }}
                className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
