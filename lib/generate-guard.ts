// 生成类请求的 requestId 幂等锁（服务端）。
// 数据库原子表 gen_dedupe 保证：同一 requestId 并发下只有第一个进入 processing，
// 其余命中已有状态（processing → 409；done → 返回 assetId），从而 AI 只调用一次、额度只扣一次。

import { q, hasDatabase } from "./db";

export interface BeginResult {
  ok: boolean;
  status?: 409;
  error?: string;
  doneAssetId?: string;
}

export async function beginGenerate(
  requestId: string | undefined,
  userId: string | undefined
): Promise<BeginResult> {
  if (!requestId) return { ok: true };
  if (hasDatabase()) {
    try {
      const ins = await q(
        `INSERT INTO gen_dedupe (request_id, user_id, status) VALUES ($1, $2, 'processing')
         ON CONFLICT (request_id) DO NOTHING RETURNING request_id`,
        [requestId, userId ?? ""]
      );
      if (ins.length) return { ok: true };
      const rows = await q<{ status: string; asset_id: string | null }>(
        `SELECT status, asset_id FROM gen_dedupe WHERE request_id = $1`,
        [requestId]
      );
      const st = rows[0]?.status;
      if (st === "processing") return { ok: false, status: 409, error: "任务处理中，请勿重复提交" };
      if (st === "done" && rows[0]?.asset_id) return { ok: true, doneAssetId: rows[0].asset_id };
      return { ok: true };
    } catch (e) {
      console.warn("[generate-guard] db 幂等锁失败，按无锁处理：", e);
      return { ok: true };
    }
  }
  return { ok: true };
}

export async function markGenerateDone(
  requestId: string | undefined,
  userId: string | undefined,
  assetId: string
): Promise<void> {
  if (!requestId) return;
  if (hasDatabase()) {
    try {
      await q(
        `UPDATE gen_dedupe SET status = 'done', asset_id = $3 WHERE request_id = $1 AND user_id = $2`,
        [requestId, userId ?? "", assetId]
      );
    } catch {
      // 忽略
    }
  }
}

export async function markGenerateFailed(requestId: string | undefined): Promise<void> {
  if (!requestId) return;
  if (hasDatabase()) {
    try {
      await q(`DELETE FROM gen_dedupe WHERE request_id = $1`, [requestId]);
    } catch {
      // 忽略
    }
  }
}
