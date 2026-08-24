import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { guardAiRequest } from "@/lib/ai-guard";

export const dynamic = "force-dynamic";

// 编辑计划存 KV（Serverless 兼容，多实例共享）；本地渲染时由 render 接口落到文件
const K_PLAN = "edit_plan";

export async function GET() {
  const raw = await kvGet(K_PLAN);
  if (!raw) {
    return NextResponse.json({ error: "暂无编辑计划" }, { status: 404 });
  }
  try {
    return NextResponse.json(JSON.parse(raw));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "数据损坏" }, { status: 500 });
  }
}

// 简易剪映：保存编辑计划（KV 写入，多实例共享）
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "plan");
  if (!g.ok) return g.res;
  try {
    const plan = await req.json();
    if (!plan || !plan.meta || !Array.isArray(plan.clips)) {
      return NextResponse.json({ error: "无效的编辑计划" }, { status: 400 });
    }
    await kvSet(K_PLAN, JSON.stringify(plan));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "保存失败" }, { status: 500 });
  }
}
