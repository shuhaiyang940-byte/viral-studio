import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { guardAiRequest } from "@/lib/ai-guard";
import { kvGet, kvSet } from "@/lib/kv";

const execFileP = promisify(execFile);

export const dynamic = "force-dynamic";

const ROOT = process.cwd(); // viral-studio 站点根
const PLAN_PATH = path.resolve(ROOT, "remotion", "edit_plan.json");
const REMOTION_DIR = path.resolve(ROOT, "remotion");
const OUT_DIR = path.resolve(ROOT, "public", "render");
const OUT_FILE = path.join(OUT_DIR, "video.mp4");

// 渲染层：Remotion 消费编辑计划 → MP4
// 说明：该步骤需要本机已安装 Node + Chromium（及 remotion/ 目录下的依赖）。
// 线上托管环境（Vercel / Netlify 等 Serverless）通常无法运行无头 Chromium，
// 因此真实出片请在本地执行：先 cd remotion && npm install，再从网站触发渲染。
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "render");
  if (!g.ok) return g.res;
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // 若前端传来了编辑后的计划，先写回（简易剪映改完即渲染）
    const body = await req.json().catch(() => null);
    if (body && body.plan && body.plan.meta && Array.isArray(body.plan.clips)) {
      await kvSet("edit_plan", JSON.stringify(body.plan, null, 2));
      fs.writeFileSync(PLAN_PATH, JSON.stringify(body.plan, null, 2), "utf-8");
    } else {
      // 未随请求带计划：从 KV 恢复（Serverless 下 plan 接口存的是 KV）
      const raw = await kvGet("edit_plan");
      if (raw) {
        fs.mkdirSync(path.dirname(PLAN_PATH), { recursive: true });
        fs.writeFileSync(PLAN_PATH, raw, "utf-8");
      }
    }

    await execFileP(
      "npx",
      ["remotion", "render", "BeatSync", OUT_FILE, "--no-open"],
      { cwd: REMOTION_DIR, maxBuffer: 1024 * 1024 * 1024 }
    );

    return Response.json({ url: "/render/video.mp4" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      {
        error: msg,
        hint: "渲染需要本机已安装 Node + Chromium。请先在项目内执行：cd remotion && npm install，并确保本机有可用的 Chromium（Remotion 会自动下载 headless Chromium）。线上托管环境无法出片，这是环境与资质限制，不是功能缺失。",
      },
      { status: 500 }
    );
  }
}
