'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabaseClient'
interface CountryProgress {
  country: string
  totalLinks: number
  copiedLinks: number
}

export default function ManageSellersPage() {
  const router = useRouter()

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

  useEffect(() => {
    fetchProgress()

    // Set up real-time updates
    const interval = setInterval(() => {
      fetchProgress()
    }, 3000) // Refresh every 3 seconds

    return () => clearInterval(interval)
  }, [])

  const fetchProgress = async () => {
    const supabase = getSupabaseClient()
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
    const supabase = getSupabaseClient()
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
    } catch (error) {
      console.error('Error resetting copied status:', error)
    }
  }

  const handleCardClick = (country: string) => {
    router.push(`/dashboard/manage-sellers/add-seller?country=${country}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Side - No of Sellers Cards */}
          <div className="lg:col-span-1">
            <h1 className="text-2xl font-bold mb-6">No of Sellers</h1>
            <div className="space-y-4">
              {sellerCards.map((card) => (
                <div
                  key={card.country}
                  onClick={() => handleCardClick(card.country)}
                  className={`${card.color} text-white p-6 rounded-lg cursor-pointer hover:opacity-90 transition-all hover:scale-105 shadow-lg`}
                >
                  <p className="text-sm mb-2 opacity-90">{card.label}</p>
                  <div className="flex justify-between items-center">
                    <h2 className="text-5xl font-bold">{card.count}</h2>
                    <span className="text-5xl">{card.flag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Progress Bars */}
          <div className="lg:col-span-2">
            <h1 className="text-2xl font-bold mb-6">Seller Scraping Progress bar</h1>
            <div className="space-y-6">
              {sellerCards.map((card) => {
                const countryProgress = progress[card.country]
                const percentage = countryProgress.totalLinks > 0
                  ? Math.round((countryProgress.copiedLinks / countryProgress.totalLinks) * 100)
                  : 0

                return (
                  <div
                    key={card.country}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                  >
                    {/* Progress Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Copy Progress</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {countryProgress.copiedLinks} Copied / {countryProgress.totalLinks} total
                        </p>
                      </div>
                      <button
                        onClick={() => resetAllCopied(card.country)}
                        disabled={countryProgress.copiedLinks === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reset All Copied
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                        <div
                          className={`h-full ${card.color} transition-all duration-500 flex items-center justify-center`}
                          style={{ width: `${percentage}%` }}
                        >
                          <span className="text-white text-sm font-bold">
                            {percentage > 0 && `${percentage}% Complete`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
