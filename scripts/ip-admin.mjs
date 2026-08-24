#!/usr/bin/env node
/**
 * IP 封禁管理 CLI（对接 /api/admin/ip）
 *
 * 用法：
 *   node scripts/ip-admin.mjs list
 *   node scripts/ip-admin.mjs ban 1.2.3.4 [hours] ["原因"]
 *   node scripts/ip-admin.mjs unban 1.2.3.4
 *
 * 环境变量：
 *   ADMIN_TOKEN  管理口令（必填）
 *   BASE_URL     站点地址（默认 http://localhost:3000）
 */

const [cmd, ip, hours, reason] = process.argv.slice(2);
const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error("请先设置 ADMIN_TOKEN 环境变量");
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[${res.status}]`, data.error || res.statusText);
    process.exit(1);
  }
  return data;
}

if (cmd === "list") {
  const data = await api("GET", "/api/admin/ip");
  console.log(`当前封禁 ${data.count} 个 IP：`);
  for (const it of data.items) {
    console.log(
      `- ${it.ip}  到期：${it.until ? new Date(it.until).toLocaleString("zh-CN") : "永久"}  原因：${it.reason}`
    );
  }
} else if (cmd === "ban") {
  if (!ip) {
    console.error("用法：node scripts/ip-admin.mjs ban <ip> [hours] [原因]");
    process.exit(1);
  }
  const data = await api("POST", "/api/admin/ip", {
    ip,
    hours: hours || "24",
    reason: reason || "",
  });
  console.log(`已封禁 ${data.ip}，时长 ${data.hours} 小时`);
} else if (cmd === "unban") {
  if (!ip) {
    console.error("用法：node scripts/ip-admin.mjs unban <ip>");
    process.exit(1);
  }
  const data = await api("DELETE", "/api/admin/ip", { ip });
  console.log(`已解封 ${data.ip}`);
} else {
  console.error("用法：node scripts/ip-admin.mjs <list|ban|unban> [...]");
  process.exit(1);
}
