import { NextRequest, NextResponse } from "next/server";
import { LIBRARY } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");
  const items =
    category && category !== "全部"
      ? LIBRARY.filter((i) => i.category === category)
      : LIBRARY;
  return NextResponse.json({ items, total: items.length });
}
