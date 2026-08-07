import { NextResponse } from "next/server";
import type { HistoryItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const SAMPLE_HISTORY: HistoryItem[] = [
  { id: "h-1", title: "我在北京胡同住了三十年，今天终于要搬走了", createdAt: "2026-03-18", score: 87, status: "done" },
  { id: "h-2", title: "10 块钱在菜市场能吃到什么？挑战全网最低预算", createdAt: "2026-03-15", score: 89, status: "done" },
  { id: "h-3", title: "普通人如何用 AI 每天省下 2 小时", createdAt: "2026-03-12", score: 88, status: "done" },
];

// Mock 历史记录接口（真实场景应基于数据库 + 当前登录用户）
export async function GET() {
  return NextResponse.json({ items: SAMPLE_HISTORY });
}
