import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureSchema, hasDatabase } from "@/lib/db";
import { LIBRARY } from "@/lib/mock-data";
import { BENCHMARKS } from "@/lib/benchmarks";

export const dynamic = "force-dynamic";

/**
 * 一次性种子：把案例库 / 对标账号种子数据写入数据库（幂等，重复执行安全）。
 *
 * 上线后执行一次即可：
 *   curl "https://你的域名/api/seed?token=<SEED_TOKEN>"
 *
 * 必须带 token（环境变量 SEED_TOKEN），否则任何人都能反复触发几十条写入。
 */
export async function GET(req: NextRequest) {
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "SEED_TOKEN 未配置，出于安全考虑拒绝执行" },
      { status: 503 }
    );
  }
  const token = req.nextUrl.searchParams.get("token") || "";
  if (token !== expected) {
    return NextResponse.json({ error: "token 无效" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "DATABASE_URL 未配置" }, { status: 503 });
  }

  try {
    await ensureSchema();
    const sql = getSql();

    // 一次 HTTP 事务提交所有 INSERT，比循环 await 少几十次往返
    const caseStmts = LIBRARY.map(
      (it) => sql`
        INSERT INTO cases (id, title, category, cover, views, score, summary, tags, is_seed, created_by)
        VALUES (${it.id}, ${it.title}, ${it.category}, ${it.cover}, ${it.views}, ${it.score}, ${
        it.summary
      }, ${JSON.stringify(it.tags)}, true, NULL)
        ON CONFLICT (id) DO NOTHING`
    );

    const benchStmts = BENCHMARKS.map(
      (b) => sql`
        INSERT INTO benchmarks (id, name, handle, platform, idea_type, styles, effects, face, product_type, followers, engagement_rate, reason, sample_title, is_seed, created_by)
        VALUES (${b.id}, ${b.name}, ${b.handle}, ${b.platform}, ${b.ideaType}, ${JSON.stringify(
        b.styles
      )}, ${JSON.stringify(b.effects)}, ${b.face}, ${b.productType ?? null}, ${b.followers}, ${
        b.engagementRate
      }, ${b.reason}, ${b.sampleTitle}, true, NULL)
        ON CONFLICT (id) DO NOTHING`
    );

    await sql.transaction([...caseStmts, ...benchStmts]);

    const [{ c: cases }] = (await sql`SELECT count(*)::int AS c FROM cases`) as { c: number }[];
    const [{ c: benchmarks }] = (await sql`SELECT count(*)::int AS c FROM benchmarks`) as {
      c: number;
    }[];

    return NextResponse.json({ ok: true, cases, benchmarks });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "seed 失败" }, { status: 500 });
  }
}
