'use client';
import PageGuard from '@/components/PageGuard'
import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';
import InvoiceModal from './components/InvoiceModal'
import CompanyInvoiceTable from './components/CompanyInvoiceTable'
import CheckingTable from './components/CheckingTable';
import RollbackModal from './components/RollbackModal'

type PassFileProduct = {
    id: string
    asin: string
    product_name: string | null
    brand: string | null
    seller_tag: string | null
    funnel: string | null
    origin_india: boolean | null
    origin_china: boolean | null
    usd_price: number | null
    inr_purchase: number | null
    usa_link: string | null
    product_link: string | null
    target_price: number | null
    admin_target_price: number | null
    target_quantity: number | null
    funnel_quantity?: number | null
    funnel_seller?: string | null
    inr_purchase_link?: string | null
    buying_price: number | null
    buying_quantity: number | null
    seller_link: string | null
    seller_phone: string | null
    payment_method: string | null
    tracking_details: string | null
    delivery_date: string | null
    status: string | null
    move_to: string | null
    sent_to_admin: boolean | null
    sent_to_admin_at: string | null
    admin_confirmed: boolean | null
    admin_confirmed_at: string | null
    check_brand: boolean | null
    check_item_expire: boolean | null
    check_small_size: boolean | null
    check_multi_seller: boolean | null
    created_at: string | null
    validation_funnel_seller?: string | null
    validation_funnel_quantity?: number | null
    validation_seller_tag?: string | null
    validation_funnel?: string | null
    productweight?: number | null
    product_weight?: number | null
    target_price_validation?: number | null
    target_price_link_validation?: string | null
    profit?: number | null
    origin?: string | null
    admin_target_quantity?: number | null
}

type TabType = 'main_file' | 'company_invoice_details' | 'checking';

export default function TrackingPage() {
    const [activeTab, setActiveTab] = useState<TabType>('main_file');
    const [products, setProducts] = useState<PassFileProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [invoiceOpen, setInvoiceOpen] = useState(false)
    const [rollbackOpen, setRollbackOpen] = useState(false)
    const selectedItems = products
        .filter((p) => selectedIds.has(p.id))
        .map((p) => ({
            asin: p.asin,
            product_name: p.product_name,
            target_price: p.target_price,
            target_quantity: p.target_quantity,
            buying_price: p.buying_price,
            buying_quantity: p.buying_quantity,
            seller_link: p.seller_link,
            seller_phone: p.seller_phone,
            payment_method: p.payment_method,
            tracking_details: p.tracking_details,
            delivery_date: p.delivery_date,
            origin_india: p.origin_india,
            origin_china: p.origin_china,
            brand: p.brand,
            seller_tag: p.seller_tag || p.validation_seller_tag,
            funnel: p.funnel || p.validation_funnel,
            admin_target_price: (p as any).admin_target_price,
            inr_purchase_link: (p as any).inr_purchase_link,
            product_weight: p.product_weight || 0,
        }));

    console.log('✅ Selected items for invoice:', selectedItems);

    const [visibleColumns, setVisibleColumns] = useState({
        checkbox: true,
        asin: true,
        productlink: true,
        productname: true,
        targetprice: true,
        targetquantity: true,
        funnelquantity: true,
        funnelseller: true,
        inrpurchaselink: true,
        origin: true,
        buyingprice: true,
        buyingquantity: true,
        sellerlink: true,
        sellerphno: true,
        paymentmethod: true,
        trackingdetails: true,
        deliverydate: true,
        admintargetprice: true,
    });

    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

    const fetchProducts = async () => {
        try {
            setLoading(true)

            const { data: purchasesData, error: purchasesError } = await supabase
                .from('usa_traking')
                .select()
                .order('created_at', { ascending: false })

            if (purchasesError) throw purchasesError

            const enrichedData = await Promise.all(
                purchasesData.map(async (product) => {
                    const { data: validationData } = await supabase
                        .from('usa_validation_main_file')
                        .select('seller_tag, funnel, product_weight, usd_price, inr_purchase')
                        .eq('asin', product.asin)
                        .maybeSingle()

                    return {
                        ...product,
                        productname: (product as any).product_name ?? null,
                        originindia: (product as any).origin_india ?? false,
                        originchina: (product as any).origin_china ?? false,
                        validation_funnel: validationData?.funnel ?? null,
                        validation_seller_tag: validationData?.seller_tag ?? null,
                        product_weight: validationData?.product_weight ?? null,
                        usd_price: validationData?.usd_price ?? null,
                        inr_purchase_from_validation: validationData?.inr_purchase ?? null,
                    }
                })
            )

            setProducts(enrichedData)
        } catch (error) {
            console.error('Error fetching products:', error)
        } finally {
            setLoading(false)
        }
    }

    const refreshProductsSilently = async () => {
        try {
            const { data: purchasesData, error: purchasesError } = await supabase
                .from('usa_traking')
                .select('*')
                .order('created_at', { ascending: false })

            if (purchasesError) throw purchasesError

            const allAsins = purchasesData.map((p: any) => p.asin)
            const { data: validationDataArray } = await supabase
                .from('usa_validation_main_file')
                .select('asin, seller_tag, funnel, product_weight, usd_price, inr_purchase')
                .in('asin', allAsins)

            const validationMap = new Map(
                (validationDataArray || []).map((v: any) => [v.asin, v])
            )

            const enrichedData = purchasesData.map((product: any) => {
                const validationData = validationMap.get(product.asin)

                return {
                    ...product,
                    product_name: product.product_name ?? null,
                    origin_india: product.origin_india ?? false,
                    origin_china: product.origin_china ?? false,
                    validation_funnel: validationData?.funnel ?? null,
                    validation_seller_tag: validationData?.seller_tag ?? null,
                    product_weight: validationData?.product_weight ?? null,
                    usd_price: validationData?.usd_price ?? null,
                    inr_purchase_from_validation: validationData?.inr_purchase ?? null,
                }
            })

            setProducts(enrichedData)
        } catch (error) {
            console.error('Error refreshing products:', error)
        }
    }

    useEffect(() => {
        fetchProducts()

        const channel = supabase
            .channel('purchases-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'usa_traking' }, () => {
                refreshProductsSilently()
            })
            .subscribe()

        return () => {
            channel.unsubscribe()
        }
    }, [])

    const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
        checkbox: 50,
        asin: 120,
        productlink: 80,
        productname: 140,
        targetprice: 100,
        targetquantity: 100,
        admintargetprice: 120,
        funnelquantity: 70,
        funnelseller: 70,
        inrpurchaselink: 100,
        origin: 70,
        buyingprice: 100,
        buyingquantity: 120,
        sellerlink: 100,
        sellerphno: 120,
        paymentmethod: 120,
        trackingdetails: 150,
        deliverydate: 150,
        moveto: 100,
    });

    const [resizing, setResizing] = useState<{ column: string, startX: number, startWidth: number } | null>(null);

    const handleMouseDown = (column: string, e: React.MouseEvent) => {
        setResizing({
            column,
            startX: e.clientX,
            startWidth: columnWidths[column],
        });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizing) {
                const diff = e.clientX - resizing.startX;
                const newWidth = Math.max(50, resizing.startWidth + diff);
                setColumnWidths(prev => ({
                    ...prev,
                    [resizing.column]: newWidth,
                }));
            }
        };

        const handleMouseUp = () => {
            setResizing(null);
        };

        if (resizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [resizing, columnWidths]);

    const filteredProducts = products.filter((p) => {
        const matchesSearch =
            !searchQuery ||
            p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.funnel?.toLowerCase().includes(searchQuery.toLowerCase())

        if (!matchesSearch) return false

        switch (activeTab) {
            case 'main_file':
                return !p.sent_to_admin && !p.move_to
        }
    })

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    const handleMoveToTracking = async (product: PassFileProduct) => {
        if (!product.admin_confirmed) {
            alert('Only Order Confirmed items can be moved');
            return;
        }

        const { error: insertError } = await supabase
            .from('usa_traking')
            .insert({
                asin: product.asin,
                product_link: product.product_link,
                product_name: product.product_name,
                target_price: product.target_price,
                target_quantity: product.target_quantity,
                buying_price: product.buying_price,
                buying_quantity: product.buying_quantity,
                seller_link: product.seller_link,
                seller_phone: product.seller_phone,
                payment_method: product.payment_method,
                tracking_details: product.tracking_details,
                delivery_date: product.delivery_date,
                origin_india: product.origin_india,
                origin_china: product.origin_china,
                brand: product.brand,
                seller_tag: product.seller_tag,
                funnel: product.funnel,
                inr_purchase_link: product.inr_purchase_link,
                profit: product.profit,
                product_weight: product.product_weight,
                usd_price: product.usd_price,
                inr_purchase: product.inr_purchase,
                admin_target_price: product.admin_target_price,
                admin_target_quantity: product.admin_target_quantity,
                target_price_validation: product.target_price_validation,
                target_price_link_validation: product.target_price_link_validation,
                origin: product.origin,
                funnel_quantity: product.funnel_quantity,
                funnel_seller: product.funnel_seller
            });

        if (insertError) {
            alert(insertError.message);
            return;
        }

        await supabase
            .from('usa_purchases')
            .delete()
            .eq('id', product.id);

        await refreshProductsSilently();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div className="text-xl text-slate-400">Loading purchases...</div>
            </div>
        );
    }

    const tabs = [
        { key: 'mainfile', label: 'Main File', count: products.filter(p => !p.sent_to_admin && !p.move_to).length },
    ];

    return (
        <PageGuard>
            <div className="h-screen flex flex-col bg-slate-950 text-slate-200">
                {/* Header Section - FIXED */}
                <div className="flex-none px-6 pt-6 pb-4 border-b border-slate-800">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-white">Tracking</h1>
                        <p className="text-slate-400 mt-1">Order Confirmed → Tracking → Invoice</p>
                    </div>

                    {/* Tabs - FIXED */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setActiveTab('main_file')}
                            className={`px-6 py-3 font-semibold text-sm rounded-xl transition-all duration-300 ${activeTab === 'main_file'
                                    ? 'bg-slate-800 text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800'
                                }`}
                        >
                            Main File ({products.filter(p => !p.sent_to_admin && !p.move_to).length})
                        </button>

                        <button
                            onClick={() => setActiveTab('company_invoice_details')}
                            className={`px-6 py-3 font-semibold text-sm rounded-xl transition-all duration-300 ${activeTab === 'company_invoice_details'
                                    ? 'bg-slate-800 text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800'
                                }`}
                        >
                            Company Invoice Details
                        </button>

                        <button
                            onClick={() => setActiveTab('checking')}
                            className={`px-6 py-3 font-semibold text-sm rounded-xl transition-all duration-300 ${activeTab === 'checking'
                                    ? 'bg-slate-800 text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800'
                                }`}
                        >
                            Checking
                        </button>
                    </div>
                </div>

                {/* Search - FIXED */}
                <div className="flex gap-3 items-center mb-6 px-6 pt-4">
                    <input
                        type="text"
                        placeholder="Search by ASIN, Product Name, or Funnel..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 max-w-md px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-slate-200 placeholder:text-slate-600"
                    />

                    <button
                        disabled={selectedIds.size === 0}
                        onClick={() => setInvoiceOpen(true)}
                        className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${selectedIds.size === 0
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                : 'bg-green-600 text-white hover:bg-green-500 shadow-lg'
                            }`}
                    >
                        Convert to Invoice
                    </button>

                    {/* NEW: Hide Columns Button */}
                    <div className="relative">
                        <button
                            onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                            className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            Hide Columns
                        </button>

                        {/* Dropdown Menu */}
                        {isColumnMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsColumnMenuOpen(false)}
                                />

                                <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-4 z-20 w-64">
                                    <h3 className="font-semibold text-slate-200 mb-3 text-sm">Toggle Columns</h3>
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {Object.keys(visibleColumns).map((col) => {
                                            const columnDisplayNames: { [key: string]: string } = {
                                                'checkbox': 'Checkbox',
                                                'asin': 'ASIN',
                                                'productlink': 'Product Link',
                                                'productname': 'Product Name',
                                                'targetprice': 'Validation Target Price',
                                                'targetquantity': 'Target Quantity',
                                                'admintargetprice': 'Admin Target Price',
                                                'funnelquantity': 'Funnel',
                                                'funnelseller': 'Seller Tag',
                                                'inrpurchaselink': 'INR Purchase Link',
                                                'origin': 'Origin',
                                                'buyingprice': 'Buying Price',
                                                'buyingquantity': 'Buying Quantity',
                                                'sellerlink': 'Seller Link',
                                                'sellerphno': 'Seller Ph No.',
                                                'paymentmethod': 'Payment Method',
                                                'trackingdetails': 'Tracking Details',
                                                'deliverydate': 'Delivery Date',
                                                'moveto': 'Move To',
                                            };

                                            return (
                                                <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-2 rounded">
                                                    <input
                                                        type="checkbox"
                                                        checked={visibleColumns[col as keyof typeof visibleColumns]}
                                                        onChange={() => {
                                                            setVisibleColumns(prev => ({
                                                                ...prev,
                                                                [col]: !prev[col as keyof typeof visibleColumns]
                                                            }));
                                                        }}
                                                        className="rounded border-slate-600 bg-slate-800 text-indigo-500"
                                                    />
                                                    <span className="text-sm text-slate-300">
                                                        {columnDisplayNames[col] || col}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
                                        <button
                                            onClick={() =>
                                                setVisibleColumns(
                                                    Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {} as typeof visibleColumns)
                                                )
                                            }
                                            className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-500 text-xs font-medium"
                                        >
                                            Show All
                                        </button>
                                        <button
                                            onClick={() =>
                                                setVisibleColumns(
                                                    Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: key === 'checkbox' || key === 'asin' }), {} as typeof visibleColumns)
                                                )
                                            }
                                            className="flex-1 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-xs font-medium"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* ✅ Rollback Button - ONLY SHOW IN CHECKING TAB */}
                   {/* ✅ Rollback Button - Active only in Main File */}
<button
    onClick={() => activeTab === 'main_file' && setRollbackOpen(true)}
    disabled={activeTab !== 'main_file'}
    className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
        activeTab === 'main_file'
            ? 'bg-red-600 text-white hover:bg-red-700 border border-red-700 shadow-lg hover:shadow-red-500/50 cursor-pointer'
            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
    }`}
>
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
    Rollback
</button>


                </div>

                {/* Table Container - SCROLLABLE ONLY */}
                <div className="flex-1 overflow-hidden px-6 pb-6">
                    <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-800 h-full flex flex-col">
                        {/* Table Wrapper with Scroll */}
                        <div className="flex-1 overflow-y-auto">
                            {activeTab === 'main_file' && (
                                <table className="w-full divide-y divide-slate-800" style={{ minWidth: '2500px' }}>
                                    <thead className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
                                        <tr>
                                            {visibleColumns.checkbox && (
                                                <th className="px-4 py-3 text-center" style={{ width: `${columnWidths.checkbox}px` }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            filteredProducts.length > 0 &&
                                                            filteredProducts.every(p => selectedIds.has(p.id))
                                                        }
                                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                                        className="rounded border-slate-600 bg-slate-800 text-indigo-500"
                                                    />
                                                </th>
                                            )}
                                            {visibleColumns.asin && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase relative group border-r border-slate-800" style={{ width: `${columnWidths.asin}px` }}>
                                                    ASIN
                                                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('asin', e)} />
                                                </th>
                                            )}

                                            {visibleColumns.productlink && (
                                                <th
                                                    className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase relative group border-r border-slate-800"
                                                    style={{
                                                        width: `${columnWidths.productlink}px`,
                                                        maxWidth: `${columnWidths.productlink}px`,
                                                        minWidth: `${columnWidths.productlink}px`
                                                    }}
                                                >
                                                    PRODUCT LINK
                                                    <div
                                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500"
                                                        onMouseDown={(e) => handleMouseDown('productlink', e)}
                                                    />
                                                </th>
                                            )}

                                            {visibleColumns.productname && (
                                                <th
                                                    className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase relative group border-r border-slate-800"
                                                    style={{
                                                        width: `${columnWidths.productname}px`,
                                                        maxWidth: `${columnWidths.productname}px`,
                                                        minWidth: `${columnWidths.productname}px`
                                                    }}
                                                >
                                                    PRODUCT NAME
                                                    <div
                                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500"
                                                        onMouseDown={(e) => handleMouseDown('productname', e)}
                                                    />
                                                </th>
                                            )}

                                            {visibleColumns.targetprice && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase bg-green-900/20 relative group border-r border-slate-800" style={{ width: `${columnWidths.targetprice}px` }}>
                                                    Validation Target Price
                                                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('targetprice', e)} />
                                                </th>
                                            )}

                                            {visibleColumns.targetquantity && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase bg-green-900/20 relative group border-r border-slate-800" style={{ width: `${columnWidths.targetquantity}px` }}>
                                                    Target Quantity
                                                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('targetquantity', e)} />
                                                </th>
                                            )}

                                            {visibleColumns.admintargetprice && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase bg-purple-900/20 relative group border-r border-slate-800" style={{ width: `${columnWidths.admintargetprice}px` }}>
                                                    Admin Target Price
                                                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('admintargetprice', e)} />
                                                </th>
                                            )}

                                            {visibleColumns.funnelquantity && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase relative group border-r border-slate-800" style={{ width: `${columnWidths.funnelquantity}px` }}>
                                                    Funnel
                                                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('funnel_quantity', e)} />
                                                </th>
                                            )}

                                            {visibleColumns.funnelseller && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase relative group border-r border-slate-800" style={{ width: `${columnWidths.funnelseller}px` }}>
                                                    Seller Tag
                                                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('funnel_seller', e)} />
                                                </th>
                                            )}

                                            {visibleColumns.inrpurchaselink && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase relative group border-r border-slate-800" style={{ width: `${columnWidths.inrpurchaselink}px` }}>
                                                    INR Purchase Link
                                                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('inrpurchaselink', e)} />
                                                </th>
                                            )}

                                            {visibleColumns.origin && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase relative group border-r border-slate-800" style={{ width: `${columnWidths.origin}px` }}>
                                                    Origin
                                                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('origin', e)} />
                                                </th>
                                            )}

                                            {visibleColumns.buyingprice && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                                                    Buying Price
                                                </th>
                                            )}

                                            {visibleColumns.buyingquantity && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                                                    Buying Qty
                                                </th>
                                            )}

                                            {visibleColumns.sellerlink && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                                                    Seller Link
                                                </th>
                                            )}

                                            {visibleColumns.sellerphno && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                                                    Seller Ph No.
                                                </th>
                                            )}

                                            {visibleColumns.paymentmethod && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                                                    Payment Method
                                                </th>
                                            )}

                                            {visibleColumns.trackingdetails && (
                                                <th
                                                    className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800"
                                                    style={{ width: `${columnWidths.trackingdetails}px` }}
                                                >
                                                    Tracking Details
                                                </th>
                                            )}

                                            {visibleColumns.deliverydate && (
                                                <th
                                                    className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800"
                                                    style={{ width: `${columnWidths.deliverydate}px` }}
                                                >
                                                    Delivery Date
                                                </th>
                                            )}
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-800/50">
                                        {filteredProducts.length === 0 ? (
                                            <tr>
                                                <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-4 py-8 text-center text-slate-500">
                                                    No products available in {activeTab.replace('_', ' ')}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredProducts.map((product) => {
                                                return (
                                                    <tr key={product.id} className="hover:bg-slate-800/40 group transition-colors">
                                                        {visibleColumns.checkbox && (
                                                            <td className="px-4 py-2 text-center border-r border-slate-800/50" style={{ width: `${columnWidths.checkbox}px` }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedIds.has(product.id)}
                                                                    onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                                                                    className="rounded border-slate-600 bg-slate-800 text-indigo-500"
                                                                />
                                                            </td>
                                                        )}
                                                        {visibleColumns.asin && (
                                                            <td className="px-3 py-2 font-mono text-sm text-slate-300 overflow-hidden border-r border-slate-800/50" style={{ width: `${columnWidths.asin}px` }}>
                                                                <div className="truncate">{product.asin}</div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.productlink && (
                                                            <td
                                                                className="px-3 py-2 overflow-hidden text-center border-r border-slate-800/50"
                                                                style={{
                                                                    width: `${columnWidths.productlink}px`,
                                                                    maxWidth: `${columnWidths.productlink}px`,
                                                                    minWidth: `${columnWidths.productlink}px`
                                                                }}
                                                            >
                                                                {(product.usa_link || product.product_link) ? (
                                                                    <a
                                                                        href={(product.usa_link || product.product_link) ?? undefined}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all text-xs font-medium"
                                                                    >
                                                                        View
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-xs text-slate-600">-</span>
                                                                )}
                                                            </td>
                                                        )}
                                                        {visibleColumns.productname && (
                                                            <td
                                                                className="px-3 py-2 text-sm text-slate-200 overflow-hidden border-r border-slate-800/50"
                                                                style={{
                                                                    width: `${columnWidths.productname}px`,
                                                                    maxWidth: `${columnWidths.productname}px`,
                                                                    minWidth: `${columnWidths.productname}px`
                                                                }}
                                                            >
                                                                <div className="truncate" title={product.product_name || '-'}>
                                                                    {product.product_name || '-'}
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.targetprice && (
                                                            <td className="px-3 py-2 bg-green-900/20 overflow-hidden border-r border-slate-800/50" style={{ width: `${columnWidths.targetprice}px` }}>
                                                                {activeTab === 'main_file' || activeTab === 'order_confirmed' ? (
                                                                    <div className="px-2 py-1 text-sm font-medium text-slate-200">
                                                                        {product.target_price ?? product.usd_price ?? '-'}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-slate-600 italic">After confirmation</span>
                                                                )}
                                                            </td>
                                                        )}
                                                        {visibleColumns.targetquantity && (
                                                            <td className="px-3 py-2 bg-green-900/20 overflow-hidden border-r border-slate-800/50" style={{ width: `${columnWidths.targetquantity}px` }}>
                                                                {activeTab === 'main_file' || activeTab === 'order_confirmed' ? (
                                                                    <div className="px-2 py-1 text-sm font-medium text-slate-200">
                                                                        {product.target_quantity ?? 1}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-slate-600 italic">After confirmation</span>
                                                                )}
                                                            </td>
                                                        )}
                                                        {visibleColumns.admintargetprice && (
                                                            <td
                                                                className="px-3 py-2 bg-purple-900/20 overflow-hidden text-sm font-medium text-slate-200 border-r border-slate-800/50"
                                                                style={{ width: `${columnWidths.admintargetprice}px` }}
                                                            >
                                                                {product.admin_target_price ?? '-'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.funnelquantity && (
                                                            <td className="px-3 py-2 overflow-hidden text-center border-r border-slate-800/50" style={{ width: `${columnWidths.funnelquantity}px` }}>
                                                                {product.validation_funnel ? (
                                                                    <span className={`w-9 h-9 inline-flex items-center justify-center rounded-full font-bold text-sm ${product.validation_funnel === 'HD' ? 'bg-green-500 text-white' :
                                                                        product.validation_funnel === 'LD' ? 'bg-blue-500 text-white' :
                                                                            product.validation_funnel === 'DP' ? 'bg-yellow-400 text-black' :
                                                                                'bg-gray-400 text-white'
                                                                        }`}>
                                                                        {product.validation_funnel}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-600 italic">-</span>
                                                                )}
                                                            </td>
                                                        )}
                                                        {visibleColumns.funnelseller && (
                                                            <td className="px-3 py-2 overflow-hidden border-r border-slate-800/50" style={{ width: `${columnWidths.funnelseller}px` }}>
                                                                {product.validation_seller_tag ? (
                                                                    <div className="flex flex-wrap gap-2 justify-center">
                                                                        {product.validation_seller_tag.split(',').map((tag) => {
                                                                            const cleanTag = tag.trim();
                                                                            return (
                                                                                <span
                                                                                    key={cleanTag}
                                                                                    className={`w-9 h-9 flex items-center justify-center rounded-full font-bold text-sm ${cleanTag === 'GR' ? 'bg-yellow-400 text-black' :
                                                                                        cleanTag === 'RR' ? 'bg-gray-400 text-black' :
                                                                                            cleanTag === 'UB' ? 'bg-pink-500 text-white' :
                                                                                                cleanTag === 'VV' ? 'bg-purple-600 text-white' :
                                                                                                    'bg-slate-700 text-white'
                                                                                        }`}
                                                                                >
                                                                                    {cleanTag}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-slate-600 italic">-</span>
                                                                )}
                                                            </td>
                                                        )}
                                                        {visibleColumns.inrpurchaselink && (
                                                            <td className="px-3 py-2 overflow-hidden text-center border-r border-slate-800/50" style={{ width: `${columnWidths.inrpurchaselink}px` }}>
                                                                {product.inr_purchase_link ? (
                                                                    <a
                                                                        href={product.inr_purchase_link}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all text-xs font-medium"
                                                                    >
                                                                        View
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-xs text-slate-600 italic">-</span>
                                                                )}
                                                            </td>
                                                        )}
                                                        {visibleColumns.origin && (
                                                            <td className="px-3 py-2 overflow-hidden border-r border-slate-800/50" style={{ width: `${columnWidths.origin}px` }}>
                                                                <div className="flex flex-wrap gap-2 justify-center">
                                                                    {product.origin_india && (
                                                                        <span className="px-2 py-1 bg-orange-500 text-white rounded text-xs font-semibold">
                                                                            India
                                                                        </span>
                                                                    )}
                                                                    {product.origin_china && (
                                                                        <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-semibold">
                                                                            China
                                                                        </span>
                                                                    )}
                                                                    {!product.origin_india && !product.origin_china && (
                                                                        <span className="text-xs text-slate-600 italic">-</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.buyingprice && (
                                                            <td className="px-3 py-2 overflow-hidden text-sm text-slate-300 text-center border-r border-slate-800/50" style={{ width: `${columnWidths.buyingprice}px` }}>
                                                                {product.buying_price ?? '-'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.buyingquantity && (
                                                            <td className="px-3 py-2 overflow-hidden text-sm text-slate-300 text-center border-r border-slate-800/50" style={{ width: `${columnWidths.buyingquantity}px` }}>
                                                                {product.buying_quantity ?? '-'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.sellerlink && (
                                                            <td className="px-3 py-2 overflow-hidden text-center border-r border-slate-800/50" style={{ width: `${columnWidths.sellerlink}px` }}>
                                                                {product.seller_link ? (
                                                                    <a
                                                                        href={product.seller_link}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all text-xs font-medium"
                                                                    >
                                                                        View
                                                                    </a>
                                                                ) : '-'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.sellerphno && (
                                                            <td className="px-3 py-2 overflow-hidden text-sm text-slate-300 text-center border-r border-slate-800/50" style={{ width: `${columnWidths.sellerphno}px` }}>
                                                                {product.seller_phone ?? '-'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.paymentmethod && (
                                                            <td className="px-3 py-2 overflow-hidden text-sm text-slate-300 text-center border-r border-slate-800/50" style={{ width: `${columnWidths.paymentmethod}px` }}>
                                                                {product.payment_method ?? '-'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.trackingdetails && (
                                                            <td
                                                                className="px-3 py-2 overflow-hidden text-sm text-slate-300 text-center border-r border-slate-800/50"
                                                                style={{ width: `${columnWidths.trackingdetails}px` }}
                                                            >
                                                                {product.tracking_details ?? '-'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.deliverydate && (
                                                            <td
                                                                className="px-3 py-2 overflow-hidden text-sm text-slate-300 text-center border-r border-slate-800/50"
                                                                style={{ width: `${columnWidths.deliverydate}px` }}
                                                            >
                                                                {product.delivery_date ?? '-'}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {activeTab === 'company_invoice_details' && (
                            <div className="p-4 bg-slate-900 min-h-full">
                                <CompanyInvoiceTable />
                            </div>
                        )}
                        {activeTab === 'checking' && (
                            <div className="p-4 bg-slate-900 min-h-full">
                                <CheckingTable />
                            </div>
                        )}

                        {/* Footer Stats - FIXED */}
                        <div className="flex-none border-t border-slate-800 bg-slate-950 px-4 py-3">
                            <div className="text-sm text-slate-400">
                                Showing {filteredProducts.length} of {products.length} products
                                {selectedIds.size > 0 && ` | ${selectedIds.size} selected`}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <InvoiceModal
                open={invoiceOpen}
                onClose={() => setInvoiceOpen(false)}
                items={selectedItems}
                onSuccess={() => {
                    fetchProducts();
                    setSelectedIds(new Set());
                }}
            />
            <RollbackModal
                open={rollbackOpen}
                onClose={() => setRollbackOpen(false)}
                onSuccess={() => {
                    fetchProducts();
                    setRollbackOpen(false);
                }}
            />
        </PageGuard>
    );
}
