import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureSchema, hasDatabase, q as dbQuery } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { BENCHMARKS, type BenchmarkItem } from "@/lib/benchmarks";

export const dynamic = "force-dynamic";

type BenchOut = BenchmarkItem;

function mapRow(r: Record<string, any>): BenchOut {
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
    tracked: false,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const platform = sp.get("platform") || "全部";
  const ideaType = sp.get("ideaType") || "all";
  const face = sp.get("face") || "any";
  const productType = sp.get("productType") || "";
  const styles = (sp.get("styles") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const effects = (sp.get("effects") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const q = (sp.get("q") || "").trim();

  // 无数据库时优雅降级：用内存种子数据做同样的过滤，保证筛选行为一致
  if (!hasDatabase()) {
    let items: BenchOut[] = BENCHMARKS.map((b) => ({ ...b, isSeed: true, tracked: false }));
    if (platform !== "全部") items = items.filter((b) => b.platform === platform);
    if (ideaType !== "all") items = items.filter((b) => b.ideaType === ideaType);
    if (face === "face") items = items.filter((b) => b.face);
    else if (face === "noface") items = items.filter((b) => !b.face);
    if (productType) items = items.filter((b) => b.productType === productType);
    if (styles.length) items = items.filter((b) => styles.some((s) => b.styles.includes(s)));
    if (effects.length) items = items.filter((b) => effects.some((e) => b.effects.includes(e)));
    if (q) {
      items = items.filter(
        (b) => b.name.includes(q) || b.sampleTitle.includes(q) || b.reason.includes(q)
      );
    }
    items.sort((a, b) => b.followers - a.followers);
    return NextResponse.json({ items, total: items.length, db: false });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    const where: string[] = [];
    const params: unknown[] = [];
    if (platform !== "全部") {
      where.push(`platform = $${params.length + 1}`);
      params.push(platform);
    }
    if (ideaType !== "all") {
      where.push(`idea_type = $${params.length + 1}`);
      params.push(ideaType);
    }
    if (face === "face") where.push(`face = true`);
    else if (face === "noface") where.push(`face = false`);
    if (productType) {
      where.push(`product_type = $${params.length + 1}`);
      params.push(productType);
    }
    // 多个风格 / 效果按「任一命中」匹配（OR）
    //
    // 这里踩过两个坑，别改回去：
    // 1) 必须「先 push 参数、再用 params.length 当编号」。若在 map 里先读 length 再统一 push，
    //    所有占位符会算成同一个编号（$4 OR $4），Postgres 不报错，只是静默返回错的结果。
    // 2) 模式串两侧带引号（%"口语化"%）是为了精确匹配 jsonb 数组元素，
    //    否则搜「剪」会把「快剪」「混剪」全捞出来。
    const anyOfJsonArray = (col: string, values: string[]) => {
      const ors = values.map((v) => {
        params.push(`%"${v.replace(/"/g, "")}"%`);
        return `${col}::text ILIKE $${params.length}`;
      });
      return `(${ors.join(" OR ")})`;
    };
    if (styles.length) where.push(anyOfJsonArray("styles", styles));
    if (effects.length) where.push(anyOfJsonArray("effects", effects));
    if (q) {
      where.push(
        `(name ILIKE $${params.length + 1} OR sample_title ILIKE $${params.length + 1} OR reason ILIKE $${params.length + 1})`
      );
      params.push(`%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await dbQuery(
      `SELECT * FROM benchmarks ${whereSql} ORDER BY followers DESC`,
      params
    );

    const user = await getCurrentUser();
    const tracked = new Set<string>();
    if (user) {
      const t = await sql`SELECT benchmark_id FROM benchmark_tracks WHERE user_id = ${user.id}`;
      (t as Record<string, string>[]).forEach((r) => tracked.add(r.benchmark_id));
    }

    const items: BenchOut[] = rows.map((r) => {
      const m = mapRow(r);
      m.tracked = tracked.has(m.id);
      return m;
    });
    return NextResponse.json({ items, total: items.length, db: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "查询失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: "数据库未配置" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const platform = String(body.platform ?? "抖音");
  const ideaType = String(body.ideaType ?? "other");
  const reason = String(body.reason ?? "").trim();
  const sampleTitle = String(body.sampleTitle ?? "").trim();
  const styles = Array.isArray(body.styles) ? body.styles.map(String) : [];
  const effects = Array.isArray(body.effects) ? body.effects.map(String) : [];
  const face = Boolean(body.face);
  const productType = body.productType ? String(body.productType) : null;
  const followers = Number(body.followers ?? 0) || 0;
  const engagementRate = Number(body.engagementRate ?? 0) || 0;

  if (!name) return NextResponse.json({ error: "账号名称不能为空" }, { status: 400 });

  try {
    await ensureSchema();
    const sql = getSql();
    const id = randomUUID();
    const rows = await sql`
      INSERT INTO benchmarks (id, name, handle, platform, idea_type, styles, effects, face, product_type, followers, engagement_rate, reason, sample_title, is_seed, created_by)
      VALUES (${id}, ${name}, ${""}, ${platform}, ${ideaType}, ${JSON.stringify(styles)}, ${JSON.stringify(
        effects
      )}, ${face}, ${productType}, ${followers}, ${engagementRate}, ${reason}, ${sampleTitle}, false, ${user.id})
      RETURNING *`;
    const m = mapRow(rows[0] as Record<string, any>);
    return NextResponse.json({ item: m });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "提交失败" }, { status: 500 });
  }
}
