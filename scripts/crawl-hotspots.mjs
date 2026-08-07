// 热点定时爬取脚本（零依赖，纯 Node）
// 作用：定时触发 /api/hotspots?force=1，由服务端拉取各平台热榜、去重归一、写 JSON 缓存。
// 这样把「爬虫逻辑」留在 Next 服务内（共享 TS 代码），脚本只负责按时敲门，体积小、好维护。
//
// 用法：
//   node scripts/crawl-hotspots.mjs            # 默认敲 http://localhost:3100
//   APP_URL=https://你的域名 node scripts/crawl-hotspots.mjs
//
// 放入 crontab（每 8 分钟一次，落日志）：
//   */8 * * * * /usr/bin/node /path/to/scripts/crawl-hotspots.mjs >> /var/log/hotspots.log 2>&1

const APP_URL = process.env.APP_URL || "http://localhost:3100";
const url = `${APP_URL}/api/hotspots?force=1`;

const ts = new Date().toISOString();
try {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  const r = await fetch(url, { signal: ctrl.signal });
  clearTimeout(t);
  const j = await r.json();
  const ok = Object.entries(j.sources || {})
    .filter(([, v]) => v === "ok")
    .map(([k]) => k);
  console.log(`[${ts}] OK HTTP ${r.status} | 热点 ${j.items?.length ?? 0} 条 | 在线源: ${ok.join(",") || "无"} | 更新 ${j.updatedAt}`);
} catch (e) {
  console.log(`[${ts}] FAIL 无法访问 ${url} -> ${e.name}: ${e.message}`);
  process.exit(1);
}
