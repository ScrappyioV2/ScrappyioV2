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
    { tag: "RR", name: "Rudra Retail", id: 2, color: "bg-orange-400" },
    { tag: "UB", name: "UBeauty", id: 3, color: "bg-pink-500" },
    { tag: "VV", name: "Velvet Vista", id: 4, color: "bg-emerald-500" },
    { tag: "DE", name: "Dropy Ecom", id: 5, color: "bg-orange-500" },
    { tag: "CV", name: "Costech Ventures", id: 6, color: "bg-green-600" },
    { tag: "MV", name: "Maverick", id: 7, color: "bg-orange-600" },
    { tag: "KL", name: "Kalash", id: 8, color: "bg-lime-500" },
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
            const { data, error } = await supabase.rpc('get_india_tracking_tab_counts');
            if (error) { console.error('Error fetching tab counts:', error); return; }
            setCounts({
                inbound: data?.inbound || 0,
                boxes: data?.boxes || 0,
                checking: data?.checking || 0,
            });
        } catch (error) {
            console.error('Error fetching tab counts:', error);
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
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <PageGuard>
            <div className="h-screen flex flex-col bg-[#111111] text-gray-100">
                {/* Header Section - FIXED */}
                <div className="flex-none px-4 sm:px-6 lg:px-6 pt-4 sm:pt-6 pb-6 border-b border-white/[0.1]">
                    <div className="mb-4 sm:mb-6">
                        <h1 className="text-xl sm:text-3xl font-bold text-white">
                            Tracking
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-300 mt-1">
                            Inbound → Boxes → Checking
                        </p>
                    </div>

                    {/* STAGE TABS */}
                    <div className="flex gap-2 mb-4 w-full sm:w-fit overflow-x-auto scrollbar-none">
                        {/* Inbound Tab */}
                        <button
                            onClick={() => setActiveTab("inbound")}
                            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === "inbound"
                                ? "bg-[#111111] text-white border-b-2 border-orange-500"
                                : "text-gray-500 hover:text-gray-200"
                                }`}
                        >
                            Inbound ({counts.inbound})
                        </button>

                        {/* Boxes Tab */}
                        <button
                            onClick={() => setActiveTab("boxes")}
                            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === "boxes"
                                ? "bg-[#111111] text-white border-b-2 border-orange-500"
                                : "text-gray-500 hover:text-gray-200"
                                }`}
                        >
                            Boxes created ({counts.boxes})
                        </button>

                        {/* Checking Tab */}
                        <button
                            onClick={() => setActiveTab("checking")}
                            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === "checking"
                                ? "bg-[#111111] text-white border-b-2 border-orange-500"
                                : "text-gray-500 hover:text-gray-200"
                                }`}
                        >
                            Checking ({counts.checking})
                        </button>
                    </div>
                </div>

                {/* Table Container - SCROLLABLE ONLY */}
                <div className="flex-1 overflow-hidden px-4 sm:px-6 lg:px-6 pb-3 sm:pb-6">
                    <div className="bg-[#1a1a1a] rounded-lg shadow-xl border border-white/[0.1] h-full flex flex-col">
                        <div className="flex-1 overflow-hidden min-h-0 px-4 sm:px-6 lg:px-6 pb-3 sm:pb-6">
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
