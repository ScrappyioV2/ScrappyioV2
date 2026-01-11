'use client'

import { useState, useEffect } from 'react'
import PageTransition from '@/components/layout/PageTransition'
import { supabase } from '@/lib/supabaseClient'
import Toast from '@/components/Toast'

interface ProductRow {
    id: string
    asin: string
    product_name: string | null
    brand: string | null
    funnel: string | null
    monthly_unit: number | null
    product_link: string | null
    amz_link: string | null
    working?: boolean
}

type CategoryTab = 'high_demand' | 'low_demand' | 'dropshipping' | 'not_approved' | 'reject'

export default function GoldenAuraPage() {
    const [activeTab, setActiveTab] = useState<CategoryTab>('high_demand')
    const [products, setProducts] = useState<ProductRow[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [visibleColumns, setVisibleColumns] = useState({
        asin: true,
        product_name: true,
        brand: true,
        funnel: true,
        monthly_unit: true,
        product_link: true,
        amz_link: true,
    })
    const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)


    const SELLER_ID = '1' // Golden Aura is seller 1

    useEffect(() => {
        fetchProducts()
    }, [activeTab])

    const fetchProducts = async () => {
        setLoading(true)
        try {
            const tableName = `usa_seller_${SELLER_ID}_${activeTab}`

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching products:', error)
                setProducts([])
            } else {
                setProducts(data || [])
            }
        } catch (err) {
            console.error('Fetch error:', err)
            setProducts([])
        } finally {
            setLoading(false)
        }
    }

    const moveProduct = async (product: ProductRow, action: 'approved' | 'not_approved' | 'reject') => {
        setProcessingId(product.id)

        try {
            let targetTable = ''

            // Determine target table based on action
            if (action === 'approved') {
                targetTable = `usa_seller_${SELLER_ID}_validation`
            } else if (action === 'not_approved') {
                targetTable = `usa_seller_${SELLER_ID}_not_approved`
            } else if (action === 'reject') {
                targetTable = `usa_seller_${SELLER_ID}_reject`
            }

            // Prepare data (remove id and working fields)
            const { id, working, ...productData } = product

            // Insert into target table
            const { error: insertError } = await supabase
                .from(targetTable)
                .insert([productData])

            if (insertError) {
                console.error('Error inserting product:', insertError)
                setToast({ message: `Failed to move product: ${insertError.message}`, type: 'error' })
                return
            }

            // Delete from current table
            const currentTable = `usa_seller_${SELLER_ID}_${activeTab}`
            const { error: deleteError } = await supabase
                .from(currentTable)
                .delete()
                .eq('id', product.id)

            if (deleteError) {
                console.error('Error deleting product:', deleteError)
                setToast({ message: 'Failed to delete product from current table', type: 'error' })
                return
            }

            // Refresh the list
            await fetchProducts()

            // Show success message
            const actionText = action === 'approved' ? 'Validation' : action === 'not_approved' ? 'Not Approved' : 'Reject'
            setToast({ message: `Product moved to ${actionText} successfully!`, type: 'success' })

        } catch (err) {
            console.error('Move product error:', err)
            setToast({ message: 'An error occurred while moving the product', type: 'error' })
        } finally {
            setProcessingId(null)
        }
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(products.map(p => p.id)))
        } else {
            setSelectedIds(new Set())
        }
    }

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds)
        if (checked) {
            newSelected.add(id)
        } else {
            newSelected.delete(id)
        }
        setSelectedIds(newSelected)
    }

    const toggleColumn = (column: keyof typeof visibleColumns) => {
        setVisibleColumns(prev => ({
            ...prev,
            [column]: !prev[column]
        }))
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="max-w-full mx-auto">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-900">Golden Aura - Brand Checking</h1>
                        <p className="text-gray-600 mt-1">Manage products across different categories</p>
                    </div>

                    {/* Horizontal Tabs */}
                    <div className="flex gap-3 mb-6">
                        <button
                            onClick={() => setActiveTab('high_demand')}
                            className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${activeTab === 'high_demand'
                                ? 'bg-green-400 text-white shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            High Demand
                        </button>
                        <button
                            onClick={() => setActiveTab('low_demand')}
                            className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${activeTab === 'low_demand'
                                ? 'bg-blue-400 text-white shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            Low Demand
                        </button>
                        <button
                            onClick={() => setActiveTab('dropshipping')}
                            className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${activeTab === 'dropshipping'
                                ? 'bg-yellow-400 text-gray-900 shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            Dropshipping
                        </button>
                        <button
                            onClick={() => setActiveTab('not_approved')}
                            className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${activeTab === 'not_approved'
                                ? 'bg-red-400 text-white shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            Not Approved
                        </button>
                        <button
                            onClick={() => setActiveTab('reject')}
                            className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${activeTab === 'reject'
                                ? 'bg-gray-400 text-white shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            Reject
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-3">
                                <div className="relative">
                                    <button
                                        onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                    >
                                        Columns
                                    </button>
                                    {isColumnDropdownOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setIsColumnDropdownOpen(false)}
                                            />
                                            <div className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-lg p-3 z-20 w-48">
                                                {Object.keys(visibleColumns).map((col) => (
                                                    <label key={col} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={visibleColumns[col as keyof typeof visibleColumns]}
                                                            onChange={() => toggleColumn(col as keyof typeof visibleColumns)}
                                                            className="rounded"
                                                        />
                                                        <span className="text-sm capitalize">{col.replace('_', ' ')}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                                    Manage Statuse
                                </button>
                                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                                    Manage Master Badges
                                </button>
                            </div>
                            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium">
                                Roll Back
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                                <p className="mt-2 text-gray-600">Loading products...</p>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <p className="text-lg">No products found in {activeTab.replace('_', ' ')}</p>
                                <p className="text-sm mt-2">Add products to see them here</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                                        <tr>
                                            <th className="p-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.size === products.length && products.length > 0}
                                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                                    className="rounded"
                                                />
                                            </th>
                                            {visibleColumns.asin && <th className="p-3 text-left font-semibold text-gray-700">ASIN</th>}
                                            {visibleColumns.product_name && <th className="p-3 text-left font-semibold text-gray-700">Product Name</th>}
                                            {visibleColumns.brand && <th className="p-3 text-left font-semibold text-gray-700">Brand</th>}
                                            {visibleColumns.funnel && <th className="p-3 text-left font-semibold text-gray-700">Funnel</th>}
                                            {visibleColumns.monthly_unit && <th className="p-3 text-left font-semibold text-gray-700">Monthly Unit</th>}
                                            {visibleColumns.product_link && <th className="p-3 text-left font-semibold text-gray-700">Product Link</th>}
                                            {visibleColumns.amz_link && <th className="p-3 text-left font-semibold text-gray-700">AMZ Link</th>}
                                            <th className="p-3 text-left font-semibold text-gray-700">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map((product, index) => (
                                            <tr key={product.id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                                <td className="p-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(product.id)}
                                                        onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                                                        className="rounded"
                                                    />
                                                </td>
                                                {visibleColumns.asin && <td className="p-3 font-mono text-sm">{product.asin}</td>}
                                                {visibleColumns.product_name && <td className="p-3">{product.product_name || '-'}</td>}
                                                {visibleColumns.brand && <td className="p-3">{product.brand || '-'}</td>}
                                                {visibleColumns.funnel && <td className="p-3">{product.funnel || '-'}</td>}
                                                {visibleColumns.monthly_unit && <td className="p-3">{product.monthly_unit || '-'}</td>}
                                                {visibleColumns.product_link && (
                                                    <td className="p-3">
                                                        {product.product_link ? (
                                                            <a href={product.product_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                                        ) : '-'}
                                                    </td>
                                                )}
                                                {visibleColumns.amz_link && (
                                                    <td className="p-3">
                                                        {product.amz_link ? (
                                                            <a href={product.amz_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                                        ) : '-'}
                                                    </td>
                                                )}
                                                <td className="p-3">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => moveProduct(product, 'approved')}
                                                            disabled={processingId === product.id}
                                                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            {processingId === product.id ? '...' : 'Approved'}
                                                        </button>
                                                        <button
                                                            onClick={() => moveProduct(product, 'not_approved')}
                                                            disabled={processingId === product.id}
                                                            className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            {processingId === product.id ? '...' : 'Not Approved'}
                                                        </button>
                                                        <button
                                                            onClick={() => moveProduct(product, 'reject')}
                                                            disabled={processingId === product.id}
                                                            className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            {processingId === product.id ? '...' : 'Reject'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 text-sm text-gray-600">
                        <p>Showing {products.length} products | {selectedIds.size} selected</p>
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
            </div>
        </PageTransition>
    )
}
