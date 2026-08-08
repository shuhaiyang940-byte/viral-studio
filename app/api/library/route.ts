import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureSchema, hasDatabase, q as dbQuery } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { LIBRARY } from "@/lib/mock-data";
import type { LibraryItem } from "@/lib/types";

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

function toCaseShape(it: LibraryItem): CaseOut {
  return {
    id: it.id,
    title: it.title,
    category: it.category,
    cover: it.cover,
    views: it.views,
    score: it.score,
    summary: it.summary,
    tags: it.tags,
    isSeed: true,
    saved: false,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") || "全部";
  const q = (sp.get("q") || "").trim();
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const pageSize = 24;
  const offset = (page - 1) * pageSize;

  // 无数据库时优雅降级：直接返回代码里的种子数据，保证预览不空
  if (!hasDatabase()) {
    let items = LIBRARY.map(toCaseShape);
    if (category !== "全部") items = items.filter((i) => i.category === category);
    if (q) {
      items = items.filter(
        (i) =>
          i.title.includes(q) ||
          i.summary.includes(q) ||
          i.tags.some((t) => t.includes(q))
      );
    }
    return NextResponse.json({ items, total: items.length, db: false });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    const where: string[] = [];
    const params: unknown[] = [];
    if (category !== "全部") {
      where.push(`category = $${params.length + 1}`);
      params.push(category);
    }
    if (q) {
      where.push(
        `(title ILIKE $${params.length + 1} OR summary ILIKE $${params.length + 1} OR tags::text ILIKE $${params.length + 1})`
      );
      params.push(`%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRows = await dbQuery<{ c: number }>(
      `SELECT count(*)::int AS c FROM cases ${whereSql}`,
      params
    );
    const total = countRows[0]?.c ?? 0;

    const rows = await dbQuery(
      `SELECT * FROM cases ${whereSql} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    const user = await getCurrentUser();
    const savedIds = new Set<string>();
    if (user) {
      const srows = await sql`SELECT case_id FROM case_saves WHERE user_id = ${user.id}`;
      (srows as Record<string, string>[]).forEach((r) => savedIds.add(r.case_id));
    }

    const items: CaseOut[] = (rows as Record<string, any>[]).map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      cover: r.cover,
      views: r.views,
      score: r.score,
      summary: r.summary,
      tags: (r.tags as string[]) ?? [],
      isSeed: r.is_seed,
      saved: savedIds.has(r.id),
    }));

    return NextResponse.json({ items, total, db: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "查询失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: "数据库未配置" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const category = String(body.category ?? "全部");
  const summary = String(body.summary ?? "").trim();
  const cover = String(body.cover ?? "");
  const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
  const views = Number(body.views ?? 0) || 0;
  const score = Number(body.score ?? 0) || 0;

  if (!title) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });

  try {
    await ensureSchema();
    const sql = getSql();
    const id = randomUUID();
    const rows = await sql`
      INSERT INTO cases (id, title, category, cover, views, score, summary, tags, is_seed, created_by)
      VALUES (${id}, ${title}, ${category}, ${cover}, ${views}, ${score}, ${summary}, ${JSON.stringify(
        tags
      )}, false, ${user.id})
      RETURNING *`;
    const r = rows[0] as Record<string, any>;
    return NextResponse.json({
      item: {
        id: r.id,
        title: r.title,
        category: r.category,
        cover: r.cover,
        views: r.views,
        score: r.score,
        summary: r.summary,
        tags: (r.tags as string[]) ?? [],
        isSeed: r.is_seed,
        saved: false,
      } as CaseOut,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "提交失败" }, { status: 500 });
  }
}
