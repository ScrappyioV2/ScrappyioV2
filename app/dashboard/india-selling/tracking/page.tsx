"use client";
import PageGuard from "@/components/PageGuard";
import { supabase } from "@/lib/supabaseClient";
import { useState, useEffect, useMemo } from "react";
import CheckingTable from "./components/CheckingTable";
import InboundTable from "./components/InboundTable";
import { SELLER_TAG_MAPPING, SellerTag } from "@/lib/utils";
import BoxesTab from "./components/BoxesTab";

const SELLERS = [
    { tag: "GR", name: "Golden Aura", id: 1, color: "bg-yellow-500" },
    { tag: "RR", name: "Rudra Retail", id: 2, color: "bg-indigo-500" },
    { tag: "UB", name: "UBeauty", id: 3, color: "bg-pink-500" },
    { tag: "VV", name: "Velvet Vista", id: 4, color: "bg-emerald-500" },
    { tag: "DE", name: "Dropy Ecom", id: 5, color: "bg-orange-500" },
    { tag: "CV", name: "Costech Ventures", id: 6, color: "bg-green-600" },
];

type TabType = "inbound" | "boxes" | "checking";

export default function TrackingPage() {
    const [activeSeller, setActiveSeller] = useState<string>("GR");


    const currentSellerId = useMemo(() => {
        return SELLER_TAG_MAPPING[activeSeller as SellerTag] || 1;
    }, [activeSeller]);

    const [activeTab, setActiveTab] = useState<TabType>("inbound");

    const [counts, setCounts] = useState({
        inbound: 0,
        boxes: 0,
        checking: 0,
    });

    const fetchTabCounts = async () => {
        try {
            const [inboundRes, boxesRes, checkingRes] = await Promise.all([
                supabase.from("india_inbound_tracking").select("*", { count: "exact", head: true }),
                supabase.from("india_inbound_boxes").select("*", { count: "exact", head: true }),
                supabase.from("india_box_checking").select("*", { count: "exact", head: true }),
            ]);

            setCounts({
                inbound: inboundRes.count ?? 0,
                boxes: boxesRes.count ?? 0,
                checking: checkingRes.count ?? 0,
            });
        } catch (error) {
            console.error("Error fetching tab counts:", error);
        }
    };

    const handleCountsChange = () => {
        void fetchTabCounts();
    };

    useEffect(() => {
        fetchTabCounts();

        const channel = supabase
            .channel("tracking-inbound")
            .on("postgres_changes", { event: "*", schema: "public", table: "india_inbound_tracking" }, () => fetchTabCounts())
            .on("postgres_changes", { event: "*", schema: "public", table: "india_box_checking" }, () => fetchTabCounts())
            .subscribe();
        return () => {
            channel.unsubscribe();
        };
    }, []);

    return (
        <PageGuard>
            <div className="h-screen flex flex-col bg-slate-950 text-slate-200">
                {/* Header Section - FIXED */}
                <div className="flex-none px-6 pt-6 pb-4 border-b border-slate-800">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-white">
                            Tracking
                        </h1>
                        <p className="text-slate-400 mt-1">
                            Inbound → Boxes → Checking
                        </p>
                    </div>

                    {/* STAGE TABS */}
                    <div className="flex gap-2 mb-4 overflow-x-auto">
                        {/* Inbound Tab */}
                        <button
                            onClick={() => setActiveTab("inbound")}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === "inbound"
                                ? "bg-slate-800 text-white border-b-2 border-indigo-500"
                                : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            Inbound ({counts.inbound})
                        </button>

                        {/* Boxes Tab */}
                        <button
                            onClick={() => setActiveTab("boxes")}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === "boxes"
                                ? "bg-slate-800 text-white border-b-2 border-indigo-500"
                                : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            Boxes created ({counts.boxes})
                        </button>

                        {/* Checking Tab */}
                        <button
                            onClick={() => setActiveTab("checking")}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === "checking"
                                ? "bg-slate-800 text-white border-b-2 border-indigo-500"
                                : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            Checking ({counts.checking})
                        </button>
                    </div>
                </div>

                {/* Table Container - SCROLLABLE ONLY */}
                <div className="flex-1 overflow-hidden px-6 pb-6">
                    <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-800 h-full flex flex-col">
                        <div className="flex-1 overflow-hidden min-h-0 px-6 pb-6">
                            {activeTab === "inbound" && (
                                <InboundTable onCountsChange={handleCountsChange} />
                            )}

                            {activeTab === "boxes" && (
                                <BoxesTab onCountsChange={handleCountsChange} />
                            )}

                            {activeTab === "checking" && (
                                <CheckingTable
                                    sellerId={currentSellerId}
                                    onCountsChange={handleCountsChange}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}
