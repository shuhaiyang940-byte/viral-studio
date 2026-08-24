import { hasDatabase, q } from "./db";

/**
 * 通用 KV 存储：优先 Postgres（kv_store 表，Serverless 多实例共享），
 * 无数据库时回退进程内内存（开发自测用）。
 *
 * 用于热点缓存/历史/详情、编辑计划等原本依赖本地 JSON 文件的数据。
 * 消除 Vercel Serverless 只读文件系统的部署问题。
 */

const mem = new Map<string, string>();

export async function kvGet(key: string): Promise<string | null> {
  if (!hasDatabase()) return mem.get(key) ?? null;
  try {
    const rows = await q<{ value: unknown }>(
      `SELECT value FROM kv_store WHERE key = $1`,
      [key]
    );
    if (!rows.length) return mem.get(key) ?? null;
    const v = rows[0].value;
    // Neon 会把 jsonb 解析成对象；假 Neon / 文本驱动返回字符串
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch (e) {
    console.warn("[kv] 读取失败（回退内存）：", e);
    return mem.get(key) ?? null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  mem.set(key, value);
  if (!hasDatabase()) return;
  try {
    await q(
      `INSERT INTO kv_store (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value]
    );
  } catch (e) {
    console.warn("[kv] 写入失败（仅内存生效）：", e);
  }
}

export async function kvDel(key: string): Promise<void> {
  mem.delete(key);
  if (!hasDatabase()) return;
  try {
    await q(`DELETE FROM kv_store WHERE key = $1`, [key]);
  } catch (e) {
    console.warn("[kv] 删除失败（仅内存生效）：", e);
  }
}
