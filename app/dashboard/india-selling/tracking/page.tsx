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
    const [refreshKey, setRefreshKey] = useState(0);

    const [counts, setCounts] = useState({
        inbound: 0,
        boxes: 0,
        checking: 0,
    });

    const fetchTabCounts = async () => {
        try {
            const [inboundRes, boxesRes, checkingRes] = await Promise.all([
                supabase.from("india_inbound_tracking").select("asin").gt("pending_quantity", 0),
                supabase.from("india_inbound_boxes").select("box_number"),
                supabase.from("india_box_checking").select("asin").is('action_status', null),
            ]);

            setCounts({
                inbound: new Set((inboundRes.data || []).map((r: any) => r.asin)).size,
                boxes: new Set((boxesRes.data || []).map((r: any) => r.box_number)).size,
                checking: new Set((checkingRes.data || []).map((r: any) => r.asin)).size,
            });
        } catch (error) {
            console.error("Error fetching tab counts:", error);
        }
    };

    const handleCountsChange = () => {
        void fetchTabCounts();
        setRefreshKey(k => k + 1);
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
                <div className="flex-none px-3 sm:px-4 lg:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-800">
                    <div className="mb-4 sm:mb-6">
                        <h1 className="text-xl sm:text-3xl font-bold text-white">
                            Tracking
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1">
                            Inbound → Boxes → Checking
                        </p>
                    </div>

                    {/* STAGE TABS */}
                    <div className="flex gap-2 mb-4 w-full sm:w-fit overflow-x-auto scrollbar-none">
                        {/* Inbound Tab */}
                        <button
                            onClick={() => setActiveTab("inbound")}
                            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === "inbound"
                                ? "bg-slate-800 text-white border-b-2 border-indigo-500"
                                : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            Inbound ({counts.inbound})
                        </button>

                        {/* Boxes Tab */}
                        <button
                            onClick={() => setActiveTab("boxes")}
                            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === "boxes"
                                ? "bg-slate-800 text-white border-b-2 border-indigo-500"
                                : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            Boxes created ({counts.boxes})
                        </button>

                        {/* Checking Tab */}
                        <button
                            onClick={() => setActiveTab("checking")}
                            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === "checking"
                                ? "bg-slate-800 text-white border-b-2 border-indigo-500"
                                : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            Checking ({counts.checking})
                        </button>
                    </div>
                </div>

                {/* Table Container - SCROLLABLE ONLY */}
                <div className="flex-1 overflow-hidden px-3 sm:px-4 lg:px-6 pb-3 sm:pb-6">
                    <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-800 h-full flex flex-col">
                        <div className="flex-1 overflow-hidden min-h-0 px-3 sm:px-4 lg:px-6 pb-3 sm:pb-6">
                            <div className={activeTab === "inbound" ? "h-full" : "hidden"}>
                                <InboundTable onCountsChange={handleCountsChange} refreshKey={refreshKey} />
                            </div>

                            <div className={activeTab === "boxes" ? "h-full" : "hidden"}>
                                <BoxesTab onCountsChange={handleCountsChange} refreshKey={refreshKey} />
                            </div>

                            <div className={activeTab === "checking" ? "h-full" : "hidden"}>
                                <CheckingTable
                                    sellerId={currentSellerId}
                                    onCountsChange={handleCountsChange}
                                    refreshKey={refreshKey}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}
