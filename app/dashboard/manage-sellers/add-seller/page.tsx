"use client";
declare global {
  interface Window {
    autoSaveTimeout?: NodeJS.Timeout
  }
}
export const dynamic = "force-dynamic";
import { supabase } from '@/lib/supabaseClient'
import { Suspense } from "react";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import Toast from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";


interface SellerRow {
  id: string
  sellerName: string
  merchantToken: string
  page: string
  totalProducts: string
  default: boolean
  lowToHigh: boolean
  highToLow: boolean
  avgReview: boolean
  newArrivals: boolean
  bestSellers: boolean
}

interface GeneratedLink {
  id?: string
  seller_name: string
  merchant_token: string
  page_number: number
  filter_type: string
  filter_label?: string
  profile_link: string
  badge?: string
  is_copied?: boolean
}

export default function AddSellerPage() {
  return (
    <Suspense fallback={<div className="p-4 text-gray-400">Loading seller page...</div>}>
      <AddSeller />
    </Suspense>
  );
}

function AddSeller() {
  const linksScrollRef = useRef<HTMLDivElement | null>(null);
  const safeLocalStorageSet = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      console.warn('LocalStorage unavailable:', e)
    }
  }
  // ===== Virtual + Batch loading config =====
  const BATCH_SIZE = 200
  const ROW_HEIGHT = 56 // px (table row height)

  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)

  // Virtual scroll
  const [scrollTop, setScrollTop] = useState(0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const countryParam = searchParams.get('country') || ''

  const [selectedCountry, setSelectedCountry] = useState<string>(countryParam)
  const [currentView, setCurrentView] = useState<'links' | 'table'>('links')
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [selectedLinks, setSelectedLinks] = useState<Set<number>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [selectAllInDB, setSelectAllInDB] = useState(false)
  const [totalLinksCount, setTotalLinksCount] = useState(0)


  // Search and copy state
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedLinks, setCopiedLinks] = useState<Set<number>>(new Set())
  const [hideCopiedLinks, setHideCopiedLinks] = useState(false)

  // Keyboard navigation state
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null)

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)

  // Seller counts state
  const [sellerCounts, setSellerCounts] = useState({
    usa: 0,
    india: 0,
    uae: 0,
    uk: 0,
    new: 0
  })
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [editingRowData, setEditingRowData] = useState<GeneratedLink | null>(null)

  const [sellers, setSellers] = useState<SellerRow[]>([
    {
      id: '1',
      sellerName: '',
      merchantToken: '',
      page: '',
      totalProducts: '',
      default: false,
      lowToHigh: false,
      highToLow: false,
      avgReview: false,
      newArrivals: false,
      bestSellers: false
    }
  ])

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToast({ message, type })
  }

  const fetchSellerCounts = async () => {

    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setGeneratedLinks([])
        setLoadingLinks(false)
        return
      }

      const countries = ['usa', 'india', 'uae', 'uk']
      const counts: any = { usa: 0, india: 0, uae: 0, uk: 0, new: 0 }

      for (const country of countries) {
        const tableName = country === 'usa' ? 'us_sellers' : `${country}_sellers`
        const { count: totalCount } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if (totalCount !== null) {
          setTotalLinksCount(totalCount)
        }

        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if (!error && count !== null) {
          counts[country] = count
        }
      }

      setSellerCounts(counts)
    } catch (error) {
      console.error('Error fetching seller counts:', error)
    }
  }

  // Filter links based on search
  const filteredLinks = generatedLinks.filter(link => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    return (
      link.seller_name?.toLowerCase().includes(query) ||
      link.merchant_token?.toLowerCase().includes(query) ||
      link.filter_label?.toLowerCase().includes(query) ||
      link.filter_type?.toLowerCase().includes(query)
    )
  })

  useEffect(() => {
    if (!countryParam) return

    setSelectedCountry(countryParam)

    // reset pagination state
    setGeneratedLinks([])
    setOffset(0)
    setHasMore(true)
    setLoadingLinks(true)
    setIsFetchingMore(false)

  }, [countryParam])


  useEffect(() => {
    if (!selectedCountry) return
    if (!loadingLinks) return
    if (generatedLinks.length > 0) return

    loadGeneratedLinksFromDB(selectedCountry)
  }, [selectedCountry, loadingLinks])


  // NEW: Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only work when on links view and there are filtered links
      if (currentView !== 'links' || filteredLinks.length === 0) return

      // Arrow Down - Navigate to next link
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedRowIndex(prev => {
          if (prev === null) return 0
          return Math.min(prev + 1, generatedLinks.length - 1)
        })
      }

      // Arrow Up - Navigate to previous link
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedRowIndex(prev => {
          if (prev === null) return 0
          return Math.max(prev - 1, 0)
        })
      }

      // Ctrl+C - Copy focused link
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && focusedRowIndex !== null) {
        e.preventDefault()
        const focusedLink = filteredLinks[focusedRowIndex]

        // Find original index
        const originalIndex = generatedLinks.findIndex(l =>
          l.seller_name === focusedLink.seller_name &&
          l.merchant_token === focusedLink.merchant_token &&
          l.page_number === focusedLink.page_number &&
          l.filter_type === focusedLink.filter_type
        )

        if (originalIndex !== -1) {
          copyToClipboard(focusedLink.profile_link, originalIndex)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentView, filteredLinks, focusedRowIndex, generatedLinks])

  // NEW: Auto-scroll to focused row
  useEffect(() => {
    if (focusedRowIndex === null) return;
    if (isFetchingMore) return;

    const row = document.getElementById(`link-row-${focusedRowIndex}`)
    const container = linksScrollRef.current

    if (!row || !container) return;

    const rowTop = row.offsetTop
    const rowBottom = rowTop + row.offsetHeight

    const viewTop = container.scrollTop
    const viewBottom = viewTop + container.clientHeight

    if (rowTop < viewTop) {
      container.scrollTop = rowTop - 8
    } else if (rowBottom > viewBottom) {
      container.scrollTop = rowBottom - container.clientHeight + 8
    }

  }, [focusedRowIndex, generatedLinks.length])

  // ADD THIS ↓
  useEffect(() => {
    fetchSellerCounts()
  }, [])
  useEffect(() => {
    if (!selectedCountry) return

    const loadSellers = async () => {
      await fetchSellersFromDB(selectedCountry)
    }

    loadSellers()
  }, [selectedCountry])
  const fetchSellersFromDB = async (country: string) => {
    if (!country) return

    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSellers([{
          id: '1',
          sellerName: '',
          merchantToken: '',
          page: '',
          totalProducts: '',
          default: false,
          lowToHigh: false,
          highToLow: false,
          avgReview: false,
          newArrivals: false,
          bestSellers: false
        }])
        return
      }

      const { data, error } = await supabase
        .from('sellers_upload')
        .select('*')
        .eq('user_id', user.id)
        .eq('country', country)
        .order('created_at', { ascending: false })
      if (error) throw error

      if (data && data.length > 0) {
        const formattedSellers = data.map(seller => ({
          id: seller.id,
          sellerName: seller.seller_name || '',
          merchantToken: seller.merchant_token || '',
          page: seller.pages?.toString() || '',
          totalProducts: seller.total_products?.toString() || '',
          default: seller.filter_default || false,
          lowToHigh: seller.filter_low_to_high || false,
          highToLow: seller.filter_high_to_low || false,
          avgReview: seller.filter_avg_review || false,
          newArrivals: seller.filter_new_arrivals || false,
          bestSellers: seller.filter_best_sellers || false
        }))
        setSellers(formattedSellers)
      } else {
        setSellers([{
          id: '1',
          sellerName: '',
          merchantToken: '',
          page: '',
          totalProducts: '',
          default: false,
          lowToHigh: false,
          highToLow: false,
          avgReview: false,
          newArrivals: false,
          bestSellers: false
        }])
      }
    } catch (error: any) {
      // Ignore abort errors
      if (error.name !== 'AbortError') {
        console.error('Error fetching sellers:', error)
      }
    }
  }
  const saveSellersToDatabase = async (sellersToSave: SellerRow[]) => {
    if (!supabase || !selectedCountry) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('No user logged in, skipping save')
        return
      }

      // Filter out empty rows
      const validSellers = sellersToSave.filter(
        seller => seller.sellerName.trim() !== '' && seller.merchantToken.trim() !== ''
      )

      if (validSellers.length === 0) {
        console.log('No valid sellers to save')
        return
      }

      // Delete existing sellers for this country
      const { error: deleteError } = await supabase
        .from('sellers_upload')
        .delete()
        .eq('user_id', user.id)
        .eq('country', selectedCountry)

      if (deleteError) {
        console.error('Error deleting old sellers:', deleteError)
      }

      // Prepare data for database
      const dbSellers = validSellers.map(seller => ({
        user_id: user.id,
        country: selectedCountry,
        seller_name: seller.sellerName,
        merchant_token: seller.merchantToken,
        pages: parseInt(seller.page) || 0,
        total_products: parseInt(seller.totalProducts) || 0,
        filter_default: seller.default,
        filter_low_to_high: seller.lowToHigh,
        filter_high_to_low: seller.highToLow,
        filter_avg_review: seller.avgReview,
        filter_new_arrivals: seller.newArrivals,
        filter_best_sellers: seller.bestSellers
      }))

      // Insert new sellers
      const { error } = await supabase
        .from('sellers_upload')
        .insert(dbSellers)

      if (error) {
        console.error('Error saving sellers:', error)
        showToast('Failed to save sellers to database', 'error')
        return
      }

      console.log(`✅ Auto-saved ${dbSellers.length} sellers to database`)

      // Reload sellers to get database IDs
      await fetchSellersFromDB(selectedCountry)
      await fetchSellerCounts()

    } catch (error: any) {
      console.error('Error in saveSellersToDatabase:', error)
    }
  }

  const loadGeneratedLinksFromDB = async (countryCode: string) => {
    if (!countryCode || isFetchingMore || !hasMore) return

    if (!supabase) return

    try {
      setIsFetchingMore(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const tableName =
        countryCode === 'usa' ? 'us_sellers' : `${countryCode}_sellers`

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', user.id)
        .order('seller_name', { ascending: true })
        .order('page_number', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1)

      if (error) throw error

      if (!data || data.length === 0) {
        setHasMore(false)
        return
      }

      const FILTER_LABELS: Record<string, string> = {
        default: 'Default',
        'price-asc': 'Price: Low to High',
        'price-desc': 'Price: High to Low',
        review: 'Avg. Customer Review',
        'new-arrival': 'New Arrivals',
        'best-seller': 'Best Sellers',
      }

      const formatted = data.map(link => ({
        id: link.id,
        seller_name: link.seller_name,
        merchant_token: link.merchant_token,
        page_number: link.page_number,
        filter_type: link.filter_type,
        profile_link: link.profile_link,
        badge: link.badge || null,
        filter_label: FILTER_LABELS[link.filter_type] || link.filter_type,
        is_copied: link.is_copied || false,
      }))


      // ✅ APPEND (NOT REPLACE)
      setGeneratedLinks(prev => {
        const existingIds = new Set(prev.map(item => item.id))
        const uniqueNew = formatted.filter(item => !existingIds.has(item.id))
        const newLinks = [...prev, ...uniqueNew]

        // ✅ Restore copied state from database
        const newCopiedSet = new Set<number>()
        newLinks.forEach((link, index) => {
          if (link.is_copied) {
            newCopiedSet.add(index)
          }
        })
        setCopiedLinks(newCopiedSet)

        return newLinks
      })
      setOffset(prev => prev + BATCH_SIZE)

      if (data.length < BATCH_SIZE) {
        setHasMore(false)
      }
    } catch (err) {
      console.error('Error loading links:', err)
    } finally {
      setIsFetchingMore(false)
      setLoadingLinks(false)
    }
  }



  const FILTER_TYPES = [
    { id: 'default', label: 'Default', param: '' },
    { id: 'price-asc', label: 'Price: Low to High', param: 's=price-asc-rank' },
    { id: 'price-desc', label: 'Price: High to Low', param: 's=price-desc-rank' },
    { id: 'review', label: 'Avg. Customer Review', param: 's=review-rank' },
    { id: 'new-arrival', label: 'New Arrivals', param: 's=date-desc-rank' },
    { id: 'best-seller', label: 'Best Sellers', param: 's=exact-aware-popularity-rank' },
  ]

  const addNewRow = () => {
    const newRow: SellerRow = {
      id: Date.now().toString(),
      sellerName: '',
      merchantToken: '',
      page: '',
      totalProducts: '',
      default: false,
      lowToHigh: false,
      highToLow: false,
      avgReview: false,
      newArrivals: false,
      bestSellers: false
    }
    setSellers([...sellers, newRow])
  }

  const deleteSeller = async (id: string) => {
    if (sellers.length === 1) {
      showToast('At least one row is required!', 'warning')
      return
    }

    if (!supabase) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        if (!id.includes('-')) {
          const { error } = await supabase
            .from('sellers_upload')
            .delete()
            .eq('id', id)

          if (error) throw error
        }
      }
    } catch (error) {
      console.error('Error deleting seller:', error)
    }

    setSellers(sellers.filter(s => s.id !== id))
    showToast('Seller deleted successfully!', 'success')
  }

  const clearAllSellers = async () => {

    if (!supabase) return
    setConfirmDialog({
      title: 'Clear All Sellers?',
      message: 'Are you sure you want to clear all sellers? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(null)

        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user && selectedCountry) {
            const { error } = await supabase
              .from('sellers_upload')
              .delete()
              .eq('user_id', user.id)
              .eq('country', selectedCountry)

            if (error) throw error
          }
        } catch (error) {
          console.error('Error clearing sellers:', error)
        }

        setSellers([{
          id: Date.now().toString(),
          sellerName: '',
          merchantToken: '',
          page: '',
          totalProducts: '',
          default: false,
          lowToHigh: false,
          highToLow: false,
          avgReview: false,
          newArrivals: false,
          bestSellers: false
        }])
        showToast('All sellers cleared successfully!', 'success')
      }
    })
  }

  const updateCell = (id: string, field: keyof SellerRow, value: any) => {
    const updatedSellers = sellers.map(seller => {
      if (seller.id === id) {
        const updated = { ...seller, [field]: value }

        if (field === 'totalProducts') {
          const total = parseInt(value) || 0
          // Calculate pages: Every 32 products = 1 page for both filters
          const calculatedPages = Math.ceil(total / 32)
          const pages = Math.min(calculatedPages, 20) // Cap at 20 pages
          updated.page = pages > 0 ? pages.toString() : '0'

          if (total >= 640) {
            // 640+ products: All 6 filters with 20 pages each
            updated.default = true
            updated.lowToHigh = true
            updated.highToLow = true
            updated.avgReview = true
            updated.newArrivals = true
            updated.bestSellers = true
          } else if (total > 0) {
            // 1-639 products: Only low-to-high and high-to-low filters
            updated.default = false
            updated.lowToHigh = true
            updated.highToLow = true
            updated.avgReview = false
            updated.newArrivals = false
            updated.bestSellers = false
          } else {
            // 0 products: No filters
            updated.default = false
            updated.lowToHigh = false
            updated.highToLow = false
            updated.avgReview = false
            updated.newArrivals = false
            updated.bestSellers = false
            updated.page = '0'
          }
        }

        return updated
      }
      return seller
    })

    setSellers(updatedSellers)

    // ✅ Auto-save after edit (debounced by 1 second)
    if (window.autoSaveTimeout) clearTimeout(window.autoSaveTimeout)
    window.autoSaveTimeout = setTimeout(() => {
      saveSellersToDatabase(updatedSellers)
    }, 1000)
  }


  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!selectedCountry) {
      showToast('Please select a country first!', 'warning')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet)

        if (jsonData.length === 0) {
          showToast('Excel file is empty!', 'error')
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

        const newSellers: SellerRow[] = jsonData.map((row, index) => {
          const sellerName = getColumnValue(row, ['Seller Name', 'sellername', 'seller', 'name']) || ''
          const merchantToken = getColumnValue(row, ['Merchant Token', 'merchanttoken', 'token', 'merchant']) || ''
          const totalProducts = parseInt(getColumnValue(row, ['Total No Of Product', 'Total Products', 'total_products', 'products']) || '0')

          // Calculate pages: Every 32 products = 1 page (for both filters)
          const calculatedPages = Math.ceil(totalProducts / 32)
          const pages = Math.min(calculatedPages, 20) // Cap at 20 pages

          let filters = {
            default: false,
            lowToHigh: false,
            highToLow: false,
            avgReview: false,
            newArrivals: false,
            bestSellers: false
          }

          if (totalProducts >= 640) {
            // 640+ products: All 6 filters
            filters = {
              default: true,
              lowToHigh: true,
              highToLow: true,
              avgReview: true,
              newArrivals: true,
              bestSellers: true
            }
          } else if (totalProducts > 0) {
            // 1-639 products: Only low-to-high and high-to-low
            filters.lowToHigh = true
            filters.highToLow = true
          }


          return {
            id: `${Date.now()}-${index}`,
            sellerName,
            merchantToken,
            page: pages.toString(),
            totalProducts: totalProducts.toString(),
            ...filters
          }
        })

        setSellers(newSellers)
        showToast(`Successfully uploaded ${newSellers.length} sellers!`, 'success')
        // ✅ Auto-save to database immediately after upload
        setTimeout(() => {
          saveSellersToDatabase(newSellers)
        }, 500)
      } catch (error) {
        console.error('Error reading file:', error)
        showToast('Error reading Excel file. Please check the format.', 'error')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const generateProfileLink = (merchantToken: string, page: number, filterType: string, country: string) => {
    const baseUrls: Record<string, string> = {
      'usa': 'https://www.amazon.com/s?me=',
      'india': 'https://www.amazon.in/s?me=',
      'uae': 'https://www.amazon.ae/s?me=',
      'uk': 'https://www.amazon.co.uk/s?me='
    }

    const baseUrl = `${baseUrls[country] || baseUrls['usa']}${merchantToken}`
    const filter = FILTER_TYPES.find((f) => f.id === filterType)
    const filterParam = filter?.param

    if (filterParam) {
      return `${baseUrl}&${filterParam}&page=${page}`
    }
    return `${baseUrl}&page=${page}`
  }

  const handleGenerateLinks = async () => {

    if (!supabase) return
    if (!selectedCountry) {
      showToast('Please select a country first!', 'warning')
      return
    }

    const validSellers = sellers.filter(s => s.sellerName && s.merchantToken && s.totalProducts)

    if (validSellers.length === 0) {
      showToast('Please add at least one seller with name, token, and product count!', 'warning')
      return
    }

    const generatedLinksArray: any[] = []

    validSellers.forEach(seller => {
      const totalProducts = parseInt(seller.totalProducts) || 0
      const selectedFilters = []
      let numberOfPages = 0

      if (totalProducts >= 640) {
        // 640+ products: All 6 filters with 20 pages each (120 links total)
        if (seller.default) selectedFilters.push('default')
        if (seller.lowToHigh) selectedFilters.push('price-asc')
        if (seller.highToLow) selectedFilters.push('price-desc')
        if (seller.avgReview) selectedFilters.push('review')
        if (seller.newArrivals) selectedFilters.push('new-arrival')
        if (seller.bestSellers) selectedFilters.push('best-seller')
        numberOfPages = 20
      } else if (totalProducts > 0) {
        // 1-639 products: Only low-to-high and high-to-low filters
        if (seller.lowToHigh) selectedFilters.push('price-asc')
        if (seller.highToLow) selectedFilters.push('price-desc')

        // Calculate pages: Every 32 products = 1 page (max 20 pages)
        numberOfPages = Math.ceil(totalProducts / 32)
        numberOfPages = Math.min(numberOfPages, 20)
      }


      for (const filterId of selectedFilters) {
        for (let page = 1; page <= numberOfPages; page++) {
          const profileLink = generateProfileLink(seller.merchantToken, page, filterId, selectedCountry)
          const filterLabel = FILTER_TYPES.find(f => f.id === filterId)?.label || 'Default'

          generatedLinksArray.push({
            seller_name: seller.sellerName,
            merchant_token: seller.merchantToken,
            page_number: page,
            filter_type: filterId,
            filter_label: filterLabel,
            profile_link: profileLink
          })
        }
      }
    })

    localStorage.setItem('generatedLinks', JSON.stringify(generatedLinksArray))
    localStorage.setItem('generatedLinksCountry', selectedCountry)

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('Session error:', sessionError)
        showToast(`Generated ${generatedLinksArray.length} links (saved locally - auth error)`, 'warning')
        await loadGeneratedLinksFromDB(selectedCountry)
        setCurrentView('links')
        return
      }

      if (!session) {
        console.log('No active session found')
        showToast(`Generated ${generatedLinksArray.length} links (saved locally - login to persist)`, 'info')
        await loadGeneratedLinksFromDB(selectedCountry)
        setCurrentView('links')
        return
      }
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        console.error('User error:', userError)
        showToast(`Generated ${generatedLinksArray.length} links (saved locally - no user)`, 'warning')
        await loadGeneratedLinksFromDB(selectedCountry)
        setCurrentView('links')
        return
      }

      console.log('✅ User authenticated:', user.id)

      const tableName = selectedCountry === 'usa' ? 'us_sellers' : `${selectedCountry}_sellers`
      console.log('📝 Saving to table:', tableName)

      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Delete error:', deleteError)
      }

      const linksWithUserId = generatedLinksArray.map(link => ({
        ...link,
        user_id: user.id
      }))

      const { error: insertError } = await supabase
        .from(tableName)
        .insert(linksWithUserId)

      if (insertError) {
        console.error('❌ Database save error:', insertError)
        showToast(`Generated ${generatedLinksArray.length} links (saved locally - DB error: ${insertError.message})`, 'error')
      } else {
        console.log('✅ Successfully saved to database')
        showToast(`Generated ${generatedLinksArray.length} links and saved to database!`, 'success')
      }
    } catch (error) {
      console.error('Error saving to database:', error)
      showToast(`Generated ${generatedLinksArray.length} links (saved locally only)`, 'warning')
    }

    await loadGeneratedLinksFromDB(selectedCountry)
    setCurrentView('links')
    await fetchSellerCounts()
  }


  const handleCountryCardClick = (countryId: string) => {
    // ✅ If clicking the same country again, do nothing
    if (countryId === selectedCountry) return

    setSelectedCountry(countryId)
    setCurrentView('links')

    // reset only selection-related UI
    setSelectedLinks(new Set())
    setSelectAll(false)
    setSelectAllInDB(false)
    setSearchQuery('')
    setFocusedRowIndex(null)

    // ✅ reset data ONLY because country actually changed
    setGeneratedLinks([])
    setOffset(0)
    setHasMore(true)
    setLoadingLinks(true)

    // ✅ Sellers will be loaded automatically by the useEffect
    // (no need to reset sellers here)
  }


  const deleteLink = async (index: number) => {

    if (!supabase) return
    setConfirmDialog({
      title: 'Delete Link?',
      message: 'Are you sure you want to delete this link? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(null)

        try {
          const linkToDelete = generatedLinks[index]
          const { data: { user } } = await supabase.auth.getUser()
          if (user && linkToDelete.id) {
            const tableName = selectedCountry === 'usa' ? 'us_sellers' : `${selectedCountry}_sellers`

            const { error } = await supabase
              .from(tableName)
              .delete()
              .eq('id', linkToDelete.id)

            if (error) throw error
          }

          const updatedLinks = generatedLinks.filter((_, i) => i !== index)
          setGeneratedLinks(updatedLinks)
          localStorage.setItem('generatedLinks', JSON.stringify(updatedLinks))

          // Clear copied state for deleted link
          setCopiedLinks(prev => {
            const newSet = new Set(prev)
            newSet.delete(index)
            return newSet
          })

          showToast('Link deleted successfully!', 'success')
          await fetchSellerCounts()
        } catch (error) {
          console.error('Error deleting link:', error)
          showToast('Error deleting link', 'error')
        }
      }
    })
  }


  // ✅ ULTIMATE FIX: Select ALL filtered links (with correct property names)
  const handleSelectAll = () => {
    if (selectAll) {
      // Unselect all
      setSelectedLinks(new Set())
      setSelectAll(false)
    } else {
      // Select ALL by iterating generatedLinks and checking against search
      const allIndexes = new Set<number>()

      const query = searchQuery.toLowerCase()

      generatedLinks.forEach((link, index) => {
        // Apply same filter logic as filteredLinks
        if (!searchQuery.trim()) {
          // No search - select all
          allIndexes.add(index)
        } else {
          // Has search - check if matches (use correct property names with underscores)
          const matches =
            link.seller_name?.toLowerCase().includes(query) ||
            link.merchant_token?.toLowerCase().includes(query) ||
            link.filter_label?.toLowerCase().includes(query) ||
            link.filter_type?.toLowerCase().includes(query)

          if (matches) {
            allIndexes.add(index)
          }
        }
      })

      setSelectedLinks(allIndexes)
      setSelectAll(true)
    }
  }


  const handleCheckboxChange = (index: number) => {
    const newSelected = new Set(selectedLinks)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedLinks(newSelected)

    // Check if all FILTERED links are selected
    const filteredIndexes = filteredLinks.map(link =>
      generatedLinks.findIndex(l =>
        l.seller_name === link.seller_name &&
        l.merchant_token === link.merchant_token &&
        l.page_number === link.page_number &&
        l.filter_type === link.filter_type
      )
    )
    setSelectAll(filteredIndexes.every(idx => newSelected.has(idx)))
  }

  const handleBulkDelete = async () => {
    if (!supabase) return
    if (selectedLinks.size === 0) {
      showToast('Please select at least one link to delete!', 'warning')
      return
    }
    // ✅ NEW: Delete ALL links from database for current country
    const handleDeleteAll = async () => {
      if (!supabase) return
      if (!selectedCountry) return

      setConfirmDialog({
        title: '⚠️ Delete ALL Links?',
        message: `Are you sure you want to delete ALL links for ${selectedCountry.toUpperCase()}? This will delete all links from the database permanently. This action cannot be undone.`,
        onConfirm: async () => {
          setConfirmDialog(null)
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
              showToast('Please login to delete links', 'error')
              return
            }

            const tableName = selectedCountry === 'usa' ? 'us_sellers' : `${selectedCountry}_sellers`

            // Delete ALL links for this user and country
            const { error } = await supabase
              .from(tableName)
              .delete()
              .eq('user_id', user.id)

            if (error) throw error

            // Reset all states
            setGeneratedLinks([])
            setSelectedLinks(new Set())
            setSelectAll(false)
            setCopiedLinks(new Set())
            setOffset(0)
            setHasMore(false)
            setLoadingLinks(false)

            showToast(`All links deleted successfully for ${selectedCountry.toUpperCase()}!`, 'success')

            // Update seller counts
            await fetchSellerCounts()
          } catch (error) {
            console.error('Error deleting all links:', error)
            showToast('Error deleting all links', 'error')
          }
        }
      })
    }

    setConfirmDialog({
      title: 'Delete Links?',
      message: `Are you sure you want to delete ${selectedLinks.size} selected links? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(null)
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const tableName = selectedCountry === 'usa' ? 'us_sellers' : `${selectedCountry}_sellers`

            const linksToDelete = Array.from(selectedLinks).map(index => generatedLinks[index])
            const idsToDelete = linksToDelete.filter(link => link.id).map(link => link.id!)

            if (idsToDelete.length > 0) {
              const { error } = await supabase
                .from(tableName)
                .delete()
                .in('id', idsToDelete)

              if (error) throw error
            }
          }

          // ✅ FIXED: Reset pagination and reload from database
          setGeneratedLinks([])
          setSelectedLinks(new Set())
          setSelectAll(false)
          setCopiedLinks(new Set())

          // Reset pagination state to reload fresh data
          setOffset(0)
          setHasMore(true)
          setLoadingLinks(true)

          showToast(`Successfully deleted ${selectedLinks.size} links!`, 'success')

          // Reload data from database
          await loadGeneratedLinksFromDB(selectedCountry)
          await fetchSellerCounts()
        } catch (error) {
          console.error('Error bulk deleting:', error)
          showToast('Error deleting links', 'error')
        }
      }
    })
  }

  const handleDeleteAll = async () => {
    if (!supabase) return
    if (!selectedCountry) return

    setConfirmDialog({
      title: '⚠️ Delete ALL Links?',
      message: `Are you sure you want to delete ALL links for ${selectedCountry.toUpperCase()}? This will delete all links from the database permanently. This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(null)
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            showToast('Please login to delete links', 'error')
            return
          }

          const tableName = selectedCountry === 'usa' ? 'us_sellers' : `${selectedCountry}_sellers`

          // Delete ALL links for this user and country
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('user_id', user.id)

          if (error) throw error

          // Reset all states
          setGeneratedLinks([])
          setSelectedLinks(new Set())
          setSelectAll(false)
          setCopiedLinks(new Set())
          setOffset(0)
          setHasMore(false)
          setLoadingLinks(false)

          showToast(`All links deleted successfully for ${selectedCountry.toUpperCase()}!`, 'success')

          // Update seller counts
          await fetchSellerCounts()
        } catch (error) {
          console.error('Error deleting all links:', error)
          showToast('Error deleting all links', 'error')
        }
      }
    })
  }

  const copyToClipboard = async (text: string, index: number) => {
    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(text)

      // Update local state immediately
      setGeneratedLinks(prev => prev.map((link, i) =>
        i === index ? { ...link, is_copied: true } : link
      ))

      // UPDATE DATABASE - Mark as copied
      if (supabase) {
        const linkToUpdate = generatedLinks[index]
        if (linkToUpdate?.id) {
          const tableName = selectedCountry === 'usa' ? 'us_sellers' : `${selectedCountry}_sellers`
          const { error } = await supabase
            .from(tableName)
            .update({ is_copied: true })
            .eq('id', linkToUpdate.id)

          if (error) {
            console.error('Error updating is_copied:', error)
          } else {
            console.log('✅ Link marked as copied in database!')
          }
        }
      }

      showToast('Link copied and marked!', 'success')
    } catch (error) {
      console.error('Copy failed:', error)
      showToast('Failed to copy link', 'error')
    }
  }
  const handleEditLink = (index: number) => {
    const link = generatedLinks[index]
    setEditingRowIndex(index)
    setEditingRowData({ ...link })
  }

  const handleSaveEdit = async () => {
    if (editingRowIndex === null || !editingRowData || !supabase) return

    try {
      const tableName = selectedCountry === 'usa' ? 'us_sellers' : `${selectedCountry}_sellers`

      const { error } = await supabase
        .from(tableName)
        .update({
          seller_name: editingRowData.seller_name,
          merchant_token: editingRowData.merchant_token,
          page_number: editingRowData.page_number,
          filter_type: editingRowData.filter_type,
          profile_link: editingRowData.profile_link
        })
        .eq('id', editingRowData.id)

      if (error) throw error

      // Update local state
      setGeneratedLinks(prev => prev.map((link, i) =>
        i === editingRowIndex ? editingRowData : link
      ))

      setEditingRowIndex(null)
      setEditingRowData(null)
      showToast('Link updated successfully!', 'success')
    } catch (error) {
      console.error('Error updating link:', error)
      showToast('Failed to update link', 'error')
    }
  }

  const handleCancelEdit = () => {
    setEditingRowIndex(null)
    setEditingRowData(null)
  }

  const copyAllLinks = () => {
    const allLinks = generatedLinks.map(link => link.profile_link).join('\n')
    navigator.clipboard.writeText(allLinks)
    showToast(`Copied ${generatedLinks.length} links to clipboard!`, 'success')
  }

  const downloadAsCSV = () => {
    const headers = ['No.', 'Seller Name', 'Merchant Token', 'Page', 'Filter', 'Profile Link']
    const csvContent = [
      headers.join(','),
      ...generatedLinks.map((link, index) => [
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
    a.download = `${selectedCountry}_generated_links_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    showToast('CSV downloaded successfully!', 'success')
  }

  const countryCards = [
    { id: 'usa', name: 'USA', count: sellerCounts.usa, flag: 'US', color: 'from-blue-500 to-blue-600' },
    { id: 'india', name: 'India', count: sellerCounts.india, flag: 'IN', color: 'from-orange-500 to-orange-600' },
    { id: 'uae', name: 'UAE', count: sellerCounts.uae, flag: 'AE', color: 'from-emerald-500 to-emerald-600' },
    { id: 'uk', name: 'UK', count: sellerCounts.uk, flag: 'UK', color: 'from-purple-500 to-purple-600' },
  ]

  return (
    <div className="min-h-screen bg-[#111111] text-gray-100 font-sans selection:bg-orange-400/30">
      <div className="flex h-screen overflow-hidden">
        {/* Left Section - Country Cards */}
        <div className="w-[320px] flex-shrink-0 bg-[#111111] border-r border-white/[0.06] p-6 overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-6">No of Sellers</h2>

          <div className="space-y-3">
            {countryCards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleCountryCardClick(card.id)}
                className={`w-full p-4 rounded-xl border-2 transition-all duration-200 ${selectedCountry === card.id
                  ? 'bg-gradient-to-br ' + card.color + ' border-transparent text-white shadow-lg scale-105'
                  : 'bg-[#111111] border-white/[0.06] hover:border-white/[0.06] hover:bg-slate-750'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <div className={`text-xs font-medium mb-1 ${selectedCountry === card.id ? 'text-white' : 'text-gray-100'}`}>
                      Add {card.name} Seller
                    </div>
                    <div className={`text-3xl font-bold ${selectedCountry === card.id ? 'text-white' : 'text-gray-100'}`}>
                      {card.count}
                    </div>
                  </div>
                  <div className="text-4xl">{card.flag}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Section - Dynamic Content */}
        <div className="flex-1 overflow-y-auto bg-[#111111]">
          <div className="p-6">
            {!selectedCountry ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-500 mb-2">Select a Country</h3>
                  <p className="text-gray-500">Choose a country from the left to manage sellers</p>
                </div>
              </div>
            ) : currentView === 'links' ? (
              // ==================== GENERATED LINKS VIEW ====================
              <>
                <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-100">
                      Generated Links - {selectedCountry.toUpperCase()}
                    </h1>
                    <p className="text-gray-400 mt-2">
                      Total Links: <span className="font-semibold text-emerald-400">{generatedLinks.length}</span>
                      {filteredLinks.length !== generatedLinks.length && (
                        <span className="ml-2 text-orange-500">
                          | Filtered: {filteredLinks.length}
                        </span>
                      )}
                      {selectedLinks.size > 0 && (
                        <span className="ml-4 text-orange-500">Selected: {selectedLinks.size}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedLinks.size > 0 && (
                      <button
                        onClick={handleBulkDelete}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500/100 hover:bg-red-700 text-white font-semibold rounded-lg transition shadow-md flex items-center gap-2 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete ({selectedLinks.size})
                      </button>
                    )}
                    <button
                      onClick={() => setHideCopiedLinks(!hideCopiedLinks)}
                      className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm shadow-md transition ${hideCopiedLinks
                        ? 'bg-[#111111] border border-white/[0.06] hover:bg-[#1a1a1a]'
                        : 'bg-[#111111] border border-white/[0.06] hover:bg-[#1a1a1a]'
                        }`}
                    >
                      {hideCopiedLinks ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Show Copied Links
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                          Hide Copied Links
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setCurrentView('table')}
                      className="px-4 py-2 bg-orange-500/100 hover:bg-orange-400 hover:bg-blue-700 text-white font-semibold rounded-lg transition shadow-md text-sm"
                    >
                      + Add New Seller

                    </button>
                    {/* ✅ NEW: Delete All Button */}
                    {generatedLinks.length > 0 && (
                      <button
                        onClick={handleDeleteAll}
                        className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-lg transition shadow-md flex items-center gap-2 text-sm border-2 border-red-900"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete All
                      </button>
                    )}

                    <button
                      onClick={downloadAsCSV}
                      disabled={generatedLinks.length === 0}
                      className="px-4 py-2 bg-orange-500/100 hover:bg-orange-400 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition shadow-md flex items-center gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      CSV
                    </button>
                    <button
                      onClick={copyAllLinks}
                      disabled={generatedLinks.length === 0}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500/100 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition shadow-md flex items-center gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy All
                    </button>
                  </div>
                </div>

                {/* SEARCH BAR */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setFocusedRowIndex(null) // Clear focus on search
                      }}
                      placeholder="Search by seller name, merchant token, or filter type..."
                      className="w-full px-4 py-3 pl-10 bg-[#111111] border border-white/[0.06] rounded-lg focus:ring-2 focus:ring-orange-500/50 focus:border-transparent transition text-gray-100 placeholder:text-gray-500"
                    />
                    <svg
                      className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-500"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* KEYBOARD WORKFLOW HINT */}
                {filteredLinks.length > 0 && (
                  <div className="mb-4 p-3 bg-[#1a1a1a] border border-white/[0.06] rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-300 flex-wrap">
                      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      <span className="font-semibold text-orange-400">Keyboard Workflow:</span>
                      <span>Click any link to select it</span>
                      <span className="mx-1">→</span>
                      <span>Use <kbd className="px-2 py-0.5 bg-[#111111] border-white/[0.06] text-gray-500 rounded text-xs font-mono">↑</kbd> <kbd className="px-2 py-0.5 bg-[#111111] border-white/[0.06] text-gray-500 rounded text-xs font-mono">↓</kbd> to navigate</span>
                      <span className="mx-1">→</span>
                      <span>Press <kbd className="px-2 py-0.5 bg-[#111111] border-white/[0.06] text-gray-500 rounded text-xs font-mono">Ctrl+C</kbd> to copy & auto-mark as copied</span>
                    </div>
                  </div>
                )}

                {loadingLinks ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  </div>
                ) : filteredLinks.length > 0 ? (
                  <div className="bg-[#111111] rounded-lg shadow-md overflow-hidden border border-white/[0.06]">
                    <div
                      ref={linksScrollRef}
                      className="overflow-x-auto overflow-y-auto"
                      style={{ maxHeight: '70vh' }}
                      onScroll={(e) => {

                        const el = e.currentTarget
                        if (
                          el.scrollTop + el.clientHeight >=
                          el.scrollHeight - 300
                        ) {
                          loadGeneratedLinksFromDB(selectedCountry)
                        }
                      }}
                    >
                      <table className="w-full border-collapse min-w-[1000px]">
                        <thead>
                          <tr className="bg-[#111111] border-b border-white/[0.06]">
                            <th className="px-6 py-4 text-center border-r border-white/[0.06] w-12">
                              <input
                                type="checkbox"
                                checked={selectAll}
                                onChange={handleSelectAll}
                                className="w-4 h-4 text-orange-500 border-white/[0.06] rounded focus:ring-orange-500 cursor-pointer bg-[#111111]"
                              />
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase border-r border-white/[0.06] w-16">No.</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase border-r border-white/[0.06] min-w-[150px]">Seller Name</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase border-r border-white/[0.06] min-w-[120px]">Merchant Token</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase border-r border-white/[0.06] w-20">Page</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase border-r border-white/[0.06] min-w-[130px]">Filter Type</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase border-r border-white/[0.06] min-w-[250px]">Profile Link</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase w-32">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLinks
                            .filter((link, filteredIndex) => {
                              const originalIndex = generatedLinks.findIndex(
                                (l) => l.seller_name === link.seller_name &&
                                  l.merchant_token === link.merchant_token &&
                                  l.page_number === link.page_number &&
                                  l.filter_type === link.filter_type
                              )
                              // Hide if hideCopiedLinks is true AND this link is copied
                              return !hideCopiedLinks || !copiedLinks.has(originalIndex)
                            })
                            .map((link, filteredIndex) => {
                              const originalIndex = generatedLinks.findIndex(
                                (l) => l.seller_name === link.seller_name &&
                                  l.merchant_token === link.merchant_token &&
                                  l.page_number === link.page_number &&
                                  l.filter_type === link.filter_type
                              )

                              return (
                                <tr
                                  key={link.id}
                                  id={`link-row-${originalIndex}`}
                                  onClick={() => editingRowIndex !== originalIndex && setFocusedRowIndex(originalIndex)}
                                  className={`border-b border-white/[0.06] hover:bg-[#111111]/60 cursor-pointer transition-colors ${selectedLinks.has(originalIndex) ? 'bg-orange-500/100/10' : ''
                                    } ${focusedRowIndex === originalIndex ? 'ring-1 ring-orange-500 bg-orange-500/100/10' : ''} ${editingRowIndex === originalIndex ? 'bg-amber-500/100/20 ring-1 ring-amber-500' : ''
                                    }`}
                                >
                                  {/* Checkbox */}
                                  <td className="px-6 py-4 text-center border-r border-white/[0.06]">
                                    <input
                                      type="checkbox"
                                      checked={selectedLinks.has(originalIndex)}
                                      onChange={() => handleCheckboxChange(originalIndex)}
                                      className="w-4 h-4 text-orange-500 border-white/[0.06] rounded focus:ring-orange-500 cursor-pointer bg-[#111111]"
                                    />
                                  </td>

                                  {/* No. */}
                                  <td className="px-6 py-4 text-sm text-gray-300 font-medium border-r border-white/[0.06]">
                                    {filteredIndex + 1}
                                  </td>

                                  {/* Seller Name - EDITABLE */}
                                  <td className="px-6 py-4 text-sm text-gray-100 font-medium border-r border-white/[0.06]">
                                    {editingRowIndex === originalIndex ? (
                                      <input
                                        type="text"
                                        value={editingRowData?.seller_name || ''}
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, seller_name: e.target.value } : null)}
                                        className="w-full px-2 py-1 bg-[#111111] border border-white/[0.06] rounded focus:ring-2 focus:ring-orange-500 text-gray-100"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      link.seller_name
                                    )}
                                  </td>

                                  {/* Merchant Token - EDITABLE */}
                                  <td className="px-6 py-4 text-sm font-mono text-gray-300 border-r border-white/[0.06]">
                                    {editingRowIndex === originalIndex ? (
                                      <input
                                        type="text"
                                        value={editingRowData?.merchant_token || ''}
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, merchant_token: e.target.value } : null)}
                                        className="w-full px-2 py-1 bg-[#111111] border border-white/[0.06] rounded focus:ring-2 focus:ring-orange-500 text-gray-100 font-mono"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      link.merchant_token
                                    )}
                                  </td>

                                  {/* Page Number - EDITABLE */}
                                  <td className="px-6 py-4 text-sm text-center border-r border-white/[0.06]">
                                    {editingRowIndex === originalIndex ? (
                                      <input
                                        type="number"
                                        value={editingRowData?.page_number || 1}
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, page_number: parseInt(e.target.value) || 1 } : null)}
                                        className="w-20 px-2 py-1 bg-[#111111] border border-white/[0.06] rounded focus:ring-2 focus:ring-orange-500 text-gray-100 text-center"
                                        onClick={(e) => e.stopPropagation()}
                                        min="1"
                                        max="20"
                                      />
                                    ) : (
                                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/100/10 text-orange-400 font-semibold text-xs">
                                        {link.page_number}
                                      </span>
                                    )}
                                  </td>

                                  {/* Filter Type */}
                                  <td className="px-6 py-4 text-sm border-r border-white/[0.06]">
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-500/20 text-purple-300">
                                      {link.filter_label}
                                    </span>
                                  </td>

                                  {/* Profile Link */}
                                  <td className="px-6 py-4 text-sm text-orange-500 border-r border-white/[0.06]">
                                    <a
                                      href={link.profile_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-orange-400 hover:underline truncate block max-w-[250px]"
                                    >
                                      {link.profile_link}
                                    </a>
                                  </td>

                                  {/* Action Column */}
                                  <td className="px-6 py-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      {editingRowIndex === originalIndex ? (
                                        <>
                                          {/* Save Button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleSaveEdit()
                                            }}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500/100 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow-md flex items-center gap-1"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Save
                                          </button>

                                          {/* Cancel Button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleCancelEdit()
                                            }}
                                            className="px-3 py-1.5 border-2 border-white/[0.06] text-gray-500 hover:bg-[#1a1a1a] hover:border-slate-500 text-xs font-semibold rounded-lg transition-all"
                                          >
                                            Cancel
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          {/* Copy Button - Solid Indigo */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              copyToClipboard(link.profile_link, originalIndex)
                                            }}
                                            disabled={link.is_copied}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shadow-sm ${link.is_copied
                                              ? 'bg-emerald-600 hover:bg-emerald-500/100 text-white cursor-default'
                                              : 'bg-orange-500/100 hover:bg-orange-600 text-white hover:shadow-md'
                                              }`}
                                            title={link.is_copied ? 'Copied ✓' : 'Copy link'}
                                          >
                                            {link.is_copied ? (
                                              <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Copied
                                              </>
                                            ) : (
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                              </svg>
                                            )}
                                          </button>

                                          {/* Edit Button - Outline Amber with Fill on Hover */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleEditLink(originalIndex)
                                            }}
                                            className="p-2 border-2 border-amber-500 text-amber-500 hover:bg-amber-500/100 hover:text-white hover:scale-105 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                                            title="Edit link"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                          </button>

                                          {/* Delete Button - Outline Rose with Fill on Hover */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              deleteLink(originalIndex)
                                            }}
                                            className="p-2 border-2 border-rose-500 text-rose-500 hover:bg-rose-500/100 hover:text-white hover:scale-105 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                                            title="Delete link"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>

                                </tr>

                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#111111] rounded-lg shadow-md p-12 text-center border border-white/[0.06]">
                    <svg className="w-20 h-20 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-2xl font-semibold text-gray-100 mb-2">
                      {searchQuery ? 'No Results Found' : 'No Links Generated Yet'}
                    </h3>
                    <p className="text-gray-500 mb-6">
                      {searchQuery
                        ? `No links match "${searchQuery}". Try a different search term.`
                        : 'Add sellers and generate links to see them here.'
                      }
                    </p>
                    {searchQuery ? (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="px-6 py-3 bg-orange-500/100 hover:bg-orange-400 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                      >
                        Clear Search
                      </button>
                    ) : (
                      <button
                        onClick={() => setCurrentView('table')}
                        className="px-6 py-3 bg-orange-500/100 hover:bg-orange-400 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                      >
                        Add Sellers Now
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              // ==================== ADD SELLER TABLE VIEW ====================
              <>
                <div className="mb-4">
                  <button
                    onClick={() => setCurrentView('links')}
                    className="px-4 py-2 bg-[#111111] hover:bg-[#1a1a1a] text-gray-500 font-semibold rounded-lg transition flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Generated Links
                  </button>
                </div>

                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500/100 hover:bg-green-700 text-white font-semibold rounded-lg cursor-pointer transition shadow-md text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Bulk Upload
                      <input type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} className="hidden" />
                    </label>

                    <button onClick={clearAllSellers} className="px-4 py-2 bg-rose-600 hover:bg-rose-500/100 hover:bg-red-700 text-white font-semibold rounded-lg transition shadow-md flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear All
                    </button>
                  </div>

                  <button onClick={handleGenerateLinks} className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-bold hover:from-emerald-700 hover:to-emerald-800 transition shadow-lg flex items-center gap-2 text-sm">
                    Generate Links →
                  </button>
                </div>

                <div className="bg-[#111111] rounded-lg border border-white/[0.06] overflow-hidden shadow-sm">
                  <div className="overflow-x-auto links-scroll-container">
                    <table className="w-full border-collapse" style={{ minWidth: '1200px' }}>
                      <thead className="sticky top-0 bg-[#111111] z-10">
                        <tr className="border-b-2 border-white/[0.06]">
                          <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 border-r border-white/[0.06] w-12 bg-[#111111]">No.</th>
                          <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 border-r border-white/[0.06] bg-[#111111]" style={{ minWidth: '140px' }}>Seller Name</th>
                          <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 border-r border-white/[0.06] bg-[#111111]" style={{ minWidth: '130px' }}>Merchant Token</th>
                          <th className="px-2 py-3 text-center text-xs font-bold text-gray-400 border-r border-white/[0.06] w-16 bg-[#111111]">Page</th>
                          <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 border-r border-white/[0.06] w-32 bg-[#111111]">Total Products</th>
                          <th className="px-2 py-3 text-center text-xs font-bold text-gray-400 border-r border-white/[0.06] w-16 bg-[#111111]">Default</th>
                          <th className="px-2 py-3 text-center text-xs font-bold text-gray-400 border-r border-white/[0.06] w-20 bg-[#111111]">Low-High</th>
                          <th className="px-2 py-3 text-center text-xs font-bold text-gray-400 border-r border-white/[0.06] w-20 bg-[#111111]">High-Low</th>
                          <th className="px-2 py-3 text-center text-xs font-bold text-gray-400 border-r border-white/[0.06] w-20 bg-[#111111]">Avg Rvw</th>
                          <th className="px-2 py-3 text-center text-xs font-bold text-gray-400 border-r border-white/[0.06] w-16 bg-[#111111]">New</th>
                          <th className="px-2 py-3 text-center text-xs font-bold text-gray-400 border-r border-white/[0.06] w-16 bg-[#111111]">Best</th>
                          <th className="px-2 py-3 text-center text-xs font-bold text-gray-400 w-20 bg-[#111111]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sellers.map((seller, index) => (
                          <tr key={seller.id} className="border-b border-white/[0.06] hover:bg-[#111111]/60 transition">
                            <td className="px-2 py-2 text-sm text-gray-300 font-medium border-r border-white/[0.06]">{index + 1}</td>
                            <td className="px-2 py-2 border-r border-white/[0.06]">
                              <input
                                type="text"
                                value={seller.sellerName}
                                onChange={(e) => updateCell(seller.id, 'sellerName', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm bg-[#111111] border border-white/[0.06] rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100"
                                placeholder="Seller name"
                              />
                            </td>
                            <td className="px-2 py-2 border-r border-white/[0.06]">
                              <input
                                type="text"
                                value={seller.merchantToken}
                                onChange={(e) => updateCell(seller.id, 'merchantToken', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm bg-[#111111] border border-white/[0.06] rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono text-gray-100"
                                placeholder="AC626B"
                              />
                            </td>
                            <td className="px-2 py-2 border-r border-white/[0.06]">
                              <input
                                type="text"
                                value={seller.page}
                                readOnly
                                className="w-full px-2 py-1.5 text-sm border border-white/[0.06] rounded bg-[#111111] text-center font-semibold text-gray-400"
                              />
                            </td>
                            <td className="px-2 py-2 border-r border-white/[0.06]">
                              <input
                                type="number"
                                value={seller.totalProducts}
                                onChange={(e) => updateCell(seller.id, 'totalProducts', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm bg-[#111111] border border-white/[0.06] rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100"
                                placeholder="0"
                                min="0"
                              />
                            </td>
                            <td className="px-2 py-2 text-center border-r border-white/[0.06]">
                              <input
                                type="checkbox"
                                checked={seller.default}
                                onChange={(e) => updateCell(seller.id, 'default', e.target.checked)}
                                className="w-4 h-4 text-orange-500 border-white/[0.06] rounded focus:ring-orange-500 cursor-pointer bg-[#111111]"
                              />
                            </td>
                            <td className="px-2 py-2 text-center border-r border-white/[0.06]">
                              <input
                                type="checkbox"
                                checked={seller.lowToHigh}
                                onChange={(e) => updateCell(seller.id, 'lowToHigh', e.target.checked)}
                                className="w-4 h-4 text-orange-500 border-white/[0.06] rounded focus:ring-orange-500 cursor-pointer bg-[#111111]"
                              />
                            </td>
                            <td className="px-2 py-2 text-center border-r border-white/[0.06]">
                              <input
                                type="checkbox"
                                checked={seller.highToLow}
                                onChange={(e) => updateCell(seller.id, 'highToLow', e.target.checked)}
                                className="w-4 h-4 text-orange-500 border-white/[0.06] rounded focus:ring-orange-500 cursor-pointer bg-[#111111]"
                              />
                            </td>
                            <td className="px-2 py-2 text-center border-r border-white/[0.06]">
                              <input
                                type="checkbox"
                                checked={seller.avgReview}
                                onChange={(e) => updateCell(seller.id, 'avgReview', e.target.checked)}
                                className="w-4 h-4 text-orange-500 border-white/[0.06] rounded focus:ring-orange-500 cursor-pointer bg-[#111111]"
                              />
                            </td>
                            <td className="px-2 py-2 text-center border-r border-white/[0.06]">
                              <input
                                type="checkbox"
                                checked={seller.newArrivals}
                                onChange={(e) => updateCell(seller.id, 'newArrivals', e.target.checked)}
                                className="w-4 h-4 text-orange-500 border-white/[0.06] rounded focus:ring-orange-500 cursor-pointer bg-[#111111]"
                              />
                            </td>
                            <td className="px-2 py-2 text-center border-r border-white/[0.06]">
                              <input
                                type="checkbox"
                                checked={seller.bestSellers}
                                onChange={(e) => updateCell(seller.id, 'bestSellers', e.target.checked)}
                                className="w-4 h-4 text-orange-500 border-white/[0.06] rounded focus:ring-orange-500 cursor-pointer bg-[#111111]"
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={() => deleteSeller(seller.id)}
                                className="p-1.5 bg-rose-600 hover:bg-rose-500/100 hover:bg-red-700 text-white rounded transition inline-flex items-center justify-center"
                                title="Delete seller"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    onClick={addNewRow}
                    className="px-5 py-2 bg-orange-500/100 hover:bg-orange-400 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-md flex items-center gap-2 text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Row
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  )
}