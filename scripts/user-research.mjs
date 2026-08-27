#!/usr/bin/env node
// PHASE 16.8：AI 真人产品体验员 + 真实互联网视频研究员骨架。
//
// 诚实边界（Phase 16.8 纪律）：
//   - 绝不伪造视频/浏览器/浏览/结果/评分。
//   - 找不到浏览器 / 站点不可达 / 无真实视频源 → 明确 BLOCKER / SOURCE_UNAVAILABLE / NOT_VERIFIED。
//   - 本骨架先把「浏览器 + 站点可达 + 视频源」三个前置验证做掉，缺任一就如实报告，不假装跑完。
//
// 运行：
//   SITE_URL=http://localhost:3100 npx tsx scripts/user-research.mjs --duration 30m --persona knowledge --platform douyin
//   （真实长时间运行需：真实浏览器 Chromium、公开可访问站点、公开可获取的真实视频、ASR 可用）

import fs from "node:fs";

const args = process.argv.slice(2);
const get = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] ?? d : d);
const DURATION = get("duration", "3h");
const PERSONA = get("persona", "knowledge");
const PLATFORM = get("platform", "douyin");
const SITE_URL = process.env.SITE_URL || "http://localhost:3100";

const out = {
  summary: { duration: DURATION, persona: PERSONA, platform: PLATFORM, site: SITE_URL, status: "NOT_RUN" },
  blockers: [],
  samples: [],
  findings: [],
  verdict: null,
};

async function launchBrowser() {
  let pw;
  try {
    pw = await import("playwright");
  } catch (e) {
    out.blockers.push({ code: "PLAYWRIGHT_NOT_AVAILABLE", note: "未安装 playwright（devDep + npx playwright install chromium 后可用）" });
    return null;
  }
  try {
    const browser = await pw.chromium.launch({ headless: true });
    return { pw, browser };
  } catch (e) {
    out.blockers.push({ code: "BROWSER_NOT_RUNNABLE", note: `Chromium 启动失败（缺系统依赖/无浏览器二进制）：${String(e).slice(0, 160)}` });
    return null;
  }
}

async function siteReachable(page) {
  try {
    const r = await page.goto(SITE_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (!r || r.status() >= 400) {
      out.blockers.push({ code: "SITE_UNREACHABLE", note: `站点 ${SITE_URL} 返回 HTTP ${r?.status?.() ?? "无响应"}` });
      return null;
    }
    const title = await page.title().catch(() => "");
    out.summary.siteTitle = title;
    return title;
  } catch (e) {
    out.blockers.push({ code: "SITE_UNREACHABLE", note: `无法访问 ${SITE_URL}：${String(e).slice(0, 160)}` });
    return null;
  }
}

async function main() {
  console.log(`user-research: duration=${DURATION} persona=${PERSONA} platform=${PLATFORM} site=${SITE_URL}`);
  const b = await launchBrowser();
  if (!b) { out.summary.status = "BLOCKED"; console.log(JSON.stringify(out, null, 2)); return; }
  const ctx = await b.browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const title = await siteReachable(page);
  if (!title) {
    await b.browser.close();
    out.summary.status = "BLOCKED";
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  console.log(`[browser] 站点可达：${title}`);

  // 前置验证：真实视频源 —— 本环境无法合法/稳定获取抖音/B站/小红书视频文件。
  out.blockers.push({
    code: "REAL_VIDEO_SOURCE_NOT_AVAILABLE",
    note: "按要求不得绕过登录/反爬/付费/地区限制；本环境无可合法获取的真实视频文件，且 ASR(AI_ASR) 未启用 → 无法验证音频理解。",
  });
  out.blockers.push({
    code: "AUDIO_UNAVAILABLE",
    note: "部署环境未设 AI_ASR=1 → transcribeWithQwenAudio 返回 undefined，无语音转写（P0：视频音频理解链路不完整）。",
  });

  // 截图证据（截图失败可当作基础设施问题修复，不掩盖业务结论）
  const shot = "user-research-home.png";
  try {
    await page.screenshot({ path: shot, fullPage: true });
    out.summary.screenshot = shot;
  } catch (e) {
    out.blockers.push({ code: "SCREENSHOT_FAILED", note: String(e).slice(0, 120) });
  }

  await b.browser.close();
  out.summary.status = "PARTIAL";
  out.verdict = "BLOCKED_NOT_VERIFIED";
  fs.writeFileSync(process.env.REPORT_JSON || "USER-RESEARCH-REPORT.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
