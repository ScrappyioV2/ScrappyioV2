import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      error: "Mock products endpoint disabled. Real data source not connected yet."
    },
    { status: 410 }
  );
}
