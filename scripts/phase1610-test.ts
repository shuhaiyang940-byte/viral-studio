/* Phase 16.10：视频理解链路 + 分析/复刻分离 专项测试（纯逻辑 + 代码路径，不烧 AI）。 */
import {
  planSegments, coverageStatus, buildUnderstanding, timelineFactBlock,
} from "@/lib/video-fact";
import { buildPrompt } from "@/lib/ai/mock";
import { resolveCreationTopic, parseDurationSec } from "@/lib/creation-input";
import fs from "node:fs";

let pass = 0, fail = 0;
function ok(c: boolean, label: string) { if (c) { pass++; console.log(`  [PASS] ${label}`); } else { fail++; console.log(`  [FAIL] ${label}`); } }

console.log(`\n=== Phase 16.10 视频理解 + 分离测试 ===`);

// 1. 自适应分段（长视频不塌缩成一段）
console.log("1. 分段计划（非固定 20s）");
ok(planSegments(30).length === 2, "30s → 2 段");
ok(planSegments(180).length >= 4, `180s → ${planSegments(180).length} 段（≥4）`);
ok(planSegments(300).length >= 5, `300s → ${planSegments(300).length} 段（≥5）`);
const seg180 = planSegments(180);
ok(seg180[0].start === 0 && seg180[seg180.length - 1].end === 180, "分段覆盖整段 [0,180]");
ok(seg180.every((s) => s.end > s.start), "每段 end>start");

// 2. 覆盖状态
console.log("2. 覆盖状态");
ok(coverageStatus(0.95, 0.95) === "FULL", "转写+画面都≈满 → FULL");
ok(coverageStatus(0.6, 0.2) === "PARTIAL", "任一项>0.5 → PARTIAL");
ok(coverageStatus(0.04, 0.04) === "NONE", "都很低 → NONE");

// 3. buildUnderstanding 诚实性
console.log("3. understanding 诚实性");
const full = buildUnderstanding({ durationSec: 180, transcriptDurationSec: 176, visualCoverageSec: 180, hasTranscript: true, hasVision: true });
ok(full.coverageStatus === "FULL" && full.transcriptCoverage === 0.978, "有转写+画面+时长 → FULL/高覆盖");
const noDur = buildUnderstanding({ hasVision: true });
ok(noDur.coverageStatus === "PARTIAL" && /无法量化/.test(noDur.note), "无时长但有画面 → PARTIAL（不妄称完整）");
const none = buildUnderstanding({});
ok(none.coverageStatus === "NONE", "无画面无转写 → NONE");

// 4. timelineFactBlock 不臆造
console.log("4. 时间轴不臆造");
const block = timelineFactBlock(noDur);
ok(block.includes("覆盖状态 PARTIAL") && /切勿臆造/.test(block), "无分段内容时明确勿臆造具体时段事实");
const block2 = timelineFactBlock(buildUnderstanding({ durationSec: 180, transcriptDurationSec: 176, visualCoverageSec: 180, hasTranscript: true, hasVision: true, segments: [{ index: 1, start: 0, end: 36, transcript: "开局讲结论" }, { index: 2, start: 36, end: 72, transcript: "中间案例" }] }));
ok(block2.includes("[0-36s]") && block2.includes("开局讲结论"), "有时间轴事实时给出时间戳化内容");

// 5. buildPrompt 纳入时间轴事实层
console.log("5. buildPrompt 接入");
const withTl = buildPrompt({ title: "t", timelineText: block2 });
ok(withTl.includes("视频事实层") && withTl.includes("[0-36s]"), "buildPrompt 含时间轴事实层");
const noTl = buildPrompt({ title: "t" });
ok(noTl.includes("没有可用的时间轴事实层"), "无时间轴时明确提示勿臆造");

// 6. 非产品输入模型（主题优先）
console.log("6. 非产品 / 主题优先");
ok(resolveCreationTopic({ topic: "普通人如何判断一家餐厅值不值得去" }) === "普通人如何判断一家餐厅值不值得去", "无产品时用主题即可");
ok(parseDurationSec("3分钟") === 180, "时长解析 3min→180s");

// 7. 代码路径证据：分析/复刻分离 + 覆盖度写入 + 首页主题优先
console.log("7. 代码路径证据");
const read = (rel: string) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
ok(/report\.understanding\s*=\s*understanding/.test(read("app/api/analyze/url/route.ts")), "URL 分析写入 understanding");
ok(/report\.understanding\s*=\s*understanding/.test(read("app/api/analyze/upload/route.ts")), "上传分析写入 understanding");
ok(/timelineText/.test(read("app/api/analyze/url/route.ts")), "URL 分析传 timelineText");
ok(/① 深度拆解这个视频/.test(read("components/report-view.tsx")) && /② 用这个视频的方法创作我的内容/.test(read("components/report-view.tsx")), "报告拆分 深度拆解 / 复刻 两大动作");
ok(/不卖东西就填主题/.test(read("components/universal-converter.tsx")), "首页 hero 主题优先（去产品中心）");
ok(/不是「深度拆解原视频」|这是「用这个视频的方法做我的内容」/.test(read("app/reengineer/page.tsx")), "reengineer 标明是复刻非拆解");
ok(/理解覆盖度/.test(read("components/report-view.tsx")), "报告展示覆盖度诚实卡片");

console.log(`\n=== 结果：PASS ${pass} / FAIL ${fail} ===`);
process.exit(fail === 0 ? 0 : 1);
