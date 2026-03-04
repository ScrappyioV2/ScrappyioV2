'use client';
import PageGuard from '@/components/PageGuard'
import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect, useMemo } from 'react'; // ✅ Added useMemo
import InvoiceModal from './components/InvoiceModal'
import CompanyInvoiceTable from './components/CompanyInvoiceTable'
import CheckingTable from './components/CheckingTable';
import RollbackModal from './components/RollbackModal'
import { SELLER_TAG_MAPPING, SellerTag } from '@/lib/utils';
import ShipmentTable from './components/ShipmentTable';
import RestockTable from './components/RestockTable';
import VyaparTable from './components/VyaparTable';

const SELLERS = [
    { tag: "GR", name: "Golden Aura", id: 1, color: "bg-yellow-500" },
    { tag: "RR", name: "Rudra Retail", id: 2, color: "bg-indigo-500" },
    { tag: "UB", name: "UBeauty", id: 3, color: "bg-pink-500" },
    { tag: "VV", name: "Velvet Vista", id: 4, color: "bg-emerald-500" },
    { tag: "DE", name: "Dropy Ecom", id: 5, color: "bg-orange-500" },
    { tag: "CV", name: "Costech Ventures", id: 6, color: "bg-green-600" },
];

type PassFileProduct = {
    id: string
    asin: string
    journey_id?: string | null // ✅ ADDED: Journey ID for cycle tracking
    product_name: string | null
    brand: string | null
    seller_tag: string | null
    funnel: string | null
    origin_india: boolean | null
    origin_china: boolean | null
    origin_us: boolean | null
    usd_price: number | null
    inr_purchase: number | null
    india_link: string | null
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
    sku?: string | null
    order_date: string | null
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

// ✅ UPDATED TAB TYPES
type TabType = 'main_file' | 'company_invoice_details' | 'checking' | 'shipment' | 'restock' | 'vyapar';

export default function TrackingPage() {
    // ✅ NEW: Active Seller State
    const [activeSeller, setActiveSeller] = useState<string>('GR');

    // ✅ NEW: Dynamic Seller ID Calculation
    const currentSellerId = useMemo(() => {
        return SELLER_TAG_MAPPING[activeSeller as SellerTag] || 1;
    }, [activeSeller]);

    const [activeTab, setActiveTab] = useState<TabType>('main_file');
    const [products, setProducts] = useState<PassFileProduct[]>([]);
    const [loading, setLoading] = useState(true);

    // ✅ NEW: Consolidated Counts State
    const [counts, setCounts] = useState({
        invoice: 0,
        checking: 0,
        shipment: 0,
        restock: 0
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Filter states
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [originFilter, setOriginFilter] = useState<'ALL' | 'India' | 'China' | 'US'>(() => {
        if (typeof window === 'undefined') return 'ALL';
        return (localStorage.getItem('indiaTrackingOriginFilter') as 'ALL' | 'India' | 'China' | 'US') || 'ALL';
    });

    const [funnelFilter, setFunnelFilter] = useState<'ALL' | 'RS' | 'DP'>(() => {
        if (typeof window === 'undefined') return 'ALL';
        return (localStorage.getItem('indiaTrackingFunnelFilter') as 'ALL' | 'RS' | 'DP') || 'ALL';
    });

    const [statusFilter, setStatusFilter] = useState<'ALL' | 'tracking' | 'pending'>(() => {
        if (typeof window === 'undefined') return 'ALL';
        return (localStorage.getItem('indiaTrackingStatusFilter') as 'ALL' | 'tracking' | 'pending') || 'ALL';
    });

    useEffect(() => {
        localStorage.setItem('indiaTrackingOriginFilter', originFilter);
    }, [originFilter]);

    useEffect(() => {
        localStorage.setItem('indiaTrackingFunnelFilter', funnelFilter);
    }, [funnelFilter]);

    useEffect(() => {
        localStorage.setItem('indiaTrackingStatusFilter', statusFilter);
    }, [statusFilter]);

    const [invoiceOpen, setInvoiceOpen] = useState(false)
    const [rollbackOpen, setRollbackOpen] = useState(false)
    const selectedItems = products
        .filter((p) => selectedIds.has(p.id))
        .map((p) => ({
            id: p.id,
            asin: p.asin,
            product_link: p.product_link,
            product_name: p.product_name,
            target_price: p.target_price,
            target_quantity: p.target_quantity,
            admin_target_price: (p as any).admin_target_price,
            funnel: p.funnel || p.validation_funnel,
            seller_tag: p.seller_tag || p.validation_seller_tag,
            inr_purchase_link: (p as any).inr_purchase_link,
            origin: p.origin,
            origin_india: p.origin_india,  // ✅ ADD THIS LINE
            origin_china: p.origin_china,
            origin_us: p.origin_us,
            product_weight: p.product_weight || 0,
            buying_price: p.buying_price,
            buying_quantity: p.buying_quantity,
            seller_link: p.seller_link,
            seller_phone: p.seller_phone,
            payment_method: p.payment_method,
            tracking_details: p.tracking_details,
            delivery_date: p.delivery_date,
            brand: p.brand,
            funnel_quantity: p.funnel_quantity || 1,  // ✅ ADDED
            funnel_seller: p.funnel_seller || null,
        }));

    console.log('✅ Selected items for invoice:', selectedItems);

    const [visibleColumns, setVisibleColumns] = useState({
        checkbox: true,
        asin: true,
        sku: true,
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
        orderdate: true,
        admintargetprice: true,
    });

    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

    const fetchProducts = async () => {
        try {
            setLoading(true);

            // ✅ FIX: Fetch from seller-specific Main File table
            const mainFileTableName = `india_tracking_seller_${currentSellerId}`;
            console.log('📋 Fetching from table:', mainFileTableName);

            // Recursive fetch to handle 1000+ rows
            let allData: any[] = [];
            let from = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data: purchasesData, error: purchasesError } = await supabase
                    .from(mainFileTableName) // ✅ FIXED: india_tracking_seller_X
                    .select('*') // Select ALL columns
                    .order('created_at', { ascending: false })
                    .range(from, from + batchSize - 1);

                if (purchasesError) throw purchasesError;

                if (purchasesData && purchasesData.length > 0) {
                    allData = [...allData, ...purchasesData];
                    from += batchSize;
                    hasMore = purchasesData.length === batchSize;
                } else {
                    hasMore = false;
                }
            }

            // ✅ OPTIMIZED: Get all potential validation data in ONE query
            const allAsins = allData.map((p: any) => p.asin);

            const { data: validationDataArray } = await supabase
                .from('india_validation_main_file')
                .select('asin, current_journey_id, seller_tag, funnel, product_weight, usd_price, inr_purchase, sku')
                .in('asin', allAsins);

            // Create maps for quick lookup
            const validationMap = new Map();
            const fallbackMap = new Map();

            validationDataArray?.forEach((v: any) => {
                if (v.current_journey_id) {
                    validationMap.set(`${v.asin}${v.current_journey_id}`, v);
                }
                fallbackMap.set(v.asin, v);
            });

            // ✅ FAST: Map data in memory (no async)
            const enrichedData = allData.map((product: any) => {
                const validationData =
                    validationMap.get(`${product.asin}${product.journey_id}`) ||
                    fallbackMap.get(product.asin);

                return {
                    ...product,
                    product_name: product.product_name ?? null,
                    // Origin handling
                    origin_india: product.origin?.toLowerCase().includes('india') || product.origin_india === true,
                    origin_china: product.origin?.toLowerCase().includes('china') || product.origin_china === true,
                    origin_us: product.origin?.toLowerCase().includes('us') || product.origin_us === true,
                    // Validation data
                    validation_funnel: validationData?.funnel ?? null,
                    validation_seller_tag: validationData?.seller_tag ?? null,
                    product_weight: validationData?.product_weight ?? null,
                    usd_price: validationData?.usd_price ?? null,
                    inr_purchase_from_validation: validationData?.inr_purchase ?? null,
                    validation_sku: validationData?.sku ?? null,
                };
            });
            console.log(`✅ Loaded ${enrichedData.length} products from ${mainFileTableName}`);
            setProducts(enrichedData);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };


    const fetchSellerCounts = async () => {
        const id = currentSellerId;
        try {
            console.log('🔢 Fetching counts for seller:', id);

            // Parallel fetch for speed
            const [invoiceRes, checkingRes, shipmentRes, restockRes] = await Promise.all([
                supabase.from(`india_invoice_seller_${id}`).select('*', { count: 'exact', head: true }),
                supabase.from(`india_checking_seller_${id}`).select('*', { count: 'exact', head: true }),
                supabase.from(`india_shipment_seller_${id}`).select('*', { count: 'exact', head: true }),
                supabase.from(`india_restock_seller_${id}`).select('*', { count: 'exact', head: true })
            ]);

            const newCounts = {
                invoice: invoiceRes.count ?? 0,
                checking: checkingRes.count ?? 0,
                shipment: shipmentRes.count ?? 0,
                restock: restockRes.count ?? 0
            };

            console.log('✅ Updated counts:', newCounts);
            setCounts(newCounts);
        } catch (error) {
            console.error('❌ Error fetching seller counts:', error);
        }
    };

    const handleCountsChange = () => {
        void fetchSellerCounts();
    };

    const refreshProductsSilently = async () => {
        try {
            // ✅ FIX: Fetch from seller-specific Main File table
            const mainFileTableName = `india_tracking_seller_${currentSellerId}`;

            // Recursive fetch to handle 1000+ rows
            let allData: any[] = [];
            let from = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data: purchasesData, error: purchasesError } = await supabase
                    .from(mainFileTableName) // ✅ FIXED: india_tracking_seller_X
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(from, from + batchSize - 1);

                if (purchasesError) throw purchasesError;

                if (purchasesData && purchasesData.length > 0) {
                    allData = [...allData, ...purchasesData];
                    from += batchSize;
                    hasMore = purchasesData.length === batchSize;
                } else {
                    hasMore = false;
                }
            }

            // Get all potential validation data
            const allAsins = allData.map((p: any) => p.asin);

            const { data: validationDataArray } = await supabase
                .from('india_validation_main_file')
                .select('asin, current_journey_id, seller_tag, funnel, product_weight, usd_price, inr_purchase, sku')
                .in('asin', allAsins);

            // Create maps for quick lookup
            const validationMap = new Map();
            const fallbackMap = new Map();

            validationDataArray?.forEach((v: any) => {
                if (v.current_journey_id) {
                    validationMap.set(`${v.asin}${v.current_journey_id}`, v);
                }
                fallbackMap.set(v.asin, v);
            });

            const enrichedData = allData.map((product: any) => {
                const validationData =
                    validationMap.get(`${product.asin}${product.journey_id}`) ||
                    fallbackMap.get(product.asin);

                return {
                    ...product,
                    product_name: product.product_name ?? null,
                    origin_india: product.origin?.toLowerCase().includes('india') || product.origin_india === true,
                    origin_china: product.origin?.toLowerCase().includes('china') || product.origin_china === true,
                    origin_us: product.origin?.toLowerCase().includes('us') || product.origin_us === true,
                    validation_funnel: validationData?.funnel ?? null,
                    validation_seller_tag: validationData?.seller_tag ?? null,
                    product_weight: validationData?.product_weight ?? null,
                    usd_price: validationData?.usd_price ?? null,
                    inr_purchase_from_validation: validationData?.inr_purchase ?? null,
                    validation_sku: validationData?.sku ?? null,
                };
            });

            setProducts(enrichedData);
        } catch (error) {
            console.error('Error refreshing products:', error);
        }
    };


    useEffect(() => {
        fetchProducts();
        fetchSellerCounts();

        // ✅ FIX: Subscribe to seller-specific table
        const mainFileTableName = `india_tracking_seller_${currentSellerId}`;
        const invoiceTableName = `india_invoice_seller_${currentSellerId}`;
        const checkingTableName = `india_checking_seller_${currentSellerId}`;

        const channel = supabase
            .channel(`tracking-${currentSellerId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: mainFileTableName, // ✅ FIXED
            }, refreshProductsSilently)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: invoiceTableName, // ✅ FIXED
            }, fetchSellerCounts)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: checkingTableName, // ✅ FIXED
            }, fetchSellerCounts)
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [currentSellerId]); // Re-run when seller changes


    const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
        checkbox: 50,
        asin: 120,
        sku: 120,
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
        orderdate: 150,
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

    const filteredProducts = products.filter(p => {
        // 1. Search Filter
        const matchesSearch = !searchQuery ||
            p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.funnel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p as any).validation_sku?.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        // 2. SELLER FILTER - Must match Active Seller Tag
        const tag = p.seller_tag || p.validation_seller_tag;
        const matchesSeller = tag?.includes(activeSeller);
        if (!matchesSeller) return false;

        // 3. Origin Filter
        if (originFilter !== 'ALL') {
            if (originFilter === 'India' && !p.origin_india) return false;
            if (originFilter === 'China' && !p.origin_china) return false;
            if (originFilter === 'US' && !p.origin_us) return false;
        }

        // 4. Funnel Filter
        // 4. Funnel Filter (RS = HD+LD, DP = DP)
        if (funnelFilter !== 'ALL') {
            const productFunnel = p.validation_funnel || p.funnel;
            if (funnelFilter === 'RS') {
                if (productFunnel !== 'HD' && productFunnel !== 'LD') return false;
            } else if (funnelFilter === 'DP') {
                if (productFunnel !== 'DP') return false;
            }
        }

        // 5. Status Filter
        if (statusFilter !== 'ALL') {
            if (p.status !== statusFilter) return false;
        }

        return !p.sent_to_admin && !p.move_to;
    });

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
            .from('india_traking')
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
            .from('india_purchases')
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

                    {/* ✅ NEW: SELLER TABS */}
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                        {SELLERS.map((seller) => (
                            <button
                                key={seller.tag}
                                onClick={() => setActiveSeller(seller.tag)}
                                className={`
                                    relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2
                                    ${activeSeller === seller.tag
                                        ? `${seller.color} text-white shadow-lg scale-105`
                                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'}
                                `}
                            >
                                {seller.name}
                                {activeSeller === seller.tag && (
                                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* ✅ UPDATED: STAGE TABS */}
                    <div className="flex gap-2 mb-4 overflow-x-auto">
                        {/* Main File Tab */}
                        <button
                            onClick={() => setActiveTab('main_file')}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'main_file'
                                ? 'bg-slate-800 text-white border-b-2 border-indigo-500'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            Main File ({filteredProducts.length})
                        </button>

                        {/* Invoice Tab */}
                        <button
                            onClick={() => setActiveTab('company_invoice_details')}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'company_invoice_details'
                                ? 'bg-slate-800 text-white border-b-2 border-indigo-500'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            Company Invoice ({counts.invoice})
                        </button>

                        {/* Checking Tab */}
                        <button
                            onClick={() => setActiveTab('checking')}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'checking'
                                ? 'bg-slate-800 text-white border-b-2 border-indigo-500'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            Checking ({counts.checking})
                        </button>

                        {/* Shipment Tab (New) */}
                        <button
                            onClick={() => setActiveTab('shipment')}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'shipment'
                                ? 'bg-slate-800 text-white border-b-2 border-indigo-500'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            Shipment ({counts.shipment})
                        </button>

                        {/* Restock Tab (New) */}
                        <button
                            onClick={() => setActiveTab('restock')}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'restock'
                                ? 'bg-slate-800 text-white border-b-2 border-indigo-500'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            Restock ({counts.restock})
                        </button>

                        {/* Vyapar Tab (New - Admin) */}
                        <button
                            onClick={() => setActiveTab('vyapar')}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border border-slate-800/50 ${activeTab === 'vyapar'
                                ? 'bg-red-900/20 text-red-400 border-red-900/50'
                                : 'text-slate-600 hover:text-slate-400'
                                }`}
                        >
                            Vyapar 🔒
                        </button>
                    </div>
                </div>

                {/* Search & Buttons - ONLY SHOW IN MAIN FILE */}
                {activeTab === 'main_file' && (
                    <div className="flex gap-3 items-center mb-6 px-6 pt-4">
                        <input
                            type="text"
                            placeholder="Search by ASIN, Product Name, SKU, or Funnel..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 max-w-md px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-slate-200 placeholder:text-slate-600"
                        />

                        {/* Funnel Filter Pills - Outside */}
                        <div className="flex items-center bg-slate-900/50 rounded-xl border border-slate-800 p-1">
                            {(['ALL', 'RS', 'DP'] as const).map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => setFunnelFilter(opt)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === opt
                                        ? opt === 'RS' ? 'bg-emerald-600 text-white shadow-lg'
                                            : opt === 'DP' ? 'bg-amber-500 text-black shadow-lg'
                                                : 'bg-indigo-600 text-white shadow-lg'
                                        : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>

                        {/* Filter Button */}
                        <div className="relative">
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all border ${originFilter !== 'ALL' || statusFilter !== 'ALL'
                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/30'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                Filter
                                {(originFilter !== 'ALL' || statusFilter !== 'ALL') && (
                                    <span className="w-5 h-5 bg-white/20 rounded-full text-[10px] flex items-center justify-center font-bold">
                                        {[originFilter !== 'ALL', statusFilter !== 'ALL'].filter(Boolean).length}
                                    </span>
                                )}
                            </button>

                            {isFilterOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
                                    <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-20 w-72">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-semibold text-slate-200 text-sm">Filters</h3>
                                            {(originFilter !== 'ALL' || statusFilter !== 'ALL') && (
                                                <button
                                                    onClick={() => { setOriginFilter('ALL'); setStatusFilter('ALL'); }}
                                                    className="text-xs text-red-400 hover:text-red-300 font-medium"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                        </div>

                                        <div className="mb-4">
                                            <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Origin</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(['ALL', 'India', 'China', 'US'] as const).map((opt) => (
                                                    <button
                                                        key={opt}
                                                        onClick={() => setOriginFilter(opt)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${originFilter === opt
                                                            ? opt === 'India' ? 'bg-orange-500 text-white'
                                                                : opt === 'China' ? 'bg-rose-500 text-white'
                                                                    : opt === 'US' ? 'bg-sky-500 text-white'
                                                                        : 'bg-indigo-600 text-white'
                                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                                            }`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Status</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(['ALL', 'tracking', 'pending'] as const).map((opt) => (
                                                    <button
                                                        key={opt}
                                                        onClick={() => setStatusFilter(opt)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${statusFilter === opt
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                                            }`}
                                                    >
                                                        {opt === 'ALL' ? 'All' : opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

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

                        {/* Hide Columns Button */}
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

                            {isColumnMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsColumnMenuOpen(false)} />
                                    <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-4 z-20 w-64">
                                        <h3 className="font-semibold text-slate-200 mb-3 text-sm">Toggle Columns</h3>
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                            {Object.keys(visibleColumns).map((col) => {
                                                const columnDisplayNames: { [key: string]: string } = {
                                                    'checkbox': 'Checkbox', 'asin': 'ASIN', 'sku': 'SKU', 'productlink': 'Product Link',
                                                    'productname': 'Product Name', 'targetprice': 'Validation Target Price',
                                                    'targetquantity': 'Target Quantity', 'admintargetprice': 'Admin Target Price',
                                                    'funnelquantity': 'Funnel', 'funnelseller': 'Seller Tag',
                                                    'inrpurchaselink': 'INR Purchase Link', 'origin': 'Origin',
                                                    'buyingprice': 'Buying Price', 'buyingquantity': 'Buying Quantity',
                                                    'sellerlink': 'Seller Link', 'sellerphno': 'Seller Ph No.',
                                                    'paymentmethod': 'Payment Method', 'trackingdetails': 'Tracking Details',
                                                    'deliverydate': 'Delivery Date', 'orderdate': 'Order Date', 'moveto': 'Move To',
                                                };
                                                return (
                                                    <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-2 rounded">
                                                        <input type="checkbox" checked={visibleColumns[col as keyof typeof visibleColumns]}
                                                            onChange={() => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col as keyof typeof visibleColumns] }))}
                                                            className="rounded border-slate-600 bg-slate-800 text-indigo-500" />
                                                        <span className="text-sm text-slate-300">{columnDisplayNames[col] || col}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
                                            <button onClick={() => setVisibleColumns(Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {} as typeof visibleColumns))}
                                                className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-500 text-xs font-medium">Show All</button>
                                            <button onClick={() => setVisibleColumns(Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: key === 'checkbox' || key === 'asin' }), {} as typeof visibleColumns))}
                                                className="flex-1 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-xs font-medium">Reset</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Rollback Button */}
                        <button
                            onClick={() => setRollbackOpen(true)}
                            className="px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all bg-red-600 text-white hover:bg-red-700 border border-red-700 shadow-lg hover:shadow-red-500/50"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Rollback
                        </button>
                    </div>
                )}

                {/* Table Container - SCROLLABLE ONLY */}
                <div className="flex-1 overflow-hidden px-6 pb-6">
                    <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-800 h-full flex flex-col">
                        {/* Table Wrapper with Scroll */}
                        <div className="flex-1 overflow-y-auto">
                            {activeTab === 'main_file' && (
                                <table className="w-full divide-y divide-slate-800" style={{ minWidth: '100%' }}>
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

                                            {/* ← ADD THIS BLOCK */}
                                            {visibleColumns.sku && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase relative group border-r border-slate-800"
                                                    style={{ width: columnWidths.sku + 'px' }}>
                                                    SKU
                                                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500"
                                                        onMouseDown={(e) => handleMouseDown('sku', e)} />
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

                                            {visibleColumns.orderdate && (
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800"
                                                    style={{ width: columnWidths.orderdate + 'px' }}>
                                                    Order Date
                                                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500"
                                                        onMouseDown={(e) => handleMouseDown('orderdate', e)} />
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

                                                        {/* ← ADD THIS BLOCK */}
                                                        {visibleColumns.sku && (
                                                            <td className="px-3 py-2 font-mono text-sm text-slate-400 overflow-hidden border-r border-slate-800/50"
                                                                style={{ width: columnWidths.sku + 'px' }}>
                                                                <div className="truncate" title={product.sku || (product as any).validation_sku || '-'}>
                                                                    {product.sku || (product as any).validation_sku || '-'}
                                                                </div>
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
                                                                {(product.india_link || product.product_link) ? (
                                                                    <a
                                                                        href={(product.india_link || product.product_link) ?? undefined}
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
                                                            <td className="px-3 py-2 overflow-hidden text-center border-r border-slate-800/50" style={{ width: columnWidths.funnelquantity + 'px' }}>
                                                                {product.validation_funnel ? (
                                                                    <span className={`w-9 h-9 inline-flex items-center justify-center rounded-lg font-bold text-sm ${(product.validation_funnel === 'HD' || product.validation_funnel === 'LD' || product.validation_funnel === 'RS')
                                                                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30'
                                                                        : product.validation_funnel === 'DP'
                                                                            ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg border border-amber-500/30'
                                                                            : 'bg-slate-600 text-white'
                                                                        }`}>
                                                                        {(product.validation_funnel === 'HD' || product.validation_funnel === 'LD') ? 'RS' : product.validation_funnel}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-600 italic">-</span>
                                                                )}
                                                            </td>
                                                        )}
                                                        {visibleColumns.funnelseller && (
                                                            <td className="px-3 py-2 overflow-hidden border-r border-slate-800/50" style={{ width: `${columnWidths.funnelseller}px` }}>
                                                                {product.validation_seller_tag ? (
                                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                                        {product.validation_seller_tag.split(',').map((tag) => {
                                                                            const cleanTag = tag.trim();
                                                                            return (
                                                                                <span
                                                                                    key={cleanTag}
                                                                                    className={`px-1.5 py-0.5 inline-flex items-center justify-center rounded text-[10px] font-bold leading-none ${cleanTag === 'GR' ? 'bg-yellow-400 text-black' :
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
                                                            <td className="px-3 py-2 overflow-hidden border-r border-slate-800/50" style={{ width: columnWidths.origin + 'px' }}>
                                                                <div className="flex flex-col gap-1 items-center">
                                                                    {product.origin_india && (
                                                                        <span className="px-2 py-1 bg-orange-500 text-white rounded text-xs font-semibold whitespace-nowrap">India</span>
                                                                    )}
                                                                    {product.origin_china && (
                                                                        <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-semibold whitespace-nowrap">China</span>
                                                                    )}
                                                                    {product.origin_us && (
                                                                        <span className="px-2 py-1 bg-sky-500 text-white rounded text-xs font-semibold whitespace-nowrap">US</span>
                                                                    )}
                                                                    {!product.origin_india && !product.origin_china && !product.origin_us && (
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
                                                        {visibleColumns.orderdate && (
                                                            <td className="px-3 py-2 overflow-hidden text-sm text-slate-300 text-center border-r border-slate-800/50"
                                                                style={{ width: columnWidths.orderdate + 'px' }}>
                                                                {product.order_date ?? '-'}
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

                        {/* ✅ PASS SELLER ID TO TABLES */}
                        {activeTab === 'company_invoice_details' && (
                            <div className="p-4 bg-slate-900 min-h-full">
                                <CompanyInvoiceTable
                                    sellerId={currentSellerId}
                                    onCountsChange={fetchSellerCounts}  // ✅ ADD THIS
                                />
                            </div>
                        )}
                        {activeTab === 'checking' && (
                            <div className="p-4 bg-slate-900 min-h-full">
                                <CheckingTable sellerId={currentSellerId}
                                    onCountsChange={handleCountsChange} />
                            </div>
                        )}

                        {/* ✅ NEW COMPONENTS */}
                        {activeTab === 'shipment' && (
                            <div className="p-4 bg-slate-900 min-h-full">
                                <ShipmentTable sellerId={currentSellerId}
                                    onCountsChange={handleCountsChange} />
                            </div>
                        )}

                        {activeTab === 'restock' && (
                            <div className="p-4 bg-slate-900 min-h-full">
                                <RestockTable sellerId={currentSellerId} />
                            </div>
                        )}

                        {activeTab === 'vyapar' && (
                            <div className="p-4 bg-slate-900 min-h-full">
                                <VyaparTable sellerId={currentSellerId}
                                    onCountsChange={handleCountsChange} />
                            </div>
                        )}

                        {/* Footer Stats - STICKY AT BOTTOM */}
                        {activeTab === 'main_file' && (
                            <div className="flex-none border-t border-slate-800 bg-slate-950 px-4 py-3">
                                <div className="text-sm text-slate-400">
                                    Showing {filteredProducts.length} of {products.length} products
                                    {selectedIds.size > 0 && ` | ${selectedIds.size} selected`}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
            <InvoiceModal
                open={invoiceOpen}
                onClose={() => setInvoiceOpen(false)}
                items={selectedItems}
                sellerId={currentSellerId} // ✅ Pass Seller ID
                onSuccess={() => {
                    fetchProducts();
                    fetchSellerCounts(); // Refresh counts too
                    setSelectedIds(new Set());
                }}
            />
            <RollbackModal
                open={rollbackOpen}
                onClose={() => setRollbackOpen(false)}
                sellerId={currentSellerId}
                onSuccess={() => {
                    fetchProducts();
                    fetchSellerCounts();
                    setRollbackOpen(false);
                }}
            />
        </PageGuard>
    );
}//C:\Users\Admin\Desktop\Project2\ScrappyioV2-main\app\dashboard\india-selling\tracking\page.tsx