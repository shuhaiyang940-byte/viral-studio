import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureSchema, hasDatabase } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type CaseOut = {
  id: string;
  title: string;
  category: string;
  cover: string;
  views: number;
  score: number;
  summary: string;
  tags: string[];
  isSeed: boolean;
  saved: boolean;
};

function map(r: Record<string, any>): CaseOut {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    cover: r.cover,
    views: r.views,
    score: r.score,
    summary: r.summary,
    tags: (r.tags as string[]) ?? [],
    isSeed: r.is_seed,
    saved: true,
  };
}

/** 我收藏的案例 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ items: [] });
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT c.* FROM cases c JOIN case_saves s ON s.case_id = c.id
    WHERE s.user_id = ${user.id} ORDER BY s.created_at DESC`;
  return NextResponse.json({ items: (rows as Record<string, any>[]).map(map) });
}

/** 收藏 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const caseId = String(body.caseId ?? "");
  if (!caseId) return NextResponse.json({ error: "缺少 caseId" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ error: "数据库未配置" }, { status: 503 });
  await ensureSchema();
  const sql = getSql();
  await sql`INSERT INTO case_saves (user_id, case_id) VALUES (${user.id}, ${caseId}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ ok: true });
}

/** 取消收藏 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const caseId = req.nextUrl.searchParams.get("caseId") || "";
  if (!caseId) return NextResponse.json({ error: "缺少 caseId" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ error: "数据库未配置" }, { status: 503 });
  const sql = getSql();
  await sql`DELETE FROM case_saves WHERE user_id = ${user.id} AND case_id = ${caseId}`;
  return NextResponse.json({ ok: true });
}
