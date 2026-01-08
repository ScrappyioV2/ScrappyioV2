import { NextRequest, NextResponse } from "next/server";
import { mockProducts } from "../../../data/mockProducts";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const seller = searchParams.get("seller");
  const stage = searchParams.get("stage");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.toLowerCase() || "";
  const marketplace = searchParams.get("marketplace") || "all";

  const page = Number(searchParams.get("page") || 1);
  const pageSize = Number(searchParams.get("pageSize") || 10);

  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder") || "asc";

  // 1️⃣ Filter
  let filtered = mockProducts.filter((p) => {
    if (seller && p.seller !== seller) return false;
    if (stage && p.stage !== stage) return false;
    if (status && p.status !== status) return false;
    if (marketplace !== "all" && p.marketplace !== marketplace) return false;

    if (
      search &&
      !(
        p.name.toLowerCase().includes(search) ||
        p.sku.toLowerCase().includes(search)
      )
    )
      return false;

    return true;
  });

  // 2️⃣ Sort
  if (sortBy) {
    filtered.sort((a: any, b: any) => {
      const A = a[sortBy];
      const B = b[sortBy];

      if (A < B) return sortOrder === "asc" ? -1 : 1;
      if (A > B) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }

  // 3️⃣ Pagination
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const data = filtered.slice(start, end);

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
  });
}
