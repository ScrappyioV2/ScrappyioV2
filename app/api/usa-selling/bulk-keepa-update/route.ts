import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔒 SERVER ONLY
);

const KEEPA_API_KEY = process.env.KEEPA_API_KEY!;
const KEEPA_API_URL = "https://api.keepa.com/product";

export async function POST(req: Request) {
  try {
    const { asins } = await req.json();

    if (!Array.isArray(asins) || asins.length === 0) {
      return NextResponse.json(
        { error: "No ASINs provided" },
        { status: 400 }
      );
    }

    // Keepa allows up to 100 ASINs per call
    const asinString = asins.join(",");

    const res = await fetch(
      `${KEEPA_API_URL}?key=${KEEPA_API_KEY}&domain=1&asin=${asinString}&stats=1`
    );

    const data = await res.json();

    if (!data.products) {
      throw new Error("Invalid Keepa response");
    }

    for (const product of data.products) {
      const asin = product.asin;

      // Buy Box price is in cents
      const buyBoxCents = product.stats?.buyBoxPrice;

      if (!buyBoxCents || buyBoxCents <= 0) continue;

      const usdPrice = buyBoxCents / 100;

      await supabase
        .from("usa_validation_main_file")
        .update({
          usd_price: usdPrice,
        })
        .eq("asin", asin);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Bulk Keepa Update Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
