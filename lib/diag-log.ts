import { q, hasDatabase, getSql } from "@/lib/db";

/**
 * 账号诊断上传事件日志：记录前端上传/握手/分析每一步，用于排查「卡 0%」这类故障
 * 以及回看历史动作。生产走 Neon，本地未配库时降级为 console。
 */

export interface DiagLogEntry {
  sessionId?: string;
  fileName?: string;
  fileSize?: number;
  step: string;
  detail?: string;
  ok?: boolean;
}

let _diagSchemaReady: Promise<void> | null = null;

function ensureDiagLogSchema(): Promise<void> {
  if (!hasDatabase()) return Promise.resolve();
  if (!_diagSchemaReady) {
    _diagSchemaReady = (async () => {
      const sql = getSql();
      // Neon HTTP 单次请求只允许一条语句，逐条执行
      await sql.query(
        `CREATE TABLE IF NOT EXISTS diagnosis_upload_logs (
          id BIGSERIAL PRIMARY KEY,
          session_id TEXT NOT NULL DEFAULT '',
          file_name TEXT NOT NULL DEFAULT '',
          file_size INTEGER NOT NULL DEFAULT 0,
          step TEXT NOT NULL,
          detail TEXT NOT NULL DEFAULT '',
          ok BOOLEAN,
          user_agent TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`
      );
      await sql.query(
        `CREATE INDEX IF NOT EXISTS idx_diag_log_session ON diagnosis_upload_logs(session_id, created_at DESC)`
      );
    })().catch((e) => {
      _diagSchemaReady = null;
      throw e;
    });
  }
  return _diagSchemaReady;
}

/** 写一条诊断日志。绝不阻塞主流程：任何失败都吞掉并 console 兜底。 */
export async function writeDiagLog(entry: DiagLogEntry): Promise<void> {
  const ua =
    typeof navigator !== "undefined"
      ? navigator.userAgent.slice(0, 300)
      : "";
  if (!hasDatabase()) {
    console.log("[diag-log]", JSON.stringify({ ...entry, ua }));
    return;
  }
  try {
    await ensureDiagLogSchema();
    await q(
      `INSERT INTO diagnosis_upload_logs
        (session_id, file_name, file_size, step, detail, ok, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.sessionId || "",
        entry.fileName || "",
        entry.fileSize || 0,
        entry.step,
        entry.detail || "",
        typeof entry.ok === "boolean" ? entry.ok : null,
        ua,
      ]
    );
  } catch (e) {
    console.error("[diag-log] 写入失败:", e);
  }
}

export interface DiagLogRow {
  id: number;
  session_id: string;
  file_name: string;
  file_size: number;
  step: string;
  detail: string;
  ok: boolean | null;
  user_agent: string;
  created_at: string;
}

/** 读取诊断日志（按 session 过滤，倒序）。未配库时返回空数组。 */
export async function readDiagLogs(limit = 100, sessionId?: string): Promise<DiagLogRow[]> {
  if (!hasDatabase()) return [];
  try {
    await ensureDiagLogSchema();
    if (sessionId) {
      return await q<DiagLogRow>(
        `SELECT id, session_id, file_name, file_size, step, detail, ok, user_agent, created_at
         FROM diagnosis_upload_logs
         WHERE session_id = $1
         ORDER BY id DESC
         LIMIT $2`,
        [sessionId, limit]
      );
    }
    return await q<DiagLogRow>(
      `SELECT id, session_id, file_name, file_size, step, detail, ok, user_agent, created_at
       FROM diagnosis_upload_logs
       ORDER BY id DESC
       LIMIT $1`,
      [limit]
    );
  } catch (e) {
    console.error("[diag-log] 读取失败:", e);
    return [];
  }
}
