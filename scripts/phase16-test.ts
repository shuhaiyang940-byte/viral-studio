/* Phase 16 自动测试：五人创作团队机制（确定性，不烧 AI token）。
 * 运行：DATABASE_URL=... npx tsx scripts/phase16-test.ts
 */
import { ensureSchema, q, hasDatabase } from "@/lib/db";
import { runCreativePipeline } from "@/lib/creative/coordinator";
import { judgeRole } from "@/lib/creative/roles";
import { createKnowledge, deprecateKnowledge, findKnowledgeByPattern } from "@/lib/knowledge";
import {
  intentToPromptBlock, intentShotRules,
} from "@/lib/creative/intent";
import { applyIntentToShots, applyIntentToPlan } from "@/lib/creative/plan-adapt";
import { buildRepurposeUserPrompt } from "@/lib/repurpose";
import { runLearningJob } from "@/lib/learning/job";
import type { LearningSample } from "@/lib/sources/adapter";
import type { CreativeIntent } from "@/lib/creative/types";

let pass = 0, fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  [PASS] ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label}`); }
}

const createdTaskIds: string[] = [];

async function main() {
  console.log(`\n=== Phase 16 集成测试 ===`);
  if (!hasDatabase()) { console.log("NO DATA：DATABASE_URL 未配置"); process.exit(1); }
  await ensureSchema();
  console.log("[setup] ensureSchema 完成\n");

  // ── A / P：简单剪辑任务只激活 Editor+Audience，不固定五角色 ──
  console.log("A/P：简单剪辑（EDITING_PLAN）");
  const a = await runCreativePipeline({ problem: "我有一段40秒口播视频帮我剪成抖音版本", materials: "40秒口播", content_type: "口播", platform: "抖音" });
  createdTaskIds.push(a.taskId!);
  ok(a.activatedRoles.includes("EDITOR") && a.activatedRoles.includes("AUDIENCE"), "激活了 Editor + Audience");
  ok(a.inactiveRoles.includes("PRODUCER"), "Producer 未激活（成本控制）");
  ok(a.activatedRoles.length < 5, "并非五角色全员调用");
  ok(a.judgeCalls <= a.activatedRoles.length, "无多余二次调用");

  // ── B：内容策略激活 Operator + Audience + Director ──
  console.log("B：内容策略（CONTENT_STRATEGY）");
  const b = await runCreativePipeline({ problem: "我的账号内容策略怎么定", goal: "涨粉" });
  createdTaskIds.push(b.taskId!);
  ok(b.activatedRoles.includes("OPERATOR") && b.activatedRoles.includes("AUDIENCE") && b.activatedRoles.includes("DIRECTOR"), "激活了 Operator + Audience + Director");
  ok(!b.activatedRoles.includes("PRODUCER") && !b.activatedRoles.includes("EDITOR"), "Producer/Editor 未激活");

  // ── C：低成本拍摄激活 Producer + Editor ──
  console.log("C：低成本拍摄（SHOOTING_PLAN）");
  const c = await runCreativePipeline({ problem: "低成本拍一条", budget: "预算有限", time: "时间紧" });
  createdTaskIds.push(c.taskId!);
  ok(c.activatedRoles.includes("PRODUCER") && c.activatedRoles.includes("EDITOR"), "激活了 Producer + Editor");

  // ── D：品牌片激活 Director+Producer+Editor+Audience ──
  console.log("D：品牌片（BRAND_VIDEO）");
  const d = await runCreativePipeline({ problem: "拍品牌宣传片", goal: "品牌形象" });
  createdTaskIds.push(d.taskId!);
  ok(["DIRECTOR", "PRODUCER", "EDITOR", "AUDIENCE"].every((r) => d.activatedRoles.includes(r as any)), "四个核心角色全部激活");

  // ── E：热点任务激活 Operator，且学习不自动形成 Evergreen ──
  console.log("E：热点 + 非Evergreen");
  const e = await runCreativePipeline({ problem: "借势热点追一下", platform: "抖音" });
  createdTaskIds.push(e.taskId!);
  ok(e.activatedRoles.includes("OPERATOR"), "热点任务激活 Operator");
  const eSamples: LearningSample[] = [1, 2].map((n) => ({
    id: `e16-${n}`, source: "hotlist", source_status: "PARTIAL", platform: "抖音", category: "TESTCAT16B",
    title: `热点${n}`, heat: 8000 + n,
    capabilities: { title: "PARTIAL", video_content: "SOURCE_UNAVAILABLE", comments: "SOURCE_UNAVAILABLE", danmaku: "SOURCE_UNAVAILABLE", interaction: "SOURCE_UNAVAILABLE" },
  }));
  const job = await runLearningJob({ runDate: "2099-02-01", idempotencyKey: "16b-test-e", maxItems: 5, samplesProvider: () => Promise.resolve({ samples: eSamples }), changedBy: "test" });
  const created = await findKnowledgeByPattern("OPERATOR", "平台抖音「TESTCAT16B」类目出现高热标题");
  ok(!!created && created.trend_type !== "LONG_TERM", `热点知识 trend_type=${created?.trend_type}，非 Evergreen`);

  // ── F/J：Director 与 Audience 冲突可记录；Coordinator 能处理 ──
  console.log("F/J：情感内容冲突记录 + 协调");
  const f = await runCreativePipeline({ problem: "情感内容怎么剪", content_type: "情感", materials: "已有素材" });
  createdTaskIds.push(f.taskId!);
  ok(f.conflicts.length > 0, `产生冲突（${f.conflicts.length} 条）`);
  ok(f.conflicts.some((c) => c.roles.includes("AUDIENCE") && c.roles.includes("DIRECTOR")), "记录到 Director↔Audience 冲突");
  ok(f.decision.conflicts.length === f.conflicts.length, "裁决后冲突写入 decision");

  // ── G：Producer 可否决不可执行方案 ──
  console.log("G：Producer 否决");
  const g = await runCreativePipeline({ problem: "拍一支3分钟电影感短片", goal: "3分钟电影感", budget: "预算有限", time: "时间紧" });
  createdTaskIds.push(g.taskId!);
  ok(g.conflicts.some((c) => c.winner === "PRODUCER" && c.conflictType === "feasibility_veto"), "Producer 否决不可执行方案");

  // ── H：Editor 可否决技术不可实现 ──
  console.log("H：Editor 技术否决");
  const h = await runCreativePipeline({ problem: "怎么剪", materials: "" });
  createdTaskIds.push(h.taskId!);
  ok(h.conflicts.some((c) => c.winner === "EDITOR" && c.conflictType === "technical_veto"), "Editor 否决技术不可实现");

  // ── I：Audience 提出用户理解风险 ──
  console.log("I：Audience 用户理解风险");
  const i = await runCreativePipeline({ problem: "剧情内容", content_type: "剧情", audience: "年轻女性", platform: "抖音" });
  createdTaskIds.push(i.taskId!);
  const auJudge = i.judgments.find((j) => j.role === "AUDIENCE");
  ok(!!auJudge && auJudge.objections.some((o) => /不理解|自嗨|划走/.test(o)), "Audience 提出用户理解风险");

  // ── K：无冲突时不二次调用 ──
  console.log("K：无冲突不二次调用");
  const kk = await runCreativePipeline({ problem: "知识口播怎么剪", content_type: "知识", materials: "口播素材", platform: "抖音" });
  createdTaskIds.push(kk.taskId!);
  ok(kk.conflicts.length === 0, `无冲突（${kk.conflicts.length}）`);
  ok(kk.challengeTriggered === false && kk.judgeCalls === kk.activatedRoles.length, "未触发无意义二次调用");

  // ── L/M：知识进入对应角色；DEPRECATED 不注入 ──
  console.log("L/M：知识归属 + DEPRECATED 排除");
  const kdir = await createKnowledge({ role: "DIRECTOR", pattern: "16B-TEST::L::hook-gap", description: "认知缺口", why: "测试", action: "测试", source: "test", source_status: "OK" });
  ok(!!kdir, "建立 DIRECTOR 知识");
  await q(`UPDATE knowledge SET lifecycle='ACTIVE', is_deprecated=false, confidence=70, weight=70 WHERE id=$1`, [kdir!.id]);
  const jd = await judgeRole("DIRECTOR", { taskType: "SCRIPT_CREATION", goal: "做知识视频", platform: "抖音", content_type: "知识", audience: "", budget: "", time: "", materials: "", analysis: {}, constraints: [], questions: [] });
  const jo = await judgeRole("OPERATOR", { taskType: "SCRIPT_CREATION", goal: "做知识视频", platform: "抖音", content_type: "知识", audience: "", budget: "", time: "", materials: "", analysis: {}, constraints: [], questions: [] });
  ok(jd.knowledgeIds.includes(kdir!.id), "知识进入对应的 DIRECTOR 角色");
  ok(!jo.knowledgeIds.includes(kdir!.id), "知识不进入 OPERATOR 角色");
  await deprecateKnowledge(kdir!.id, { reason: "test", changed_by: "test" });
  ok(!(await judgeRole("DIRECTOR", { taskType: "SCRIPT_CREATION", goal: "做知识视频", platform: "抖音", content_type: "知识", audience: "", budget: "", time: "", materials: "", analysis: {}, constraints: [], questions: [] })).knowledgeIds.includes(kdir!.id), "DEPRECATED 知识不再注入");

  // ── N：SOURCE_UNAVAILABLE 不形成知识 ──
  console.log("N：SOURCE_UNAVAILABLE 不形成知识");
  const nSamples: LearningSample[] = [{ id: "n16", source: "xiaohongshu", source_status: "SOURCE_UNAVAILABLE", platform: "小红书", category: "TESTCAT16B", title: "x", heat: 1, capabilities: { title: "SOURCE_UNAVAILABLE", video_content: "SOURCE_UNAVAILABLE", comments: "SOURCE_UNAVAILABLE", danmaku: "SOURCE_UNAVAILABLE", interaction: "SOURCE_UNAVAILABLE" } }];
  const nJob = await runLearningJob({ runDate: "2099-02-02", idempotencyKey: "16b-test-n", maxItems: 5, samplesProvider: () => Promise.resolve({ samples: nSamples }), changedBy: "test" });
  ok(nJob.added === 0, "不可用源未生成知识");

  // ── O：用户任务不消耗 learning quota ──
  console.log("O：隔离（quota 不变）");
  const [q0] = await q<{ c: number }>(`SELECT count(*)::int AS c FROM quota_usage WHERE key LIKE 'analyze:%' OR key LIKE 'gen:%'`);
  const before = Number(q0?.c ?? 0);
  const oRun = await runCreativePipeline({ problem: "商业视频求转化", goal: "带货" });
  createdTaskIds.push(oRun.taskId!);
  const [q1] = await q<{ c: number }>(`SELECT count(*)::int AS c FROM quota_usage WHERE key LIKE 'analyze:%' OR key LIKE 'gen:%'`);
  ok(Number(q1?.c ?? 0) === before, "创作决策未消耗用户 quota");

  // ── Q/R/S/T：Creative Intent 注入 Script/Storyboard/Plan ──
  console.log("Q/R/S/T：Intent 注入 Script / Storyboard / Plan + 无 Intent 兼容");
  const intent: CreativeIntent = {
    goal: "知识短视频", platform: "抖音", audience: "年轻人", content_type: "知识",
    core_message: "先给结论", narrative_intent: "前2秒钩子", market_intent: "强CTA", execution_intent: "单人可拍",
    editing_intent: "每镜头控制在 2 秒", audience_intent: "避免自嗨",
    priority_rules: [], hard_constraints: ["镜头数≤3", "仅用现有素材"], soft_constraints: [], risks: [], unresolved_questions: [],
    activated_roles: ["EDITOR", "AUDIENCE"], role_weights: { EDITOR: 0.6, AUDIENCE: 0.4, DIRECTOR: 0, PRODUCER: 0, OPERATOR: 0, COMMON: 0 },
    evidence_summary: "裁决：剪辑优先",
  };
  const prompt = buildRepurposeUserPrompt({
    playbook: { title: "t", hook: "h", structure: [{ phase: "钩子", secs: 3, detail: "d" }], cameraTips: [], music: [], shots: [] },
    myTopic: "知识", platform: "抖音", creativeIntent: intentToPromptBlock(intent),
  });
  ok(prompt.includes("团队创作方案"), "Script 注入团队方案");
  const promptNo = buildRepurposeUserPrompt({ playbook: { title: "t", hook: "h", structure: [{ phase: "钩子", secs: 3, detail: "d" }], cameraTips: [], music: [], shots: [] }, myTopic: "知识" });
  ok(!promptNo.includes("团队创作方案"), "无 Intent 时 Script 不含团队方案（兼容）");
  const shots = [1, 2, 3, 4, 5].map((n) => ({ index: n, durationSec: 5, phase: "x" }));
  ok(applyIntentToShots(shots, intent).length === 3, "Storyboard 按硬约束收窄镜头数");
  ok(applyIntentToShots(shots, undefined).length === 5, "无 Intent 时 Storyboard 原样");
  const clips = [{ durationSec: 5, note: "", no: "01", phase: "x" }, { durationSec: 4, note: "", no: "02", phase: "y" }];
  const adapted = applyIntentToPlan(clips, intent);
  ok(adapted.clips.every((c) => c.durationSec <= 2), "Plan 按意图限制镜头时长");
  ok(adapted.note != null && adapted.note.includes("剪辑参考"), "Plan 写入剪辑参考");
  ok(applyIntentToPlan(clips, undefined).clips.length === 2, "无 Intent 时 Plan 原样");

  // ── 清理 ──
  console.log("\n清理测试数据…");
  const ids = createdTaskIds.filter(Boolean);
  if (ids.length) await q(`DELETE FROM creative_task WHERE id = ANY($1::text[])`, [ids]);
  await q(`DELETE FROM knowledge WHERE pattern LIKE '16B-TEST:%'`);
  await q(`DELETE FROM knowledge WHERE pattern LIKE '%TESTCAT16B%'`);
  await q(`DELETE FROM learning_observation WHERE extracted_pattern LIKE '%TESTCAT16B%'`);
  await q(`DELETE FROM learning_job WHERE idempotency_key LIKE '16b-test%' OR idempotency_key LIKE '16b-test%'`);
  console.log("清理完成");

  console.log(`\n=== 结果：PASS ${pass} / FAIL ${fail} ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("\n[FATAL]", e); process.exit(1); });
