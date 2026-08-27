// Phase 16.12：注册测试账号 → 登录 → 上传真实视频 → 分析 → 抓报告（真实浏览器，健壮字段识别）。
import { chromium } from "playwright";
import fs from "node:fs";

const SITE = process.env.SITE_URL || "http://localhost:3203";
const OUT = "PHASE-16.12-CASES/case-001";
fs.mkdirSync(`${OUT}/screenshots`, { recursive: true });
const log = [], errs = [], netErrs = [];
const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };
const shot = (n) => page.screenshot({ path: `${OUT}/screenshots/${n}.png` }).catch(() => {});

const email = `user${Date.now()}@viral.local`;
const password = "test123456";
const name = "小明测试";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errs.push("console:" + String(m.text()).slice(0, 140)); });
page.on("pageerror", (e) => errs.push("pageerror:" + String(e).slice(0, 140)));
page.on("response", (r) => { if (r.status() >= 400) netErrs.push(`${r.status()} ${r.url()}`); });
await page.goto(SITE + "/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600); await shot("01-login");

let registered = false;
try {
  const reg = page.locator('button:has-text("去注册"), a:has-text("去注册")').first();
  await reg.click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="如：小明"]').fill(name);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button:has-text("注册"), button[type="submit"]').last().click();
  await page.waitForTimeout(3000); await shot("02-registered");
  registered = await page.evaluate(() => /退出|我的|工作台|登录后/.test(document.body.innerText) && !/去注册/.test(document.body.innerText));
} catch (e) { rec({ step: "register", error: String(e).slice(0, 140) }); }
rec({ step: "register", registered, email, url: page.url() });

// 登录态下进入分析，跳过 onboarding，上传真实视频
await page.goto(SITE + "/analyze", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800); await shot("03-analyze");
try { const s = page.locator('button:has-text("先跳过")'); if (await s.count()) { await s.first().click(); await page.waitForTimeout(600); } } catch {}
await shot("04-analyze-skip");

let uploaded = false, refSelected = "";
try {
  await page.locator('input[type="file"]').setInputFiles("/tmp/vsa16/knowledge-60s.mp4");
  uploaded = true;
  // 识别 refType select：找一个其 option 含“类型/请选择/参考”的 select
  const selects = page.locator("select");
  const n = await selects.count();
  for (let i = 0; i < n; i++) {
    const first = (await selects.nth(i).locator("option").first().innerText().catch(() => "")) || "";
    if (/类型|请选择|参考/.test(first)) {
      const opts = await selects.nth(i).locator("option").allInnerTexts();
      const target = opts.find((o) => /知识|口播|科普/.test(o));
      if (target) { await selects.nth(i).selectOption({ label: target }); refSelected = target; }
      break;
    }
  }
} catch (e) { rec({ step: "upload", error: String(e).slice(0, 140) }); }
rec({ step: "upload", uploaded, refSelected });
await shot("05-uploaded");

try {
  await page.locator('button:has-text("开始分析")').click();
  await page.waitForTimeout(4000); await shot("06-analysis");
  await page.waitForURL(/report/, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2000); await shot("07-report");
  const body = await page.locator("body").innerText().catch(() => "");
  rec({ step: "result", url: page.url(), hasReport: /拆解完成|评分|爆款/.test(body), hasLoginGate: /登录|注册|解锁/.test(body), snippet: body.replace(/\s+/g, " ").slice(0, 400), consoleErrors: errs.length, netErrors: netErrs.slice(0, 5) });
} catch (e) { rec({ step: "analyze", error: String(e).slice(0, 140) }); await shot("08-error"); }

await browser.close();
fs.writeFileSync(`${OUT}/RUN.json`, JSON.stringify({ log, errors: errs, network: netErrs }, null, 2));
console.log("DONE uploaded=" + uploaded + " errs=" + errs.length);
