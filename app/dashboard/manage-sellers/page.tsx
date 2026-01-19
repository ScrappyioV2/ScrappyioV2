'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '../../../lib/hooks/useAuth'
import PageGuard from '../../components/PageGuard'

interface CountryProgress {
  country: string
  totalLinks: number
  copiedLinks: number
  resetAt: string | null
  completedAt: string | null
}

export default function ManageSellersPage() {
  const router = useRouter()
  const { user, userRole, loading: authLoading } = useAuth() // ✅ Use RBAC hook

  const [authMessage, setAuthMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [progress, setProgress] = useState<Record<string, CountryProgress>>({
    usa: { country: 'usa', totalLinks: 0, copiedLinks: 0, resetAt: null, completedAt: null },
    india: { country: 'india', totalLinks: 0, copiedLinks: 0, resetAt: null, completedAt: null },
    uae: { country: 'uae', totalLinks: 0, copiedLinks: 0, resetAt: null, completedAt: null },
    uk: { country: 'uk', totalLinks: 0, copiedLinks: 0, resetAt: null, completedAt: null }
  })

  const sellerCards = [
    { country: 'usa', label: 'Add USA Seller', code: 'US', flag: '🇺🇸', count: progress.usa.totalLinks, color: 'bg-blue-500' },
    { country: 'india', label: 'Add India Seller', code: 'IN', flag: '🇮🇳', count: progress.india.totalLinks, color: 'bg-orange-500' },
    { country: 'uae', label: 'Add UAE Seller', code: 'AE', flag: '🇦🇪', count: progress.uae.totalLinks, color: 'bg-green-500' },
    { country: 'uk', label: 'Add UK Seller', code: 'GB', flag: '🇬🇧', count: progress.uk.totalLinks, color: 'bg-red-500' },
  ]

  const debouncedFetchProgressRef = useRef<NodeJS.Timeout | null>(null)

  const fetchProgress = async () => {
    if (!supabase || !user) return
    try {
      const countries = ['usa', 'india', 'uae', 'uk']
      const progressData: Record<string, CountryProgress> = {}

      // Fetch timestamps from copy_progress_timestamps table
      const { data: timestamps } = await supabase
        .from('copy_progress_timestamps')
        .select('*')
        .eq('user_id', user.id)

      const timestampMap: Record<string, any> = {}
      timestamps?.forEach(t => {
        timestampMap[t.country] = t
      })

      for (const country of countries) {
        const tableName = country === 'usa' ? 'us_sellers' : `${country}_sellers`

        const { count: totalCount } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        const { count: copiedCount } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_copied', true)

        progressData[country] = {
          country,
          totalLinks: totalCount || 0,
          copiedLinks: copiedCount || 0,
          resetAt: timestampMap[country]?.reset_at || null,
          completedAt: timestampMap[country]?.completed_at || null
        }
      }
      setProgress(progressData)
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching progress:', error)
      }
    }
  }

  const debouncedFetchProgress = () => {
    if (debouncedFetchProgressRef.current) {
      clearTimeout(debouncedFetchProgressRef.current)
    }
    debouncedFetchProgressRef.current = setTimeout(() => {
      fetchProgress()
    }, 500)
  }

  useEffect(() => {
    if (user) {
      fetchProgress()
    }
  }, [user])

  useEffect(() => {
    if (!user || !supabase) return

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
            debouncedFetchProgress()
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
            debouncedFetchProgress()
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
            debouncedFetchProgress()
          }
        )
        .subscribe()

      subscriptions.push(subscription)
    })

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe())
    }
  }, [user])

  const resetAllCopied = async (country: string) => {
    if (!supabase || !user) return
    try {
      const tableName = country === 'usa' ? 'us_sellers' : `${country}_sellers`
      const BATCH_SIZE = 1000
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data: links } = await supabase
          .from(tableName)
          .select('id')
          .eq('user_id', user.id)
          .eq('is_copied', true)
          .range(offset, offset + BATCH_SIZE - 1)

        if (!links || links.length === 0) {
          hasMore = false
          break
        }

        const ids = links.map(link => link.id)
        await supabase
          .from(tableName)
          .update({ is_copied: false })
          .in('id', ids)

        offset += BATCH_SIZE
        if (links.length < BATCH_SIZE) {
          hasMore = false
        }
      }

      await supabase
        .from('copy_progress_timestamps')
        .upsert({
          user_id: user.id,
          country: country,
          total_links: progress[country].totalLinks,
          copied_links: 0,
          reset_at: new Date().toISOString(),
          completed_at: null
        }, { onConflict: 'user_id,country' })

      await fetchProgress()
      setAuthMessage({ text: `Reset completed for ${country.toUpperCase()}!`, type: 'success' })
      setTimeout(() => setAuthMessage(null), 3000)
    } catch (error) {
      console.error('Error resetting copied status:', error)
      setAuthMessage({ text: 'Error resetting progress', type: 'error' })
      setTimeout(() => setAuthMessage(null), 3000)
    }
  }

  const handleCardClick = (country: string) => {
    router.push(`/dashboard/manage-sellers/add-seller?country=${country}`)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <PageGuard>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        {/* ✅ HEADER WITH USER INFO */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Manage Sellers</h1>
          {user && userRole && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-300">{userRole.full_name || user.email}</p>
                <p className="text-xs text-green-400">
                  {userRole.role.charAt(0).toUpperCase() + userRole.role.slice(1)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ✅ AUTH MESSAGE */}
        {authMessage && (
          <div className={`mb-6 p-4 rounded-lg ${authMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
            {authMessage.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-8">
          {/* Header Row */}
          <h2 className="text-2xl font-semibold text-white">No of Sellers</h2>
          <h2 className="text-2xl font-semibold text-white">Seller Scraping Progress Bar</h2>

          {/* Country Rows */}
          {sellerCards.map((card) => {
            const countryProgress = progress[card.country]
            const percentage = countryProgress.totalLinks > 0
              ? Math.round((countryProgress.copiedLinks / countryProgress.totalLinks) * 100)
              : 0

            return (
              <div key={card.country} className="contents">
                {/* Left: Country Card */}
                <div
                  onClick={() => handleCardClick(card.country)}
                  className={`${card.color} text-white p-6 rounded-xl cursor-pointer hover:opacity-90 transition-all hover:scale-105 shadow-lg`}
                >
                  <h3 className="text-xl font-semibold">{card.label}</h3>
                  <p className="text-3xl font-bold mt-2">{card.count}</p>
                  <div className="text-4xl mt-4">{card.flag}</div>
                </div>

                {/* Right: Progress Bar */}
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{card.flag}</div>
                      <div>
                        <h4 className="text-white font-semibold">Copy Progress {card.code}</h4>
                        <p className="text-sm text-gray-400">
                          {countryProgress.copiedLinks.toLocaleString()} copied
                          <span className="mx-2">•</span>
                          {countryProgress.totalLinks.toLocaleString()} total
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => resetAllCopied(card.country)}
                      disabled={countryProgress.copiedLinks === 0}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 text-gray-300 hover:text-white font-semibold rounded-lg transition-all border border-gray-600 hover:border-gray-500"
                    >
                      Reset All Copied
                    </button>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="relative w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${card.color}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-right">
                    {percentage}% Complete
                  </p>

                  {/* Timestamps Display */}
                  <div className="mt-3 space-y-2">
                    {countryProgress.resetAt && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <svg className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>
                          Reset: {new Date(countryProgress.resetAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                    )}

                    {countryProgress.completedAt && (
                      <div className="flex items-center gap-2 text-xs text-green-400">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          Completed: {new Date(countryProgress.completedAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </PageGuard>
  )
}
