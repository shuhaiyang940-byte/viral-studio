import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureSchema, hasDatabase } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { type BenchmarkAccount } from "@/lib/benchmarks";

export const dynamic = "force-dynamic";

function mapRow(r: Record<string, any>): BenchmarkAccount & { isSeed: boolean; tracked: boolean } {
  return {
    id: r.id,
    name: r.name,
    handle: r.handle,
    platform: r.platform,
    ideaType: r.idea_type,
    styles: (r.styles as string[]) ?? [],
    effects: (r.effects as string[]) ?? [],
    face: r.face,
    productType: r.product_type ?? undefined,
    followers: r.followers,
    engagementRate: r.engagement_rate,
    reason: r.reason,
    sampleTitle: r.sample_title,
    isSeed: r.is_seed,
    tracked: true,
  };
}

/** 我关注的对标账号 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ items: [] });
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT b.* FROM benchmarks b JOIN benchmark_tracks t ON t.benchmark_id = b.id
    WHERE t.user_id = ${user.id} ORDER BY b.followers DESC`;
  return NextResponse.json({
    items: (rows as Record<string, any>[]).map(mapRow),
  });
}

/** 关注 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const benchmarkId = String(body.benchmarkId ?? "");
  if (!benchmarkId) return NextResponse.json({ error: "缺少 benchmarkId" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ error: "数据库未配置" }, { status: 503 });
  await ensureSchema();
  const sql = getSql();
  await sql`INSERT INTO benchmark_tracks (user_id, benchmark_id) VALUES (${user.id}, ${benchmarkId}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ ok: true });
}

/** 取消关注 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const benchmarkId = req.nextUrl.searchParams.get("benchmarkId") || "";
  if (!benchmarkId) return NextResponse.json({ error: "缺少 benchmarkId" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ error: "数据库未配置" }, { status: 503 });
  const sql = getSql();
  await sql`DELETE FROM benchmark_tracks WHERE user_id = ${user.id} AND benchmark_id = ${benchmarkId}`;
  return NextResponse.json({ ok: true });
}
