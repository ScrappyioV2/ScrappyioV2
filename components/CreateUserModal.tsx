'use client';

import { useState } from 'react';
import { X, Eye, EyeOff, UserPlus, Globe } from 'lucide-react';

const ROLE_OPTIONS = [
    { value: 'admin', label: 'Admin', color: 'bg-amber-500' },
    { value: 'validation', label: 'Validation', color: 'bg-purple-500' },
    { value: 'purchase', label: 'Purchase', color: 'bg-emerald-500' },
    { value: 'brand-checking', label: 'Brand Checking', color: 'bg-blue-500' },
    { value: 'listing-error', label: 'Listing Error', color: 'bg-rose-500' },
    { value: 'tracking', label: 'Tracking', color: 'bg-cyan-500' },
    { value: 'restock', label: 'Restock', color: 'bg-teal-500' },
    { value: 'reorder', label: 'Reorder', color: 'bg-orange-500' },
    { value: 'viewer', label: 'Viewer', color: 'bg-slate-500' },
];

const MARKETPLACE_OPTIONS = [
    { value: 'usa-selling', label: 'USA', color: 'text-blue-400', bg: 'bg-blue-500' },
    { value: 'india-selling', label: 'India', color: 'text-emerald-400', bg: 'bg-emerald-500' },
    { value: 'uk-selling', label: 'UK', color: 'text-purple-400', bg: 'bg-purple-500' },
    { value: 'uae-selling', label: 'UAE', color: 'text-amber-400', bg: 'bg-amber-500' },
    { value: 'flipkart', label: 'Flipkart', color: 'text-yellow-400', bg: 'bg-yellow-500' },
    { value: 'jio-mart', label: 'JioMart', color: 'text-pink-400', bg: 'bg-pink-500' },
];

// Maps role → which page permission keys to auto-grant
const ROLE_PAGE_MAP: Record<string, string[]> = {
    'admin': [],
    'validation': ['view-validation'],
    'purchase': ['view-purchases'],
    'brand-checking': ['view-brand-checking'],
    'listing-error': ['view-listing-errors'],
    'tracking': ['view-tracking'],
    'restock': ['view-restock'],
    'reorder': ['view-reorder'],          // unchanged — stays alone
    'viewer': [],
};

interface CreateUserModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
    const [form, setForm] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'validation',
    });
    const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([]);
    const [selectedPages, setSelectedPages] = useState<string[]>([]);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleMarketplace = (key: string) => {
        setSelectedMarketplaces((prev) =>
            prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
        );
    };

    const selectAllMarketplaces = () => {
        if (selectedMarketplaces.length === MARKETPLACE_OPTIONS.length) {
            setSelectedMarketplaces([]);
        } else {
            setSelectedMarketplaces(MARKETPLACE_OPTIONS.map((m) => m.value));
        }
    };

    // Build allowed_pages from role + marketplaces
    const buildAllowedPages = (): string[] => {
        const pages: string[] = [];

        // Add marketplace permissions
        pages.push(...selectedMarketplaces);

        // Add manually selected page permissions
        pages.push(...selectedPages);

        // Admin gets manage-sellers + admin-access too
        if (form.role === 'admin') {
            pages.push('manage-sellers', 'admin-access');
        }

        return [...new Set(pages)]; // deduplicate
    };

    const handleSubmit = async () => {
        setError(null);

        if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
            setError('All fields are required');
            return;
        }

        if (form.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (form.role !== 'admin' && selectedMarketplaces.length === 0) {
            setError('Select at least one marketplace');
            return;
        }

        try {
            setLoading(true);

            const res = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: form.email.trim().toLowerCase(),
                    password: form.password,
                    full_name: form.full_name.trim(),
                    role: form.role,
                    allowed_pages: buildAllowedPages(),
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Reset form
            setForm({ full_name: '', email: '', password: '', role: 'validation' });
            setSelectedMarketplaces([]);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    const allSelected = selectedMarketplaces.length === MARKETPLACE_OPTIONS.length;

    return (
        <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-[#111111] border-b border-white/[0.1] px-6 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                            <UserPlus className="w-5 h-5 text-orange-500" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Create New User</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-2 hover:bg-[#111111] rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Form */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Full Name</label>
                        <input
                            type="text"
                            value={form.full_name}
                            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                            placeholder="e.g. Ravi Kumar"
                            className="w-full px-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Email Address</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="e.g. ravi@scrappy.io"
                            className="w-full px-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder="Min 6 characters"
                                className="w-full px-4 py-2.5 pr-12 bg-[#111111] border border-white/[0.1] rounded-lg text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Role */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-semibold text-gray-400">Role</label>
                            <span className="text-[10px] text-gray-500">
                                Primary: <span className="text-orange-500 font-bold">{form.role.charAt(0).toUpperCase() + form.role.slice(1)}</span>
                            </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {ROLE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        setForm({ ...form, role: opt.value });
                                        // Replace page selections with this role's default pages
                                        const rolePages = ROLE_PAGE_MAP[opt.value] || [];
                                        setSelectedPages([...rolePages]);
                                    }}
                                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${form.role === opt.value
                                        ? `${opt.color} text-white border-transparent shadow-lg`
                                        : 'bg-[#111111] text-gray-400 border-white/[0.1] hover:border-white/[0.1]'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Marketplace Access */}
                    {form.role !== 'admin' && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-gray-400 flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-orange-500" />
                                    Marketplace Access
                                </label>
                                <button
                                    onClick={selectAllMarketplaces}
                                    className="text-[10px] font-bold text-orange-500 hover:text-orange-400 transition-colors"
                                >
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {MARKETPLACE_OPTIONS.map((mp) => (
                                    <button
                                        key={mp.value}
                                        onClick={() => toggleMarketplace(mp.value)}
                                        className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 ${selectedMarketplaces.includes(mp.value)
                                            ? `${mp.bg} text-white border-transparent shadow-lg`
                                            : 'bg-[#111111] text-gray-400 border-white/[0.1] hover:border-white/[0.1]'
                                            }`}
                                    >
                                        {mp.label}
                                    </button>
                                ))}
                            </div>
                            {selectedMarketplaces.length > 0 && (
                                <p className="text-[10px] text-gray-500 mt-2">
                                    Access: {selectedMarketplaces.length} marketplace{selectedMarketplaces.length > 1 ? 's' : ''} + {ROLE_PAGE_MAP[form.role]?.join(', ') || 'no page perms'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Page Permissions */}
                    {form.role !== 'admin' && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-gray-400 flex items-center gap-1.5">
                                    <Eye className="w-3.5 h-3.5 text-purple-400" />
                                    Page Access
                                </label>
                                <span className="text-[10px] text-gray-500">
                                    {selectedPages.length} selected
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'view-brand-checking', label: 'Brand Checking', color: 'bg-blue-500' },
                                    { value: 'view-validation', label: 'Validation', color: 'bg-purple-500' },
                                    { value: 'view-listing-errors', label: 'Listing Errors', color: 'bg-rose-500' },
                                    { value: 'view-purchases', label: 'Purchases', color: 'bg-emerald-500' },
                                    { value: 'view-tracking', label: 'Tracking', color: 'bg-cyan-500' },
                                    { value: 'view-reorder', label: 'Reorder', color: 'bg-orange-500' },
                                    { value: 'view-restock', label: 'Restock', color: 'bg-teal-500' },
                                ].map((pg) => (
                                    <button
                                        key={pg.value}
                                        onClick={() => {
                                            setSelectedPages((prev) =>
                                                prev.includes(pg.value)
                                                    ? prev.filter((p) => p !== pg.value)
                                                    : [...prev, pg.value]
                                            );
                                        }}
                                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${selectedPages.includes(pg.value)
                                            ? `${pg.color} text-white border-transparent shadow-lg`
                                            : 'bg-[#111111] text-gray-400 border-white/[0.1] hover:border-white/[0.1]'
                                            }`}
                                    >
                                        {pg.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {form.role === 'admin' && (
                        <div className="px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                            ⚡ Admin role has full access to all marketplaces and pages.
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                            ❌ {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-[#111111] border-t border-white/[0.1] px-6 py-4 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-5 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg text-gray-500 hover:bg-[#1a1a1a] font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-lg font-semibold transition-all shadow-lg disabled:opacity-50"
                    >
                        {loading ? 'Creating...' : 'Create User'}
                    </button>
                </div>
            </div>
        </div>
    );
}
