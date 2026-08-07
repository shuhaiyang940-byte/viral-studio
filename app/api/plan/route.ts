import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// 编辑计划（结构化时间线）存放于 remotion/ 引擎目录，渲染层直接读取同一份 JSON
const PLAN_PATH = path.resolve(process.cwd(), "remotion", "edit_plan.json");

export async function GET() {
  try {
    const data = JSON.parse(fs.readFileSync(PLAN_PATH, "utf-8"));
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

// 简易剪映：用户在前端改完 edit_plan.json 后写回，供重新渲染
export async function POST(req: Request) {
  try {
    const plan = await req.json();
    if (!plan || !plan.meta || !Array.isArray(plan.clips)) {
      return Response.json({ error: "无效的编辑计划" }, { status: 400 });
    }
    fs.writeFileSync(PLAN_PATH, JSON.stringify(plan, null, 2), "utf-8");
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
