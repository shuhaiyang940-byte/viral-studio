/* Phase 16.7：真实用户体验 + 视频拆解真实性审计（确定性，不烧 AI，不用假视频）。
 * 运行：npx tsx scripts/phase167-test.ts
 */
import {
  resolveCreationTopic, contentIntentOf, parseDurationSec, selectAnalyzeEndpoint,
  transcriptCoverage, analysisCompleteness,
} from "@/lib/creation-input";
import { hasDatabase } from "@/lib/db";

let pass = 0, fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  [PASS] ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label}`); }
}

console.log(`\n=== Phase 16.7 用户路径 + 真实性审计 ===`);

// 1. 非产品内容：无产品也能创作（“我的产品”解耦为可选）
console.log("1. 非产品输入模型");
ok(resolveCreationTopic({ topic: "如何高效学习" }) === "如何高效学习", "知识类：只用主题即可");
ok(resolveCreationTopic({ topic: "", product: "" }) === "", "空输入 → 空（不伪造主题）");
ok(resolveCreationTopic({ product: "手工辣酱" }) === "手工辣酱", "商业：产品作为主题兜底");
ok(contentIntentOf({ topic: "如何高效学习", goal: "涨粉" }) === "knowledge", "知识类意图识别");
ok(contentIntentOf({ product: "手工辣酱", goal: "带货" }) === "commerce", "商业意图识别");
ok(contentIntentOf({ content_type: "知识" }) === "knowledge", "按内容类型识别知识意图");
ok(["knowledge", "commerce", "brand", "personal_ip", "story", "review", "opinion", "other"].includes(contentIntentOf({ topic: "一杯好咖啡" })) === true, "非产品意图可识别");

// 2. 目标时长继承（3分钟 → 180s）
console.log("2. target_duration");
ok(parseDurationSec("3分钟") === 180, "『3分钟』→ 180s");
ok(parseDurationSec("00:03:00") === 180, "『00:03:00』→ 180s");
ok(parseDurationSec("180") === 180, "『180』→ 180s");
ok(parseDurationSec("") === null && parseDurationSec(undefined) === null, "空时长 → null");
ok(parseDurationSec("1分钟30秒") === 90, "『1分钟30秒』→ 90s");

// 3. 视频分析端点：URL 必须走真实读视频端点
console.log("3. 分析端点");
ok(selectAnalyzeEndpoint("url") === "/api/analyze/url", "URL 模式 → /api/analyze/url（真正读视频）");
ok(selectAnalyzeEndpoint("upload") === "/api/analyze", "非 URL 模式 → 通用端点");

// 4. Transcript 覆盖率 / 完整性（诚实性）
console.log("4. transcript 覆盖率 / 完整性");
ok(transcriptCoverage(180, 176.4) === 98, "覆盖 176.4/180 → 98%");
ok(transcriptCoverage(180, null) === null, "无转写 → null（不能伪装覆盖率）");
ok(analysisCompleteness({ vision: true, transcript: false }) === "partial", "仅画面 → partial");
ok(analysisCompleteness({ vision: false, transcript: false }) === "none", "无画面无转写 → none");
ok(analysisCompleteness({ vision: true, transcript: true }) === "full", "有转写 → full");

// 5. 代码路径：URL 前端不再走“纯标题推断”的 /api/analyze
import * as fs from "node:fs";
const analyzeSrc = fs.readFileSync(new URL("../app/analyze/page.tsx", import.meta.url), "utf8");
ok(/selectAnalyzeEndpoint\(mode\)/.test(analyzeSrc), "analyze 页使用 selectAnalyzeEndpoint（URL→/api/analyze/url）");
ok(!/await fetch\("\/api\/analyze",\s*\{[\s\S]*?source: url/.test(analyzeSrc), "URL 不再用 /api/analyze 纯标题推断");
const reengineerSrc = fs.readFileSync(new URL("../app/reengineer/page.tsx", import.meta.url), "utf8");
ok(/form\.topic/.test(reengineerSrc) && /「主题」即可/.test(reengineerSrc), "reengineer 提供『主题』非产品输入");
const flowSrc = fs.readFileSync(new URL("../app/api/flow/start/route.ts", import.meta.url), "utf8");
ok(/parseDurationSec/.test(flowSrc), "flow/start 继承原视频时长");

// 6. 原流程兼容：无 topic 时解析安全（空输入不产生假主题）
console.log("6. 兼容性");
ok(resolveCreationTopic({}) === "", "缺 topic/product → 空（交由上层提示，不硬造）");
ok(parseDurationSec(null) === null, "null 时长安全");

console.log(`\n=== 结果：PASS ${pass} / FAIL ${fail} ===`);
process.exit(fail === 0 ? 0 : 1);
