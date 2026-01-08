"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Product = {
  id: number;
  name: string;
  sku: string;
  marketplace: string;
  status: string;
};

export default function DashboardDetailsPage() {
  const params = useSearchParams();
  const router = useRouter();

  const seller = params.get("seller") || "";
  const stage = params.get("stage") || "";
  const status = params.get("status") || "";

  const [data, setData] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [search, setSearch] = useState("");
  const [marketplace, setMarketplace] = useState("all");

  useEffect(() => {
    const qs = new URLSearchParams({
      seller,
      stage,
      status,
      search,
      marketplace,
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortOrder,
    });

    fetch(`/api/products?${qs.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        setData(res.data);
        setTotal(res.total);
      });
  }, [
    seller,
    stage,
    status,
    search,
    marketplace,
    page,
    pageSize,
    sortBy,
    sortOrder,
  ]);

  function toggleSort(col: string) {
    if (sortBy !== col) {
      setSortBy(col);
      setSortOrder("asc");
    } else {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Header */}
      <button
        onClick={() => router.push("/dashboard")}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-lg font-semibold">
        {seller} → {stage} → {status} ({total})
      </h1>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product / SKU"
          className="border rounded px-3 py-2 text-sm"
        />

        <select
          value={marketplace}
          onChange={(e) => setMarketplace(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">All marketplaces</option>
          <option value="USA">USA</option>
          <option value="India">India</option>
          <option value="UK">UK</option>
        </select>

        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>

      {/* Table */}
      <div className="border rounded bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th
                className="border p-2 cursor-pointer"
                onClick={() => toggleSort("name")}
              >
                Product
              </th>
              <th
                className="border p-2 cursor-pointer"
                onClick={() => toggleSort("sku")}
              >
                SKU
              </th>
              <th className="border p-2">Marketplace</th>
              <th
                className="border p-2 cursor-pointer"
                onClick={() => toggleSort("status")}
              >
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="border p-2">{item.name}</td>
                <td className="border p-2">{item.sku}</td>
                <td className="border p-2">{item.marketplace}</td>
                <td className="border p-2">{item.status}</td>
              </tr>
            ))}

            {data.length === 0 && (
              <tr>
                <td colSpan={4} className="border p-6 text-center text-gray-500">
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <span>
          Page {page} of {totalPages}
        </span>

        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
