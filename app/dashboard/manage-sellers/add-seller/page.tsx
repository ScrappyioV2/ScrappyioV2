'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Seller {
  id: string
  seller_name: string
  merchant_token: string
  page_number: number
  filter_type: string
  profile_link: string
  status: string
  total_products: number
}

interface CountryData {
  country: string
  count: number
  label: string
  table: string
}

interface GeneratedLink {
  id: string
  sellerName: string
  merchantToken: string
  page: number
  totalProducts: number
  filterType: string
  filterLabel: string
  link: string
}

const FILTER_TYPES = [
  { id: 'default', label: 'Default', param: '' },
  { id: 'price-asc', label: 'Low to High', param: '&s=price-asc-rank' },
  { id: 'price-desc', label: 'High to Low', param: '&s=price-desc-rank' },
  { id: 'review', label: 'Avg. Customer Review', param: '&s=review-rank' },
  { id: 'new-arrival', label: 'New Arrivals', param: '&s=date-desc-rank' },
  { id: 'best-seller', label: 'Best Sellers', param: '&s=exact-aware-popularity-rank' },
]

export default function ManageSellers() {
  const [allSellers, setAllSellers] = useState<Record<string, Seller[]>>({
    usa: [],
    india: [],
    uae: [],
    uk: [],
  })
  
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [displayedSellers, setDisplayedSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [uploadCountry, setUploadCountry] = useState('')
  const [showGenerateLinks, setShowGenerateLinks] = useState(false)
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([])
  
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const selectedRowRef = useRef<HTMLTableRowElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const countryCounts: CountryData[] = [
    { country: 'usa', count: allSellers.usa.length, label: 'USA', table: 'us_sellers' },
    { country: 'india', count: allSellers.india.length, label: 'India', table: 'sellers' },
    { country: 'uae', count: allSellers.uae.length, label: 'UAE', table: 'uae_sellers' },
    { country: 'uk', count: allSellers.uk.length, label: 'UK', table: 'uk_sellers' },
  ]

  const getAmazonDomain = (country: string) => {
    switch(country) {
      case 'usa': return 'amazon.com'
      case 'india': return 'amazon.in'
      case 'uae': return 'amazon.ae'
      case 'uk': return 'amazon.co.uk'
      default: return 'amazon.com'
    }
  }

  const generateProfileLink = (merchantToken: string, page: number, filterType: string, country: string) => {
    const domain = getAmazonDomain(country)
    const baseUrl = `https://www.${domain}/s?me=${merchantToken}`
    
    const filter = FILTER_TYPES.find(f => f.id === filterType)
    const filterParam = filter?.param || ''
    
    return `${baseUrl}${filterParam}&page=${page}`
  }

  const getFiltersForProductCount = (totalProducts: number): string[] => {
    if (totalProducts > 300) {
      return FILTER_TYPES.map(f => f.id)
    } else {
      return ['price-asc']
    }
  }

  useEffect(() => {
    fetchAllSellers()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (generatedLinks.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedRowIndex(prev => {
          if (prev === null) return 0
          return Math.min(prev + 1, generatedLinks.length - 1)
        })
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedRowIndex(prev => {
          if (prev === null || prev === 0) return 0
          return Math.max(prev - 1, 0)
        })
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedRowIndex !== null) {
        e.preventDefault()
        const selectedLink = generatedLinks[selectedRowIndex]
        if (selectedLink) {
          navigator.clipboard.writeText(selectedLink.link)
          showToast('Link copied to clipboard! ✓')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [generatedLinks, selectedRowIndex])

  useEffect(() => {
    if (selectedRowIndex !== null && selectedRowRef.current && tableContainerRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedRowIndex])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchAllSellers = async () => {
    setLoading(true)
    try {
      const fetchPromises = countryCounts.map(async (country) => {
        const { data, error } = await supabase
          .from(country.table)
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error(`Error fetching ${country.label}:`, error)
          return { country: country.country, data: [] }
        }
        return { country: country.country, data: data || [] }
      })

      const results = await Promise.all(fetchPromises)
      
      const sellersData: Record<string, Seller[]> = {}
      results.forEach(result => {
        sellersData[result.country] = result.data
      })

      setAllSellers(sellersData)
    } catch (error) {
      console.error('Error fetching sellers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCountryClick = (country: string) => {
    setSelectedCountry(country)
    setDisplayedSellers(allSellers[country] || [])
    setShowGenerateLinks(false)
    setGeneratedLinks([])
    setSelectedRowIndex(null)
  }

  const handleGenerateLinks = () => {
    if (!selectedCountry || displayedSellers.length === 0) return

    const links: GeneratedLink[] = []

    displayedSellers.forEach(seller => {
      const selectedFilters = getFiltersForProductCount(seller.total_products)

      selectedFilters.forEach(filterId => {
        const filter = FILTER_TYPES.find(f => f.id === filterId)!
        
        for (let page = 1; page <= seller.page_number; page++) {
          links.push({
            id: `${seller.id}-${filterId}-${page}`,
            sellerName: seller.seller_name,
            merchantToken: seller.merchant_token,
            page: page,
            totalProducts: seller.total_products,
            filterType: filterId,
            filterLabel: filter.label,
            link: generateProfileLink(seller.merchant_token, page, filterId, selectedCountry)
          })
        }
      })
    })

    setGeneratedLinks(links)
    setShowGenerateLinks(true)
    setSelectedRowIndex(null)
  }

  // ✅ FIXED: Only hide generated links, keep sellers data intact
  const handleGoBack = () => {
    setShowGenerateLinks(false)
    setSelectedRowIndex(null)
    // DON'T clear generatedLinks, selectedCountry, or displayedSellers
  }

  const copyAllLinks = () => {
    const allLinks = generatedLinks.map(l => l.link).join('\n')
    navigator.clipboard.writeText(allLinks)
    showToast(`✅ Copied ${generatedLinks.length} links to clipboard!`)
  }

  const handleDeleteLink = (linkId: string) => {
    if (confirm('Delete this link?')) {
      setGeneratedLinks(prev => prev.filter(l => l.id !== linkId))
      setOpenDropdownId(null)
      showToast('Link deleted!')
    }
  }

  const [toastMessage, setToastMessage] = useState('')
  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!uploadCountry) {
      alert('Please select a country first!')
      return
    }

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet)

        if (jsonData.length === 0) {
          alert('Excel file is empty!')
          return
        }

        const selectedCountryData = countryCounts.find(c => c.country === uploadCountry)
        if (!selectedCountryData) {
          alert('Invalid country selected!')
          return
        }

        const getColumnValue = (row: any, possibleNames: string[]) => {
          for (const name of possibleNames) {
            const key = Object.keys(row).find(k => 
              k.toLowerCase().trim() === name.toLowerCase().trim()
            )
            if (key && row[key]) return row[key]
          }
          return null
        }

        const newSellers = jsonData.map((row) => {
          const sellerName = getColumnValue(row, [
            'Seller Name', 'sellername', 'seller', 'name'
          ]) || ''
          
          const merchantToken = getColumnValue(row, [
            'Merchant Token', 'merchanttoken', 'token', 'merchant'
          ]) || ''
          
          const pageNumber = parseInt(
            getColumnValue(row, [
              'Page', 'page_number', 'pagenumber', 'pages', 'Default'
            ]) || '1'
          )
          
          const totalProducts = parseInt(
            getColumnValue(row, [
              'Total No Of Product',
              'Total Products',
              'total_products',
              'products',
              'product_count'
            ]) || '0'
          )
          
          const filterType = getColumnValue(row, [
            'Filter Type', 'filtertype', 'filter'
          ]) || 'default'
          
          const status = getColumnValue(row, [
            'Status', 'active'
          ]) || 'active'
          
          const profileLink = getColumnValue(row, [
            'Seller Profile',
            'Profile Link',
            'Seller Profile Link',
            'profile_link',
            'profilelink',
            'link',
            'url'
          ]) || ''

          return {
            seller_name: sellerName,
            merchant_token: merchantToken,
            page_number: pageNumber,
            total_products: totalProducts,
            filter_type: filterType,
            profile_link: profileLink,
            status: status,
          }
        })

        const invalidRows = newSellers.filter(s => !s.seller_name || !s.merchant_token)
        if (invalidRows.length > 0) {
          alert(`Found ${invalidRows.length} rows with missing Seller Name or Merchant Token.`)
          return
        }

        const { data: insertedData, error } = await supabase
          .from(selectedCountryData.table)
          .insert(newSellers)
          .select()

        if (error) {
          console.error('Supabase error:', error)
          alert(`Database error: ${error.message}`)
          return
        }

        alert(`✅ Successfully uploaded ${newSellers.length} sellers!`)
        setShowBulkUpload(false)
        await fetchAllSellers()
        handleCountryClick(uploadCountry)
      } catch (error: any) {
        console.error('Error reading file:', error)
        alert(`Error: ${error.message}`)
      }
    }

    reader.readAsArrayBuffer(file)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading sellers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Manage Sellers</h1>
        <p className="text-gray-600 mt-2">Add and manage sellers from different countries</p>
      </div>

      {/* Country Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {countryCounts.map((country) => (
          <div
            key={country.country}
            onClick={() => handleCountryClick(country.country)}
            className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all hover:shadow-lg border-2 ${
              selectedCountry === country.country 
                ? 'border-blue-500 ring-4 ring-blue-500/30' 
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-2">
                {country.label} Sellers
              </div>
              <div className="text-4xl font-bold text-blue-600">
                {country.count}
              </div>
              {selectedCountry === country.country && (
                <div className="mt-2 text-xs text-blue-600 font-semibold">
                  ✓ Selected
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setShowBulkUpload(true)}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Bulk Upload
        </button>

        {selectedCountry && displayedSellers.length > 0 && !showGenerateLinks && (
          <button
            onClick={handleGenerateLinks}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.102m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Generate Links ({displayedSellers.length} sellers)
          </button>
        )}

        {showGenerateLinks && (
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-semibold transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go Back
          </button>
        )}
      </div>

      {/* ✅ FIXED: Better conditional rendering logic */}
      {/* No Country Selected - Only show when NO country is selected */}
      {!selectedCountry && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <svg className="w-16 h-16 mx-auto text-blue-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Select a Country to View Sellers
          </h3>
          <p className="text-gray-600">
            Click on any country card above to view and manage sellers
          </p>
        </div>
      )}

      {/* Generated Links Table */}
      {showGenerateLinks && generatedLinks.length > 0 && (
        <div className="bg-white rounded-lg shadow-xl border border-gray-200">
          <div className="bg-blue-50 border-b border-blue-200 p-4">
            <p className="text-sm text-blue-800">
              <strong className="font-semibold">Keyboard Workflow:</strong> Click any link to select it → Use{' '}
              <kbd className="px-2 py-1 bg-white rounded text-xs mx-1 border border-gray-300">↑</kbd>
              <kbd className="px-2 py-1 bg-white rounded text-xs border border-gray-300">↓</kbd> to navigate → Press{' '}
              <kbd className="px-2 py-1 bg-white rounded text-xs mx-1 border border-gray-300">Ctrl+C</kbd> to copy → Switch tabs and paste → Come back and continue with arrow keys!
            </p>
          </div>

          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-bold">
              Generated Links ({generatedLinks.length} total)
            </h2>
            <button
              onClick={copyAllLinks}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2 transition"
            >
              📋 Copy All Links
            </button>
          </div>

          <div ref={tableContainerRef} className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">No.</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Seller Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Merchant Token</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Page</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Total Products</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Filter</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Link</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {generatedLinks.map((link, index) => (
                  <tr
                    key={link.id}
                    ref={selectedRowIndex === index ? selectedRowRef : null}
                    className={`transition-all ${
                      selectedRowIndex === index 
                        ? 'bg-blue-100 border-2 border-blue-500' 
                        : index % 2 === 0 
                        ? 'bg-white' 
                        : 'bg-gray-50'
                    } hover:bg-gray-100`}
                  >
                    <td className="px-4 py-3 text-sm">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium">{link.sellerName}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{link.merchantToken}</td>
                    <td className="px-4 py-3 text-sm text-blue-600 font-semibold text-center">{link.page}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-600 text-center">
                      {link.totalProducts}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                        {link.filterLabel}
                      </span>
                    </td>
                    <td 
                      className="px-4 py-3 text-sm cursor-pointer"
                      onClick={() => setSelectedRowIndex(index)}
                      tabIndex={0}
                    >
                      <div className="flex items-center gap-2">
                        <a
                          href={link.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`truncate max-w-md transition ${
                            selectedRowIndex === index 
                              ? 'text-blue-700 font-semibold' 
                              : 'text-blue-600 hover:text-blue-700'
                          }`}
                        >
                          {link.link}
                        </a>
                        {selectedRowIndex === index && (
                          <span className="text-xs text-blue-600 font-semibold whitespace-nowrap">
                            • Selected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center relative">
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === link.id ? null : link.id)}
                        className="text-gray-600 hover:text-gray-900 transition p-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </button>

                      {openDropdownId === link.id && (
                        <div
                          ref={dropdownRef}
                          className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden"
                        >
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(link.link)
                              showToast('Link copied!')
                              setOpenDropdownId(null)
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 transition flex items-center gap-3"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy Link
                          </button>
                          <button
                            onClick={() => handleDeleteLink(link.id)}
                            className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-3"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Regular Sellers Table */}
      {selectedCountry && !showGenerateLinks && displayedSellers.length > 0 && (
        <div className="bg-white rounded-lg shadow-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold">
              {countryCounts.find(c => c.country === selectedCountry)?.label} Sellers ({displayedSellers.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300" />
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Seller Name</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Merchant Token</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Page</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Total Products</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Auto Filters</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayedSellers.map((seller, index) => (
                  <tr key={seller.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition`}>
                    <td className="px-6 py-4">
                      <input type="checkbox" className="w-5 h-5 rounded border-gray-300" />
                    </td>
                    <td className="px-6 py-4 font-medium">{seller.seller_name}</td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-600">{seller.merchant_token}</td>
                    <td className="px-6 py-4 text-blue-600 font-semibold text-center">{seller.page_number}</td>
                    <td className="px-6 py-4 font-semibold text-green-600 text-center">
                      {seller.total_products}
                    </td>
                    <td className="px-6 py-4">
                      {seller.total_products > 300 ? (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium border border-blue-200">
                          All 6 Filters
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium border border-green-200">
                          Low to High Only
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium border border-green-200">
                        {seller.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-gray-600 hover:text-gray-900 text-xl transition">⋮</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-lg p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Bulk Upload Sellers</h2>
              <button
                onClick={() => setShowBulkUpload(false)}
                className="text-gray-600 hover:text-gray-900 text-2xl transition"
              >
                ✕
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Selected Country: <span className="text-blue-600 font-bold">{uploadCountry.toUpperCase() || 'None'}</span>
              </label>
              <select
                value={uploadCountry}
                onChange={(e) => setUploadCountry(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select Country</option>
                {countryCounts.map((c) => (
                  <option key={c.country} value={c.country}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700">Upload Excel File *</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
              />
            </div>

            <div className="text-sm text-gray-700 bg-gray-50 p-4 rounded border border-gray-200">
              <p className="font-semibold mb-2">Expected Columns:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Seller Name</li>
                <li>Merchant Token</li>
                <li>Page</li>
                <li><strong className="text-blue-600">Total No Of Product</strong> (NEW!)</li>
                <li>Seller Profile</li>
                <li>Status</li>
              </ul>
              
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs font-semibold text-blue-800">Auto Filter Logic:</p>
                <p className="text-xs text-blue-700 mt-1">
                  • Products &gt; 300 → All 6 filters<br />
                  • Products ≤ 300 → Low to High only
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowBulkUpload(false)}
              className="mt-6 w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="bg-gray-800 border border-gray-700 rounded-lg px-6 py-4 shadow-xl">
            <p className="text-white text-sm">{toastMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}
