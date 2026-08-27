// Phase 16.11 真实浏览器测试：注册/登录 → 上传真实视频 → 分析 → 采集证据。
import { chromium } from "playwright";
import fs from "node:fs";

const SITE = "http://localhost:3201";
const OUT = "PHASE-16.11-CASES";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(`${OUT}/screenshots`, { recursive: true });
fs.mkdirSync(`${OUT}/video`, { recursive: true });

const errs = [];
const log = [];
const rec = (o) => { log.push(o); console.log(JSON.stringify(o)); };

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errs.push("console:" + String(m.text()).slice(0, 160)); });
page.on("pageerror", (e) => errs.push("pageerror:" + String(e).slice(0, 160)));

const shot = (n) => page.screenshot({ path: `${OUT}/screenshots/${n}.png`, fullPage: false }).catch(() => {});

// 1) 首页
await page.goto(SITE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await shot("01-home");
rec({ step: "home", url: page.url(), title: await page.title(), errCount: errs.length });

// 2) 登录（demo 账号，dev 预置；失败则记录）
await page.goto(SITE + "/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await shot("02-login");
let logged = false;
try {
  await page.fill('input[type="email"], input[placeholder*="邮箱"], input[name="email"]', "demo@viral.studio");
  await page.fill('input[type="password"]', "123456");
  await page.click('button[type="submit"], button:has-text("登录")');
  await page.waitForTimeout(2500);
  logged = await page.evaluate(() => !!(window.session) || /我在的|退出|工作台|history/i.test(document.body.innerText));
  rec({ step: "login", logged, url: page.url() });
} catch (e) {
  rec({ step: "login", error: String(e).slice(0, 120) });
}
await shot("03-after-login");

// 3) 上传真实视频
await page.goto(SITE + "/analyze", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await shot("04-analyze");
// 跳过 onboarding 墙（新用户可直接开始）
try {
  const skip = page.locator('button:has-text("先跳过")');
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(800); await shot("04b-skipped"); rec({ step: "skip-onboarding", clicked: true }); }
} catch (e) { rec({ step: "skip-onboarding", error: String(e).slice(0, 120) }); }
let upload = false;
try {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles("/tmp/bbb10.mp4");
  upload = await fileInput.isEnabled();
  rec({ step: "upload", fileSet: upload });
  // 选择参考类型（若无则跳过）
  const sel = page.locator("select").first();
  if (await sel.count()) { await sel.selectOption({ index: 1 }).catch(() => {}); }
  await shot("05-uploaded");
} catch (e) {
  rec({ step: "upload", error: String(e).slice(0, 120) });
}

// 4) 触发分析
try {
  await page.click('button:has-text("开始"), button:has-text("分析")');
  await page.waitForTimeout(4000);
  await shot("06-analysis-start");
  // 等待跳转 /report 或结果
  await page.waitForURL(/\/(report|analyze)/, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot("07-result");
  await page.waitForURL(/report/, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot("08-report");
  const bodyText = await page.locator("body").innerText().catch(() => "");
  rec({
    step: "analyze-result", url: page.url(),
    hasLoginGate: /登录|注册|登录后可看|解锁/.test(bodyText),
    hasReport: /拆解完成|评分|爆款/.test(bodyText),
    snippet: bodyText.replace(/\s+/g, " ").slice(0, 240),
  });
} catch (e) {
  rec({ step: "analyze", error: String(e).slice(0, 160) });
  await shot("08-error");
}

await browser.close();
fs.writeFileSync(`${OUT}/RUN.json`, JSON.stringify({ log, errors: errs }, null, 2));
console.log("DONE errors=" + errs.length);
