'use client'
export const dynamic = "force-dynamic"
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

interface GeneratedLink {
  seller_name: string
  merchant_token: string
  page_number: number
  filter_type: string
  filter_label?: string
  profile_link: string
  badge?: string
}
export default function GeneratedLinksPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading generated links…</div>}>
      <GeneratedLinks />
    </Suspense>
  )
}
function GeneratedLinks() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [links, setLinks] = useState<GeneratedLink[]>([])
  const [country, setCountry] = useState('')
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'localStorage' | 'database' | 'none'>('none')
  const [visibleLinks, setVisibleLinks] = useState<GeneratedLink[]>([])
  const [startIndex, setStartIndex] = useState(0)
  const [endIndex, setEndIndex] = useState(200)
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const countryParam = searchParams.get('country') || ''
    setCountry(countryParam)

    if (countryParam) {
      loadGeneratedLinks(countryParam)
    }
  }, [searchParams])

  // Try database first, then localStorage
  // Try database first, then localStorage
  // Try database first, then localStorage
  const loadGeneratedLinks = async (countryCode: string) => {
    try {
      setLoading(true)

      // Try to get from database first
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const tableName = countryCode === 'usa' ? 'us_sellers' : `${countryCode}_sellers`

        // ✅ V1 BATCH LOADING LOGIC
        let allLinks: GeneratedLink[] = []
        let from = 0
        const batchSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('user_id', user.id)
            .order('seller_name', { ascending: true })
            .order('page_number', { ascending: true })
            .range(from, from + batchSize - 1)

          if (error) throw error

          if (data && data.length > 0) {
            const FILTER_LABELS: Record<string, string> = {
              'default': 'Default',
              'price-asc': 'Price: Low to High',
              'price-desc': 'Price: High to Low',
              'review': 'Avg. Customer Review',
              'new-arrival': 'New Arrivals',
              'best-seller': 'Best Sellers'
            }

            const formattedLinks = data.map(link => ({
              seller_name: link.seller_name,
              merchant_token: link.merchant_token,
              page_number: link.page_number,
              filter_type: link.filter_type,
              profile_link: link.profile_link,
              badge: link.badge || null,
              filter_label: FILTER_LABELS[link.filter_type] || link.filter_type
            }))

            allLinks = [...allLinks, ...formattedLinks]
            from += batchSize
            hasMore = data.length === batchSize
          } else {
            hasMore = false
          }
        }

        console.log(`✅ Loaded ${allLinks.length} links from database`)
        setLinks(allLinks)
        setSource('database')
        setLoading(false)
        return
      }

      // Fallback to localStorage
      const storedLinks = localStorage.getItem('generatedLinks')
      const storedCountry = localStorage.getItem('generatedLinksCountry')

      if (storedLinks && storedCountry === countryCode) {
        const parsedLinks = JSON.parse(storedLinks)
        setLinks(parsedLinks)
        setSource('localStorage')
      } else {
        setLinks([])
        setSource('none')
      }
    } catch (error) {
      console.error('Error loading links:', error)
      setLinks([])
      setSource('none')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('✅ Link copied to clipboard!')
  }

  const copyAllLinks = () => {
    const allLinks = links.map(link => link.profile_link).join('\n')
    navigator.clipboard.writeText(allLinks)
    alert(`✅ Copied ${links.length} links to clipboard!`)
  }

  const downloadAsCSV = () => {
    const headers = ['No.', 'Seller Name', 'Merchant Token', 'Page', 'Filter', 'Profile Link']
    const csvContent = [
      headers.join(','),
      ...links.map((link, index) => [
        index + 1,
        `"${link.seller_name}"`,
        link.merchant_token,
        link.page_number,
        `"${link.filter_label}"`,
        `"${link.profile_link}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${country}_generated_links_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    alert('✅ CSV downloaded successfully!')
  }

  const handleGoBack = () => {
    router.push(`/dashboard/manage-sellers/add-seller?country=${country}`)
  }

  // Clear localStorage and refresh from database
  const refreshFromDatabase = async () => {
    if (source === 'localStorage') {
      localStorage.removeItem('generatedLinks')
      localStorage.removeItem('generatedLinksCountry')
    }
    await loadGeneratedLinks(country)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading generated links...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={handleGoBack}
              className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-2 font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Add Seller
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              Generated Links - {country.toUpperCase()}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-gray-600">
                Total Links: <span className="font-semibold text-green-600">{links.length.toLocaleString()}</span>
              </p>
              <p className="text-gray-600">
                Showing: <span className="font-semibold text-blue-600">{visibleLinks.length.toLocaleString()}</span> rows
              </p>
              {source !== 'none' && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${source === 'database'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
                  }`}>
                  {source === 'database' ? '💾 From Database' : '🔄 From Local Storage'}
                </span>
              )}
              {source === 'localStorage' && (
                <button
                  onClick={refreshFromDatabase}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Refresh from Database
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={downloadAsCSV}
              disabled={links.length === 0}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition shadow-md flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download CSV
            </button>
            <button
              onClick={copyAllLinks}
              disabled={links.length === 0}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition shadow-md flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy All ({links.length})
            </button>
          </div>
        </div>

        {/* Keyboard Instructions */}
        <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            <strong>⌨️ Keyboard Navigation:</strong> Click any row to select → Use{' '}
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs mx-1">↑</kbd>{' '}
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">↓</kbd> arrows to navigate → Press{' '}
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs mx-1">Ctrl+C</kbd> to copy link!
          </p>
        </div>

        {/* Links Table */}
        {visibleLinks.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      No.
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Seller Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Merchant Token
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Page
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Filter Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Profile Link
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLinks.map((link, visIndex) => {
                    const absoluteIndex = startIndex + visIndex
                    const isFocused = focusedRowIndex === absoluteIndex

                    return (
                      <tr
                        key={visIndex}
                        onClick={() => setFocusedRowIndex(absoluteIndex)}
                        className={`border-b border-gray-200 transition-all duration-150 cursor-pointer ${isFocused
                            ? 'bg-blue-50 ring-2 ring-inset ring-blue-400 shadow-sm'
                            : 'hover:bg-gray-50'
                          }`}
                      >
                        <td className="px-6 py-4 text-sm text-gray-700 font-medium border-r border-gray-200">
                          {absoluteIndex + 1}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium border-r border-gray-200">
                          {link.seller_name}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-700 border-r border-gray-200">
                          {link.merchant_token}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 text-center border-r border-gray-200">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold">
                            {link.page_number}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm border-r border-gray-200">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                            {link.filter_label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-blue-600 max-w-md border-r border-gray-200">
                          <a
                            href={link.profile_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline truncate block"
                            title={link.profile_link}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {link.profile_link}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              copyToClipboard(link.profile_link)
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-sm inline-flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Info */}
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-600">
              Displaying rows {startIndex + 1}-{Math.min(endIndex, links.length)} of {links.length.toLocaleString()} total links
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <svg className="w-20 h-20 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-2xl font-semibold text-gray-700 mb-2">No Links Generated Yet</h3>
            <p className="text-gray-500 mb-6">Upload sellers and click "Generate Links" to create Amazon profile links.</p>
            <button
              onClick={handleGoBack}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Go to Add Seller
            </button>
          </div>
        )}
      </div>
    </div>
  )

}
