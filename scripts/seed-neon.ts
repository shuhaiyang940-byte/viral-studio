/**
 * 本地直连 Neon 灌种子数据（与 /api/seed 同一逻辑，供被墙环境下离线执行）。
 *
 * 用法：
 *   DATABASE_URL="postgresql://..." npx tsx scripts/seed-neon.ts
 *
 * 幂等：ON CONFLICT DO NOTHING，重复执行安全。
 */
import { ensureSchema, getSql, hasDatabase } from "../lib/db";
import { LIBRARY } from "../lib/mock-data";
import { BENCHMARKS } from "../lib/benchmarks";

async function main() {
  if (!hasDatabase()) throw new Error("DATABASE_URL 未配置");

  await ensureSchema();
  const sql = getSql();

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

  const [{ c: cases }] = (await sql`SELECT count(*)::int AS c FROM cases`) as {
    c: number;
  }[];
  const [{ c: benchmarks }] = (await sql`SELECT count(*)::int AS c FROM benchmarks`) as {
    c: number;
  }[];

  console.log(JSON.stringify({ ok: true, cases, benchmarks }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("seed 失败:", e?.message || e);
    process.exit(1);
  });
