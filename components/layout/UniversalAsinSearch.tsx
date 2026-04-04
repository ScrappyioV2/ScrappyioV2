'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Search, X, Loader2, ExternalLink, ChevronRight } from 'lucide-react'
import { createPortal } from 'react-dom'

// ─── TYPES ───────────────────────────────────────────────
type ResolvedHit = {
    marketplace: string
    emoji: string
    stage: string
    stageLabel: string
    routePath: string
    seller?: string
    detail?: string
    productName?: string
    status?: string
}

// ─── SELLER CONFIG ───────────────────────────────────────
const SELLERS = [
    { id: 1, name: 'Golden Aura', slug: 'golden-aura' },
    { id: 2, name: 'Rudra Retail', slug: 'rudra-retail' },
    { id: 3, name: 'UBeauty', slug: 'ubeauty' },
    { id: 4, name: 'Velvet Vista', slug: 'velvet-vista' },
    { id: 5, name: 'Dropy Ecom', slug: 'dropy-ecom' },
    { id: 6, name: 'Costech Ventures', slug: 'costech-ventures' },
    { id: 7, name: 'Maverick', slug: 'maverick' },
    { id: 8, name: 'Kalash', slug: 'kalash' },
]

function seller(id: number) {
    return SELLERS.find(s => s.id === id)
}

function catLabel(raw: string): string {
    return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── PIPELINE DEFINITIONS ────────────────────────────────
type PipelineStage = { key: string; label: string }

const STANDARD_PIPELINE: PipelineStage[] = [
    { key: 'brand-checking', label: 'Brand Checking' },
    { key: 'validation', label: 'Validation' },
    { key: 'admin-validation', label: 'Admin Val' },
    { key: 'purchases', label: 'Purchases' },
    { key: 'tracking', label: 'Tracking' },
    { key: 'listing-error', label: 'Listing Error' },
    { key: 'reorder', label: 'Reorder' },
]

const INDIA_PIPELINE: PipelineStage[] = [
    { key: 'brand-checking', label: 'Brand Checking' },
    { key: 'validation', label: 'Validation' },
    { key: 'admin-validation', label: 'Admin Val' },
    { key: 'purchases', label: 'Purchases' },
    { key: 'tracking', label: 'Tracking' },
    { key: 'listing-error', label: 'Listing Error' },
    { key: 'restock', label: 'Restock' },
    { key: 'reorder', label: 'Reorder' },
]

const FLIPKART_PIPELINE: PipelineStage[] = [
    { key: 'brand-checking', label: 'Brand Check' },
    { key: 'listed-bc', label: 'Listed' },
    { key: 'not-listed-bc', label: 'Not Listed' },
    { key: 'validation', label: 'Validation' },
    { key: 'admin-validation', label: 'Admin Val' },
    { key: 'purchases', label: 'Purchases' },
    { key: 'tracking', label: 'Tracking' },
    { key: 'listing-error', label: 'Listing Error' },
    { key: 'reorder', label: 'Reorder' },
]

type MarketplaceInfo = { key: string; label: string; emoji: string; pipeline: PipelineStage[] }

const MARKETPLACE_MAP: Record<string, MarketplaceInfo> = {
    'India': { key: 'india', label: 'India', emoji: '🇮🇳', pipeline: INDIA_PIPELINE },
    'USA': { key: 'usa', label: 'USA', emoji: '🇺🇸', pipeline: STANDARD_PIPELINE },
    'UK': { key: 'uk', label: 'UK', emoji: '🇬🇧', pipeline: STANDARD_PIPELINE },
    'UAE': { key: 'uae', label: 'UAE', emoji: '🇦🇪', pipeline: STANDARD_PIPELINE },
    'Flipkart': { key: 'flipkart', label: 'Flipkart', emoji: '🛒', pipeline: FLIPKART_PIPELINE },
}

// ─── STAGE COLORS ────────────────────────────────────────
const SC: Record<string, { dot: string; text: string; bg: string; border: string }> = {
    'brand-checking': { dot: 'bg-purple-400', text: 'text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-500/30' },
    'listed-bc': { dot: 'bg-indigo-400', text: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/30' },
    'not-listed-bc': { dot: 'bg-violet-400', text: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/30' },
    'validation': { dot: 'bg-blue-400', text: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
    'admin-validation': { dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
    'purchases': { dot: 'bg-cyan-400', text: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
    'tracking': { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
    'listing-error': { dot: 'bg-orange-400', text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
    'restock': { dot: 'bg-sky-400', text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/30' },
    'reorder': { dot: 'bg-pink-400', text: 'text-pink-300', bg: 'bg-pink-500/15', border: 'border-pink-500/30' },
    'manage-sellers': { dot: 'bg-rose-400', text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
    'master': { dot: 'bg-slate-400', text: 'text-slate-300', bg: 'bg-slate-500/15', border: 'border-slate-500/30' },
}
function sc(key: string) { return SC[key] || SC['master'] }


// ─── PATTERN-BASED TABLE RESOLVER ────────────────────────
function resolveTable(tableName: string, productName?: string | null, status?: string | null): ResolvedHit | null {
    let m: RegExpMatchArray | null

    // ═══ INDIA ═══════════════════════════════════════════

    // Brand Checking: india_seller_X_category (CORRECT — NOT india_brand_checking_seller_X)
    m = tableName.match(/^india_seller_(\d+)_(high_demand|low_demand|dropshipping|not_approved|reject)$/)
    if (m) {
        const s = seller(+m[1]); if (!s) return null
        return mk('India', 'brand-checking', 'Brand Checking', `/dashboard/india-selling/brand-checking/${s.slug}`, s.name, catLabel(m[2]), productName, status)
    }

    if (tableName === 'india_validation_main_file')
        return mk('India', 'validation', 'Validation', '/dashboard/india-selling/validation', undefined, undefined, productName, status)

    if (tableName === 'india_admin_validation')
        return mk('India', 'admin-validation', 'Admin Validation', '/dashboard/india-selling/admin-validation', undefined, undefined, productName, status)

    if (tableName === 'india_purchases')
        return mk('India', 'purchases', 'Purchases', '/dashboard/india-selling/purchases', undefined, undefined, productName, status)

    if (tableName === 'india_inbound_tracking')
        return mk('India', 'tracking', 'Tracking', '/dashboard/india-selling/tracking', undefined, 'Inbound', productName, status)

    if (tableName === 'india_box_checking')
        return mk('India', 'tracking', 'Tracking', '/dashboard/india-selling/tracking', undefined, 'Checking', productName, status)

    if (tableName === 'india_seller_distribution')
        return mk('India', 'tracking', 'Tracking', '/dashboard/india-selling/tracking', undefined, 'Distribution', productName, status)

    m = tableName.match(/^india_tracking_seller_(\d+)$/)
    if (m) return mk('India', 'tracking', 'Tracking', '/dashboard/india-selling/tracking', seller(+m[1])?.name, 'Box Tracking', productName, status)

    m = tableName.match(/^india_(invoice|checking|shipment|vyapar)_seller_(\d+)$/)
    if (m) return mk('India', 'tracking', 'Tracking', '/dashboard/india-selling/tracking', seller(+m[2])?.name, catLabel(m[1]), productName, status)

    m = tableName.match(/^india_listing_error_seller_(\d+)_(pending|done|error|removed|high_demand|low_demand|dropshipping)$/)
    if (m) {
        const s = seller(+m[1])
        return mk('India', 'listing-error', 'Listing Error', `/dashboard/india-selling/listing-error/${s?.slug}`, s?.name, catLabel(m[2]), productName, status)
    }

    m = tableName.match(/^india_restock_seller_(\d+)$/)
    if (m) {
        const s = seller(+m[1])
        return mk('India', 'restock', 'Restock', `/dashboard/india-selling/restock/${s?.slug}`, s?.name, undefined, productName, status)
    }

    m = tableName.match(/^india_reorder_seller_(\d+)$/)
    if (m) return mk('India', 'reorder', 'Reorder', '/dashboard/india-selling/reorder', seller(+m[1])?.name, undefined, productName, status)

    if (tableName === 'india_master_sellers')
        return mk('India', 'manage-sellers', 'Manage Sellers', '/dashboard/manage-sellers/india-sellers', undefined, 'Master Table', productName, status)


    // ═══ USA / UK / UAE (shared patterns) ════════════════
    const stdResult = resolveStd(tableName, productName, status)
    if (stdResult) return stdResult


    // ═══ FLIPKART ════════════════════════════════════════

    m = tableName.match(/^flipkart_brand_checking_seller_(\d+)$/)
    if (m) { const s = seller(+m[1]); return mk('Flipkart', 'brand-checking', 'Brand Checking', `/dashboard/flipkart/brand-checking/${s?.slug}`, s?.name, undefined, productName, status) }

    m = tableName.match(/^flipkart_brand_checking_listed_seller_(\d+)$/)
    if (m) { const s = seller(+m[1]); return mk('Flipkart', 'listed-bc', 'Listed Products', `/dashboard/flipkart/listed-brand-checking/${s?.slug}`, s?.name, undefined, productName, status) }

    m = tableName.match(/^flipkart_brand_checking_not_listed_seller_(\d+)$/)
    if (m) { const s = seller(+m[1]); return mk('Flipkart', 'not-listed-bc', 'Not Listed', `/dashboard/flipkart/not-listed-brand-checking/${s?.slug}`, s?.name, undefined, productName, status) }

    if (tableName === 'flipkart_validation_main_file')
        return mk('Flipkart', 'validation', 'Validation', '/dashboard/flipkart/validation', undefined, undefined, productName, status)

    if (tableName === 'flipkart_admin_validation')
        return mk('Flipkart', 'admin-validation', 'Admin Validation', '/dashboard/flipkart/admin-validation', undefined, undefined, productName, status)

    if (tableName === 'flipkart_purchases')
        return mk('Flipkart', 'purchases', 'Purchases', '/dashboard/flipkart/purchases', undefined, undefined, productName, status)

    if (tableName === 'flipkart_traking')
        return mk('Flipkart', 'tracking', 'Tracking', '/dashboard/flipkart/tracking', undefined, undefined, productName, status)

    m = tableName.match(/^flipkart_tracking_seller_(\d+)$/)
    if (m) return mk('Flipkart', 'tracking', 'Tracking', '/dashboard/flipkart/tracking', seller(+m[1])?.name, undefined, productName, status)

    m = tableName.match(/^flipkart_(invoice|checking|shipment|restock|vyapar)_seller_(\d+)$/)
    if (m) return mk('Flipkart', 'tracking', 'Tracking', '/dashboard/flipkart/tracking', seller(+m[2])?.name, catLabel(m[1]), productName, status)

    m = tableName.match(/^flipkart_listing_error_seller_(\d+)_(pending|done|error|removed|high_demand|low_demand|dropshipping)$/)
    if (m) { const s = seller(+m[1]); return mk('Flipkart', 'listing-error', 'Listing Error', `/dashboard/flipkart/listing-error/${s?.slug}`, s?.name, catLabel(m[2]), productName, status) }

    m = tableName.match(/^flipkart_reorder_seller_(\d+)$/)
    if (m) return mk('Flipkart', 'reorder', 'Reorder', '/dashboard/flipkart/reorder', seller(+m[1])?.name, undefined, productName, status)

    m = tableName.match(/^flipkart_seller_(\d+)_(high_demand|low_demand|dropshipping|not_approved|reject)$/)
    if (m) { const s = seller(+m[1]); return mk('Flipkart', 'brand-checking', 'Brand Checking', `/dashboard/flipkart/brand-checking/${s?.slug}`, s?.name, catLabel(m[2]), productName, status) }

    if (tableName === 'flipkart_master_sellers')
        return mk('Flipkart', 'manage-sellers', 'Manage Sellers', '/dashboard/manage-sellers/flipkart-sellers', undefined, 'Master Table', productName, status)

    if (tableName === 'dropy_master_sellers')
        return mk('Dropy', 'manage-sellers', 'Manage Sellers', '/dashboard/manage-sellers/dropy', undefined, 'Master Table', productName, status)

    return null
}

// Shared USA/UK/UAE resolver
function resolveStd(tableName: string, productName?: string | null, status?: string | null): ResolvedHit | null {
    const cfgs = [
        { p: 'usa', label: 'USA', base: '/dashboard/usa-selling', ms: 'usa-sellers' },
        { p: 'uk', label: 'UK', base: '/dashboard/uk-selling', ms: 'uk-sellers' },
        { p: 'uae', label: 'UAE', base: '/dashboard/uae-selling', ms: 'uae-sellers' },
    ]
    for (const c of cfgs) {
        let m: RegExpMatchArray | null

        m = tableName.match(new RegExp(`^${c.p}_brand_checking_seller_(\\d+)$`))
        if (m) { const s = seller(+m[1]); return mk(c.label, 'brand-checking', 'Brand Checking', `${c.base}/brand-checking/${s?.slug}`, s?.name, undefined, productName, status) }

        if (tableName === `${c.p}_validation_main_file`)
            return mk(c.label, 'validation', 'Validation', `${c.base}/validation`, undefined, undefined, productName, status)

        if (tableName === `${c.p}_admin_validation`)
            return mk(c.label, 'admin-validation', 'Admin Validation', `${c.base}/admin-validation`, undefined, undefined, productName, status)

        if (tableName === `${c.p}_purchases`)
            return mk(c.label, 'purchases', 'Purchases', `${c.base}/purchases`, undefined, undefined, productName, status)

        if (tableName === `${c.p}_traking`)
            return mk(c.label, 'tracking', 'Tracking', `${c.base}/tracking`, undefined, undefined, productName, status)

        m = tableName.match(new RegExp(`^${c.p}_tracking_seller_(\\d+)$`))
        if (m) return mk(c.label, 'tracking', 'Tracking', `${c.base}/tracking`, seller(+m[1])?.name, undefined, productName, status)

        m = tableName.match(new RegExp(`^${c.p}_(invoice|checking|shipment|restock|vyapar)_seller_(\\d+)$`))
        if (m) return mk(c.label, 'tracking', 'Tracking', `${c.base}/tracking`, seller(+m[2])?.name, catLabel(m[1]), productName, status)

        m = tableName.match(new RegExp(`^${c.p}_listing_error_seller_(\\d+)_(pending|done|error|removed|high_demand|low_demand|dropshipping)$`))
        if (m) { const s = seller(+m[1]); return mk(c.label, 'listing-error', 'Listing Error', `${c.base}/listing-error/${s?.slug}`, s?.name, catLabel(m[2]), productName, status) }

        m = tableName.match(new RegExp(`^${c.p}_reorder_seller_(\\d+)$`))
        if (m) return mk(c.label, 'reorder', 'Reorder', `${c.base}/reorder`, seller(+m[1])?.name, undefined, productName, status)

        m = tableName.match(new RegExp(`^${c.p}_seller_(\\d+)_(high_demand|low_demand|dropshipping|not_approved|reject)$`))
        if (m) { const s = seller(+m[1]); return mk(c.label, 'manage-sellers', 'Manage Sellers', `/dashboard/manage-sellers/${c.ms}`, s?.name, catLabel(m[2]), productName, status) }

        if (tableName === `${c.p}_master_sellers`)
            return mk(c.label, 'manage-sellers', 'Manage Sellers', `/dashboard/manage-sellers/${c.ms}`, undefined, 'Master Table', productName, status)
    }
    return null
}

function mk(
    marketplace: string, stage: string, stageLabel: string, routePath: string,
    sellerName?: string, detail?: string, productName?: string | null, status?: string | null
): ResolvedHit {
    return {
        marketplace, emoji: MARKETPLACE_MAP[marketplace]?.emoji || '📦',
        stage, stageLabel, routePath,
        seller: sellerName, detail,
        productName: productName || undefined,
        status: status || undefined,
    }
}


// ─── COMPONENT ───────────────────────────────────────────
export default function UniversalAsinSearch() {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<ResolvedHit[]>([])
    const [searched, setSearched] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setIsOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                setIsOpen(true)
                setTimeout(() => inputRef.current?.focus(), 100)
            }
            if (e.key === 'Escape') setIsOpen(false)
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const handleSearch = useCallback(async () => {
        const asin = query.trim().toUpperCase()
        if (!asin) return

        setLoading(true)
        setSearched(true)
        setResults([])

        try {
            const { data, error } = await supabase.rpc('search_asin_everywhere', { asin_input: asin })

            if (error) {
                console.error('RPC error:', error)
                setLoading(false)
                return
            }

            const hits: ResolvedHit[] = (data || [])
                .map((row: { found_table: string; found_asin: string; found_productname: string | null; found_status: string | null }) =>
                    resolveTable(row.found_table, row.found_productname, row.found_status)
                )
                .filter((v: ResolvedHit | null): v is ResolvedHit => v !== null)

            // ✅ Deduplicate: one result per unique location
            const seen = new Set<string>()
            const deduped = hits.filter(h => {
                const key = `${h.marketplace}|${h.stage}|${h.seller || ''}|${h.detail || ''}`
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
            setResults(deduped)
        } catch (err) {
            console.error('Search failed:', err)
        }

        setLoading(false)
    }, [query])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch()
    }

    const navigateTo = (path: string) => {
        router.push(path)
        setIsOpen(false)
    }

    // Split: pipeline hits vs manage-sellers/master hits
    const pipelineHits = results.filter(h => h.stage !== 'manage-sellers' && h.stage !== 'master')
    const adminHits = results.filter(h => h.stage === 'manage-sellers' || h.stage === 'master')

    // Group pipeline hits by marketplace
    const grouped = pipelineHits.reduce<Record<string, ResolvedHit[]>>((acc, h) => {
        if (!acc[h.marketplace]) acc[h.marketplace] = []
        acc[h.marketplace].push(h)
        return acc
    }, {})

    return (
        <>
            {/* Trigger */}
            <button
                onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100) }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-slate-900/50 border border-slate-800
                    rounded-lg text-slate-500 hover:text-slate-300 hover:border-slate-700
                    hover:bg-slate-900 transition-all text-xs group"
            >
                <Search className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">Find ASIN...</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono border border-slate-700
                    group-hover:border-slate-600">⌘K</kbd>
            </button>

            {/* Panel */}
            {isOpen && createPortal(
                <>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]" onClick={() => setIsOpen(false)} />
                    <div ref={panelRef} className="fixed top-[10%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-[9999] px-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

                            {/* Input */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                                <Search className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Search ASIN across all marketplaces..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value.toUpperCase())}
                                    onKeyDown={handleKeyDown}
                                    className="flex-1 bg-transparent text-white text-sm placeholder-slate-600
                                        focus:outline-none font-mono tracking-wide"
                                    autoFocus
                                />
                                {loading ? (
                                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                                ) : query ? (
                                    <button onClick={() => { setQuery(''); setResults([]); setSearched(false) }} className="text-slate-500 hover:text-slate-300">
                                        <X className="w-4 h-4" />
                                    </button>
                                ) : null}
                                <button onClick={handleSearch} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg font-medium transition-colors">
                                    Search
                                </button>
                            </div>

                            {/* Results */}
                            <div className="max-h-[70vh] overflow-y-auto">

                                {!searched && !loading && (
                                    <div className="p-8 text-center">
                                        <div className="text-3xl mb-2">🔍</div>
                                        <p className="text-slate-400 text-sm">Type an ASIN and press Enter</p>
                                        <p className="text-slate-600 text-xs mt-1">Searches across India, USA, UK, UAE & Flipkart</p>
                                    </div>
                                )}

                                {searched && !loading && results.length === 0 && (
                                    <div className="p-8 text-center">
                                        <div className="text-3xl mb-2">😕</div>
                                        <p className="text-slate-300 font-medium">ASIN not found</p>
                                        <p className="text-slate-500 text-sm mt-1">
                                            <span className="font-mono text-indigo-400">{query}</span> doesn&apos;t exist in any marketplace
                                        </p>
                                    </div>
                                )}

                                {searched && !loading && results.length > 0 && (
                                    <div className="divide-y divide-slate-800/50">
                                        {/* Summary bar */}
                                        <div className="px-4 py-2.5 bg-indigo-500/5 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                            <span className="text-xs text-slate-300">
                                                Found in <span className="text-indigo-400 font-bold">{Object.keys(grouped).length + (adminHits.length > 0 ? 1 : 0)}</span> section{(Object.keys(grouped).length + (adminHits.length > 0 ? 1 : 0)) !== 1 ? 's' : ''},
                                                {' '}<span className="text-indigo-400 font-bold">{results.length}</span> page{results.length !== 1 ? 's' : ''}
                                            </span>
                                            {results[0]?.productName && (
                                                <span className="text-xs text-slate-500 truncate ml-auto max-w-[200px]">{results[0].productName}</span>
                                            )}
                                        </div>

                                        {/* Per-marketplace pipeline cards */}
                                        {Object.entries(grouped).map(([marketKey, hits]) => {
                                            const mp = MARKETPLACE_MAP[marketKey]
                                            if (!mp) return null
                                            const activeKeys = new Set(hits.map(h => h.stage))

                                            return (
                                                <div key={marketKey} className="py-4 px-4">
                                                    {/* Header */}
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="text-lg">{mp.emoji}</span>
                                                        <span className="text-sm font-semibold text-white">{mp.label}</span>
                                                        <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                                                            {hits.length} page{hits.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>

                                                    {/* ── Pipeline Flow ── */}
                                                    <div className="flex items-start gap-0 overflow-x-auto scrollbar-none pb-1 mb-3">
                                                        {mp.pipeline.map((stage, i) => {
                                                            const active = activeKeys.has(stage.key)
                                                            const colors = sc(stage.key)
                                                            const nextActive = i < mp.pipeline.length - 1 && activeKeys.has(mp.pipeline[i + 1].key)
                                                            return (
                                                                <div key={stage.key} className="flex items-start flex-shrink-0">
                                                                    <div className="flex flex-col items-center gap-1 min-w-[48px]">
                                                                        <div className={`w-3 h-3 rounded-full transition-all ${active
                                                                            ? `${colors.dot} ring-2 ring-offset-1 ring-offset-slate-900 ring-current`
                                                                            : 'bg-slate-700/50'}`}
                                                                        />
                                                                        <span className={`text-[8px] sm:text-[9px] font-medium whitespace-nowrap leading-tight text-center ${active ? colors.text : 'text-slate-600'}`}>
                                                                            {stage.label}
                                                                        </span>
                                                                    </div>
                                                                    {i < mp.pipeline.length - 1 && (
                                                                        <div className="flex items-center mt-[5px] -mx-0.5">
                                                                            <div className={`w-3 sm:w-5 h-px ${active && nextActive ? 'bg-indigo-500/40' : 'bg-slate-800'}`} />
                                                                            <ChevronRight className={`w-2 h-2 -ml-1 ${active && nextActive ? 'text-indigo-500/40' : 'text-slate-800'}`} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>

                                                    {/* ── Location Cards ── */}
                                                    <div className="space-y-1.5">
                                                        {hits.map((h, i) => {
                                                            const colors = sc(h.stage)
                                                            return (
                                                                <button
                                                                    key={`${h.routePath}-${h.seller}-${h.detail}-${i}`}
                                                                    onClick={() => navigateTo(h.routePath)}
                                                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border
                                                                        ${colors.bg} ${colors.border} hover:brightness-125
                                                                        transition-all text-left group`}
                                                                >
                                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                                                                    <div className="flex-1 flex items-center gap-1 flex-wrap min-w-0">
                                                                        <span className={`text-xs font-semibold ${colors.text}`}>{h.stageLabel}</span>
                                                                        {h.seller && (
                                                                            <>
                                                                                <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                                                                                <span className="text-xs text-slate-300">{h.seller}</span>
                                                                            </>
                                                                        )}
                                                                        {h.detail && (
                                                                            <>
                                                                                <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                                                                                <span className="text-xs text-slate-400">{h.detail}</span>
                                                                            </>
                                                                        )}
                                                                        {h.status && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 rounded ml-1 border border-amber-500/20">
                                                                                {h.status}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}

                                        {/* Admin/Master hits */}
                                        {adminHits.length > 0 && (
                                            <div className="py-3 px-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm">📋</span>
                                                    <span className="text-xs font-semibold text-slate-400">Also in Manage Sellers</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {adminHits.map((h, i) => {
                                                        const colors = sc(h.stage)
                                                        return (
                                                            <button key={`ms-${i}`} onClick={() => navigateTo(h.routePath)}
                                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border ${colors.bg} ${colors.border} hover:brightness-125 transition-all text-left group`}>
                                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                                                                <div className="flex-1 flex items-center gap-1 min-w-0">
                                                                    <span className="text-xs text-slate-300">{h.emoji} {h.marketplace}</span>
                                                                    {h.seller && (
                                                                        <><ChevronRight className="w-3 h-3 text-slate-600" /><span className="text-xs text-slate-400">{h.seller}</span></>
                                                                    )}
                                                                    {h.detail && <span className="text-[10px] text-slate-500 ml-1">({h.detail})</span>}
                                                                </div>
                                                                <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between bg-slate-900/80">
                                <span className="text-[10px] text-slate-600">{Object.keys(MARKETPLACE_MAP).length} marketplaces</span>
                                <div className="flex items-center gap-3 text-[10px] text-slate-600">
                                    <span><kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-500">Enter</kbd> Search</span>
                                    <span><kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-500">Esc</kbd> Close</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    )
}