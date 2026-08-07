import { NextResponse } from "next/server";
import { getHotspots, getDetail } from "@/lib/hotspots-server";
import type { HotspotCat, HotspotTitle } from "@/lib/hotspots";

// 需要 Node 运行时（用到 fs 写历史/详情）且每次动态执行（不走静态缓存）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "timeline";

  // 懒详情：仅被点击时生成并落盘
  if (mode === "detail") {
    const id = searchParams.get("id") || "";
    const d = getDetail(id);
    if (!d) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(d);
  }

  const force = searchParams.get("force") === "1";
  const meta = searchParams.get("meta") === "1";
  const cat = searchParams.get("cat");

  const data = await getHotspots(force);

  if (meta) {
    return NextResponse.json({
      updatedAt: data.updatedAt,
      sources: data.sources,
      items: [],
    });
  }

  // 时间轴：按日期分组，支持类目过滤 + 每日上限
  let days: Record<string, HotspotTitle[]> = data.days;
  if (cat && cat !== "全部") {
    const filtered: Record<string, HotspotTitle[]> = {};
    for (const [k, v] of Object.entries(days)) {
      const arr = v.filter((i) => i.category === (cat as HotspotCat));
      if (arr.length) filtered[k] = arr;
    }
    days = filtered;
  }
  const capped: Record<string, HotspotTitle[]> = {};
  for (const [k, v] of Object.entries(days)) capped[k] = v.slice(0, 60);

  return NextResponse.json({
    updatedAt: data.updatedAt,
    sources: data.sources,
    days: capped,
    items: data.items,
  });
}
