"use client";

export interface ClientQuota {
  limit: number | null;
  used: number;
  remaining: number | null;
  isPro: boolean;
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
