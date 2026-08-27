// Phase 16.9 真实浏览器产品走查（LOCAL_TEST，不烧 AI）。
import { chromium } from "playwright";
import fs from "node:fs";

const SITE = process.env.SITE_URL || "http://localhost:3100";
fs.mkdirSync("PHASE-16.9-SAMPLES", { recursive: true });

const log = [];
function rec(o) { log.push(o); console.log(JSON.stringify(o)); }

const routes = [
  { path: "/", name: "首页", want: ["爆款", "分析", "创作", "诊断"] },
  { path: "/analyze", name: "视频分析", want: ["上传", "链接", "类型", "开始"] },
  { path: "/demo", name: "免费演示", want: [] },
  { path: "/reengineer", name: "创作/复刻", want: ["主题", "主题/创作方向", "产品", "一键"] },
  { path: "/pricing", name: "定价", want: ["免费", "会员", "元"] },
  { path: "/history", name: "历史", want: [] },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const consoleErrs = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(String(m.text()).slice(0, 200)); });
page.on("pageerror", (e) => consoleErrs.push("PAGEERROR " + String(e).slice(0, 200)));

for (const r of routes) {
  try {
    const resp = await page.goto(SITE + r.path, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(800);
    const title = await page.title();
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const shot = `PHASE-16.9-SAMPLES/${r.name}.png`;
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    const inputs = await page.locator("input, textarea, select").evaluateAll((els) =>
      els.map((e) => ({ tag: e.tagName, placeholder: e.getAttribute("placeholder") || "", label: e.getAttribute("aria-label") || "", required: e.required })).slice(0, 20)
    );
    rec({
      route: r.path, name: r.name, http: resp?.status() ?? "?",
      title, shot,
      textMatches: r.want.filter((w) => bodyText.includes(w)),
      hasLoginText: /登录|注册|登录后可看|完整.*(查看|解锁)/.test(bodyText),
      inputs,
      consoleErrors: consoleErrs.splice(0),
    });
  } catch (e) {
    rec({ route: r.path, name: r.name, error: String(e).slice(0, 160) });
  }
}

await browser.close();
fs.writeFileSync(fileName(process.argv[2] || "PHASE-16.9-REPORT.json"), JSON.stringify(log, null, 2));
function fileName(x) { return x.endsWith(".json") ? x : `PHASE-16.9-${x}.json`; }
console.log("\nDONE samples=" + fs.readdirSync("PHASE-16.9-SAMPLES").length);
