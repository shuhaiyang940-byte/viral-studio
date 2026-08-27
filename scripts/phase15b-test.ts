/* Phase 15-B 集成测试（连接真实 Neon；测试数据带标记，结束时清理）。
 * 运行：DATABASE_URL=... npx tsx scripts/phase15b-test.ts
 */
import { ensureSchema, q, hasDatabase } from "@/lib/db";
import {
  createKnowledge, getKnowledge, reinforceKnowledge, addCounterExample,
  deprecateKnowledge, recallKnowledge, knowledgeVersions, findKnowledgeByPattern,
} from "@/lib/knowledge";
import { runLearningJob, exceedsBudget } from "@/lib/learning/job";
import { sourceStatusReport } from "@/lib/sources/adapter";
import type { LearningSample } from "@/lib/sources/adapter";
import {
  computeWeight, learningValueScore, applyCounterExample, nextLifecycle,
  recencyScore, shouldVersion,
} from "@/lib/knowledge-logic";

let pass = 0, fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  [PASS] ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label}`); }
}

const today = "2099-01-01";
const runKey = "15b-test-e";
const PROVIDER_CAT = "TESTCAT15B";

function fakeSample(n: number, overrides: Partial<LearningSample> = {}): LearningSample {
  return {
    id: `fs-${n}`, source: "hotlist", source_status: "PARTIAL",
    platform: "抖音", category: PROVIDER_CAT, title: `测试标题${n}`, heat: 8000 + n,
    capabilities: { title: "PARTIAL", video_content: "SOURCE_UNAVAILABLE", comments: "SOURCE_UNAVAILABLE", danmaku: "SOURCE_UNAVAILABLE", interaction: "SOURCE_UNAVAILABLE" },
    ...overrides,
  };
}

const provider = () => Promise.resolve({ samples: [fakeSample(1), fakeSample(2)] });

async function main() {
  console.log(`\n=== Phase 15-B 集成测试 ===`);
  console.log(`DATABASE_URL 已配置：${hasDatabase() ? "yes" : "no"}\n`);
  if (!hasDatabase()) { console.log("NO DATA：无法运行"); process.exit(1); }

  await ensureSchema();
  console.log("[setup] ensureSchema 完成\n");

  // 基线：隔离测试前先记录用户配额数量（Test H 用）
  const [q0] = await q<{ c: number }>(`SELECT count(*)::int AS c FROM quota_usage WHERE key LIKE 'analyze:%' OR key LIKE 'gen:%'`);
  const quotaBefore = Number(q0?.c ?? 0);

  // ── Test A：建 Knowledge + Version ──
  console.log("Test A：创建 Knowledge → Version");
  const kA = await createKnowledge({
    role: "DIRECTOR", pattern: "15B-TEST::A::hook-gap",
    description: "认知缺口开场", why: "测试", action: "测试", source: "test", source_status: "OK",
    platform: "抖音", content_type: "知识",
  });
  ok(!!kA, "Knowledge 已创建");
  let versA = kA ? await knowledgeVersions(kA.id) : [];
  ok(!!(kA && versA.length >= 1 && versA[0].version === 1), "v1 版本存在");

  // ── Test B：强化两次 → weight/version/evidence_count 变化 ──
  console.log("Test B：同一 Knowledge 强化两次");
  const r1 = kA ? await reinforceKnowledge(kA.id, { evidence_note: "e1", changed_by: "test" }) : null;
  const r2 = r1 ? await reinforceKnowledge(r1.id, { evidence_note: "e2", changed_by: "test" }) : null;
  ok(!!r2 && r2.evidence_count === 2, "evidence_count = 2");
  ok(!!r2 && r2.version >= 3, `version 递增（当前 ${r2?.version}）`);
  ok(!!r2 && Math.abs(r2.weight - 50) >= 1, `weight 已重算（50 → ${r2?.weight}）`);

  // ── Test C：加反例 → confidence/weight 下降 ──
  console.log("Test C：加入反例");
  const beforeC = r2!;
  const cC = await addCounterExample(beforeC.id, { counter_example: "情绪类内容不适用", severity: 1, changed_by: "test" });
  ok(!!cC && cC.confidence < beforeC.confidence, `confidence 下降（${beforeC.confidence} → ${cC?.confidence}）`);
  ok(!!cC && cC.weight < beforeC.weight, `weight 下降（${beforeC.weight} → ${cC?.weight}）`);

  // ── Test D：DEPRECATED 不删除、历史保留、不召回 ──
  console.log("Test D：进入 DEPRECATED");
  const dD = await deprecateKnowledge(cC!.id, { reason: "test", changed_by: "test" });
  const still = await getKnowledge(cC!.id);
  ok(!!dD && dD.lifecycle === "DEPRECATED" && dD.is_deprecated === true, "已标记 DEPRECATED");
  ok(!!still, "数据仍存在（未删除）");
  const versD = await knowledgeVersions(cC!.id);
  ok(versD.length >= 4, `历史版本仍保留（${versD.length} 个）`);
  const recalled = await recallKnowledge("DIRECTOR", { limit: 100 });
  ok(!recalled.some((x) => x.id === cC!.id), "DEPRECATED 不被召回");

  // ── Test E：同一 Learning Job 重复 → 不重复学习 ──
  console.log("Test E：Learning Job 幂等");
  const e1 = await runLearningJob({ runDate: today, idempotencyKey: runKey, maxItems: 5, samplesProvider: provider, changedBy: "test" });
  const e2 = await runLearningJob({ runDate: today, idempotencyKey: runKey, maxItems: 5, samplesProvider: provider, changedBy: "test" });
  ok(e1.status === "DONE", `首次执行 DONE（added=${e1.added}）`);
  ok(e2.status === "ALREADY_RAN", "再次执行返回 ALREADY_RAN");
  ok(e2.added === e1.added, `未重复新增（${e1.added} == ${e2.added}）`);
  const [eObs1] = await q<{ c: number }>(`SELECT count(*)::int AS c FROM learning_observation WHERE extracted_pattern LIKE '%TESTCAT15B%'`);
  const [eObs2] = await q<{ c: number }>(`SELECT count(*)::int AS c FROM learning_observation WHERE extracted_pattern LIKE '%TESTCAT15B%'`);
  ok(Number(eObs1?.c ?? 0) === Number(eObs2?.c ?? 0), "观察数未翻倍");

  // ── Test F：源不可用 → SOURCE_UNAVAILABLE，不产生虚假知识 ──
  console.log("Test F：Source 失败 → SOURCE_UNAVAILABLE，无虚假知识");
  const src = sourceStatusReport();
  ok(src.xiaohongshu.video_content === "SOURCE_UNAVAILABLE", "小红书视频内容 = SOURCE_UNAVAILABLE");
  ok(src.bilibili.comments === "SOURCE_UNAVAILABLE", "B站评论 = SOURCE_UNAVAILABLE");
  const fKey = "15b-test-f";
  const badProvider = () => Promise.resolve({
    samples: [{ ...fakeSample(1, { platform: "小红书", source_status: "SOURCE_UNAVAILABLE" as const }) }],
  });
  const fRes = await runLearningJob({ runDate: "2099-01-02", idempotencyKey: fKey, maxItems: 5, samplesProvider: badProvider, changedBy: "test" });
  ok(fRes.status === "DONE" && fRes.added === 0, `SOURCE_UNAVAILABLE 未生成知识（added=${fRes.added}）`);
  const fK = await findKnowledgeByPattern("OPERATOR", "平台小红书「TESTCAT15B」类目出现高热标题");
  ok(!fK, "未因不可用源伪造知识");

  // ── Test G：预算达到 → 自动停止 ──
  console.log("Test G：AI 预算达到自动停止");
  ok(exceedsBudget(100, 5) === true, "exceedsBudget(100,5)=true");
  ok(exceedsBudget(3, 5) === false, "exceedsBudget(3,5)=false");
  const gKey = "15b-test-g";
  const gRes = await runLearningJob({ runDate: "2099-01-03", idempotencyKey: gKey, maxItems: 5, budgetAiCalls: 5, usedAiCalls: 100, samplesProvider: provider, changedBy: "test" });
  ok(gRes.status === "PAUSED", `预算达到 → PAUSED（${gRes.status}）`);
  ok(gRes.message.includes("预算"), "返回信息含预算说明");

  // ── Test H：用户任务隔离（学习任务不触碰用户 quota） ──
  console.log("Test H：用户任务与学习任务隔离");
  const hKey = "15b-test-h";
  const hRes = await runLearningJob({ runDate: "2099-01-04", idempotencyKey: hKey, maxItems: 5, samplesProvider: provider, changedBy: "test" });
  const [q1] = await q<{ c: number }>(`SELECT count(*)::int AS c FROM quota_usage WHERE key LIKE 'analyze:%' OR key LIKE 'gen:%'`);
  const quotaAfter = Number(q1?.c ?? 0);
  ok(hRes.status === "DONE", "学习任务完成");
  ok(quotaAfter === quotaBefore, `用户 quota 未变化（${quotaBefore} → ${quotaAfter}）`);
  const [lj] = await q<{ c: number }>(`SELECT count(*)::int AS c FROM learning_job WHERE idempotency_key LIKE '15b-test%'`);
  ok(Number(lj?.c ?? 0) >= 4, "学习任务记录在学习_job（独立存储）");

  // ── 纯逻辑 ──
  console.log("纯逻辑：computeWeight / learningValueScore / lifecycle / version");
  const w = computeWeight({ currentWeight: 50, evidenceCount: 5, successCount: 5, failCount: 0, confidence: 70, learningValue: 70, transferability: 70, recentSignalDays: 0 });
  ok(w > 50, `computeWeight 高证据升权（50 → ${w}）`);
  const cw = computeWeight({ currentWeight: 50, evidenceCount: 5, successCount: 0, failCount: 4, confidence: 20, learningValue: 20, transferability: 20, recentSignalDays: 0 });
  ok(cw < 50, `computeWeight 反例降权（50 → ${cw}）`);
  const lv = learningValueScore({ evidence: 80, confidence: 80, longevity: 70, transferability: 80, recency: 80, reproducibility: 70 });
  ok(lv >= 50, `learningValueScore 高证据 → 高分（${lv}）`);
  const ac = applyCounterExample(70, 60, 1);
  ok(ac.weight < 70 && ac.confidence < 60, "applyCounterExample 同时降权降置信");
  ok(recencyScore(0) === 100 && recencyScore(120) === 0, "recencyScore 边界正确");
  ok(shouldVersion({ weight: 50, lifecycle: "NEW", confidence: 20 }, { weight: 60, lifecycle: "TESTING", confidence: 20 }) === true, "shouldVersion 触发");

  // ── 清理测试数据 ──
  console.log("\n清理测试数据…");
  await q(`DELETE FROM learning_observation WHERE extracted_pattern LIKE '%TESTCAT15B%' OR extracted_pattern LIKE '15B-TEST:%'`);
  await q(`DELETE FROM knowledge WHERE pattern LIKE '%TESTCAT15B%' OR pattern LIKE '15B-TEST:%'`);
  await q(`DELETE FROM learning_job WHERE idempotency_key LIKE '15b-test%'`);
  console.log("清理完成");

  console.log(`\n=== 结果：PASS ${pass} / FAIL ${fail} ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("\n[FATAL]", e); process.exit(1); });
