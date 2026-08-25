// 创作资产服务层（正式数据源，Postgres assets 表）。
// localStorage 仅作前端缓存；这里才是 source of truth。
//
// 仅服务端引用（/api/workspace /api/history /api/analyze 等），切勿在 'use client' 中 import。

import { q, hasDatabase } from "./db";

export type AssetType = "analysis" | "storyboard" | "edit_plan" | "replica" | "copywriting" | "director";

export interface AssetRecord {
  id: string;
  userId: string;
  type: AssetType;
  assetId: string;
  title: string;
  status: "completed" | "processing" | "failed" | "deleted";
  createdAt: string;
  updatedAt: string;
  payload: unknown;
}

function rowToAsset(r: any): AssetRecord {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    assetId: r.asset_id,
    title: r.title,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    payload: r.payload,
  };
}

/** 保存 / 更新一条创作资产（幂等：同 userId+type+assetId 则更新） */
export async function saveAsset(input: {
  userId: string;
  type: AssetType;
  assetId: string;
  title?: string;
  status?: "completed" | "processing" | "failed" | "deleted";
  payload?: unknown;
}): Promise<void> {
  if (!hasDatabase()) return;
  const id = input.assetId; // 复用 assetId 作为行 id，保持稳定可关联
  await q(
    `INSERT INTO assets (id, user_id, type, asset_id, title, status, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, type, asset_id) DO UPDATE SET
       title = EXCLUDED.title, status = EXCLUDED.status, payload = EXCLUDED.payload, updated_at = now()`,
    [id, input.userId, input.type, input.assetId, input.title ?? "", input.status ?? "completed", JSON.stringify(input.payload ?? {})]
  );
}

/** 当前用户的资产列表（分页 + 按更新时间倒序；不暴露其他用户） */
export async function listAssets(opts: {
  userId: string;
  type?: AssetType;
  limit?: number;
  cursor?: string; // 上一页最后一条的 updatedAt（ISO），用于游标分页
}): Promise<{ items: AssetRecord[]; nextCursor: string | null }> {
  if (!hasDatabase()) return { items: [], nextCursor: null };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const params: unknown[] = [opts.userId];
  let where = "user_id = $1";
  if (opts.type) {
    params.push(opts.type);
    where += ` AND type = $${params.length}`;
  }
  if (opts.cursor) {
    params.push(opts.cursor);
    where += ` AND updated_at < $${params.length}`;
  }
  params.push(limit);
  const rows = await q(
    `SELECT id, user_id, type, asset_id, title, status, payload, created_at, updated_at
     FROM assets WHERE ${where} ORDER BY updated_at DESC LIMIT $${params.length}`,
    params
  );
  const items = rows.map(rowToAsset);
  const nextCursor = items.length === limit ? items[items.length - 1].updatedAt : null;
  return { items, nextCursor };
}

/** 获取属于当前用户的单条资产（带 userId 校验，防 IDOR） */
export async function getAsset(userId: string, assetId: string): Promise<AssetRecord | null> {
  if (!hasDatabase()) return null;
  const rows = await q(
    `SELECT id, user_id, type, asset_id, title, status, payload, created_at, updated_at
     FROM assets WHERE asset_id = $1 AND user_id = $2 LIMIT 1`,
    [assetId, userId]
  );
  return rows.length ? rowToAsset(rows[0]) : null;
}

/** 删除属于当前用户的资产（仅能删自己的，防 IDOR） */
export async function deleteAsset(userId: string, assetId: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  const rows = await q(
    `DELETE FROM assets WHERE asset_id = $1 AND user_id = $2 RETURNING asset_id`,
    [assetId, userId]
  );
  return rows.length > 0;
}
