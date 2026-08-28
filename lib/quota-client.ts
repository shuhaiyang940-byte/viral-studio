"use client";

export interface ClientGenerationQuota {
  operation: string;
  limit: number;
  used: number;
  remaining: number;
}

export interface ClientQuota {
  limit: number | null;
  used: number;
  remaining: number | null;
  isPro: boolean;
  /** 生成类（脚本/复盘）额度，按 operation 分组 */
  generation: ClientGenerationQuota[];
  /** 配额重置时刻（ISO，前端按本地时区展示 = 我国次日 08:00） */
  resetAt: string;
}

/** 读取服务端配额（登录按账号、匿名按 IP；会员 limit=null 表示不限） */
export async function fetchQuota(): Promise<ClientQuota | null> {
  try {
    const res = await fetch("/api/quota", { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return d?.quota ?? null;
  } catch {
    return null;
  }
}
