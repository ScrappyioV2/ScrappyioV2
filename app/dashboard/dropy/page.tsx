"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import {
  FileCheck, LayoutList, ShoppingBag, Truck, Package, RotateCcw, AlertTriangle, Loader2
} from 'lucide-react';

type PipelineCount = {
  label: string;
  count: number;
  icon: React.ReactNode;
  href: string;
  color: string;
};

export default function DropyDashboard() {
  const { userRole, hasPageAccess, loading: authLoading } = useAuth();
  const router = useRouter();
  const [counts, setCounts] = useState<PipelineCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    const pages = hasPageAccess ? Object.keys(Object.fromEntries(
      Object.entries({ 'view-validation': true, 'view-purchases': true, 'view-tracking': true, 'view-listing-errors': true, 'view-restock': true, 'view-reorder': true }).filter(([k]) => hasPageAccess(k as any))
    )) : [];

    async function fetchCounts() {
      setLoading(true);
      const [validation, purchases, tracking, listingErrors] = await Promise.all([
        supabase.from('dropy_validation_main_file').select('*', { count: 'exact', head: true }),
        supabase.from('dropy_purchases').select('*', { count: 'exact', head: true }).is('move_to', null),
        supabase.from('dropy_inbound_tracking').select('*', { count: 'exact', head: true }),
        supabase.from('listing_errors').select('*', { count: 'exact', head: true }).eq('marketplace', 'dropy').eq('error_status', 'pending'),
      ]);

      setCounts([
        { label: 'Validation', count: validation.count ?? 0, icon: <FileCheck className="w-5 h-5" />, href: '/dashboard/dropy/validation', color: 'from-blue-500 to-blue-700' },
        { label: 'Purchases', count: purchases.count ?? 0, icon: <ShoppingBag className="w-5 h-5" />, href: '/dashboard/dropy/purchases', color: 'from-emerald-500 to-emerald-700' },
        { label: 'Tracking', count: tracking.count ?? 0, icon: <Truck className="w-5 h-5" />, href: '/dashboard/dropy/tracking', color: 'from-purple-500 to-purple-700' },
        { label: 'Listing Errors', count: listingErrors.count ?? 0, icon: <AlertTriangle className="w-5 h-5" />, href: '/dashboard/dropy/listing-error', color: 'from-red-500 to-red-700' },
      ]);
      setLoading(false);
    }
    fetchCounts();
  }, [authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dropy</h1>
        <p className="text-gray-500 text-sm mt-1">Pipeline overview — no brand checking, direct to validation</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {counts.map((item) => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.15] transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white`}>
                {item.icon}
              </div>
              <span className="text-3xl font-bold text-white font-mono">
                {item.count.toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">{item.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
