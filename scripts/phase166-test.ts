/* Phase 16.6：五角色专业知识体系与初始化规则（确定性，不烧 AI）。
 * 运行：DATABASE_URL=... npx tsx scripts/phase166-test.ts
 */
import { ensureSchema, q, hasDatabase } from "@/lib/db";
import { judgeRole, ROLE_BOUNDARIES } from "@/lib/creative/roles";
import { runCreativePipeline } from "@/lib/creative/coordinator";
import { TASK_PROFILES, roleCapabilityMatrix } from "@/lib/creative/tasks";
import { createKnowledge, addCounterExample, findKnowledgeByPattern, recallKnowledge } from "@/lib/knowledge";
import {
  KNOWLEDGE_TYPES, KNOWLEDGE_ORIGINS, EVIDENCE_LEVELS, isUsableAsValidated,
  initFoundationalKnowledge, SYSTEM_DEFINED_PRINCIPLES, confidenceLabel,
} from "@/lib/knowledge-taxonomy";
import type { CreativeFactSheet } from "@/lib/creative/types";
import type { Role } from "@/lib/knowledge-logic";

let pass = 0, fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  [PASS] ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label}`); }
}
const F = (o: Partial<CreativeFactSheet>): CreativeFactSheet => ({
  taskType: "SCRIPT_CREATION", goal: "", platform: "", content_type: "", audience: "",
  budget: "", time: "", materials: "", analysis: {}, constraints: [], questions: [], ...o,
});

const MK = (o: Record<string, unknown>) =>
  createKnowledge({
    role: "DIRECTOR", pattern: `16B-TEST::${Date.now()}::${Math.random()}`, source: "test", source_status: "OK",
    knowledge_type: "PATTERN", knowledge_origin: "LEARNED", evidence_level: "LEVEL_1",
    notes: "16B-TEST", ...(o as any),
  });

async function main() {
  console.log(`\n=== Phase 16.6 五角色知识体系审计 ===`);
  if (!hasDatabase()) { console.log("NO DATA"); process.exit(1); }
  await ensureSchema();
  console.log("[setup] ensureSchema 完成\n");

  // A. 五角色边界
  console.log("A. 五角色边界");
  ok(["DIRECTOR", "PRODUCER", "OPERATOR", "EDITOR", "AUDIENCE"].every((r) => {
    const b = ROLE_BOUNDARIES[r as Role];
    return b.primary && b.secondary && b.veto && b.outOfScope.length && b.biasToAvoid && b.evidenceRequired;
  }), "五角色均有 primary/secondary/veto/outOfScope/biasToAvoid/evidenceRequired");

  // B. 五角色知识类型
  console.log("B. 知识分类");
  ok(KNOWLEDGE_TYPES.length >= 12, `知识类型数=${KNOWLEDGE_TYPES.length}（≥12）`);
  ok(KNOWLEDGE_ORIGINS.includes("SYSTEM_DEFINED") && KNOWLEDGE_ORIGINS.includes("LEARNED"), "来源含 SYSTEM_DEFINED 与 LEARNED");
  ok(["LEVEL_0", "LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4", "LEVEL_5"].every((l) => EVIDENCE_LEVELS.includes(l as any)), "可信度等级 LEVEL_0..5");

  // C. SYSTEM_DEFINED 与 LEARNED 分离
  console.log("C. source 分离");
  ok(!!SYSTEM_DEFINED_PRINCIPLES.length, `SYSTEM_DEFINED 基础原则 ${SYSTEM_DEFINED_PRINCIPLES.length} 条`);
  const sys = await createKnowledge({
    role: "DIRECTOR", pattern: `16B-TEST::C::sys::${Date.now()}`, source: "system", source_status: "OK",
    knowledge_type: "PRINCIPLE", knowledge_origin: "SYSTEM_DEFINED", evidence_level: "LEVEL_0", confidence: 15, weight: 20, lifecycle: "NEW", notes: "16B-TEST",
  });
  const lrn = await createKnowledge({
    role: "DIRECTOR", pattern: `16B-TEST::C::lrn::${Date.now()}`, source: "market", source_status: "OK",
    knowledge_origin: "LEARNED", evidence_level: "LEVEL_2", confidence: 70, weight: 70, lifecycle: "ACTIVE", notes: "16B-TEST",
  });
  ok(sys?.knowledge_origin === "SYSTEM_DEFINED" && sys?.evidence_level === "LEVEL_0", "SYSTEM_DEFINED 标记明确");
  ok(lrn?.knowledge_origin === "LEARNED" && lrn?.evidence_level === "LEVEL_2", "LEARNED 标记明确");
  ok(!isUsableAsValidated(sys!), "SYSTEM_DEFINED/LEVEL_0 不可作为已验证知识");
  ok(isUsableAsValidated(lrn!), "LEARNED/LEVEL_2/ACTIVE 可作为已验证知识");

  // D. LEVEL_0 不得伪装成真实经验
  console.log("D. LEVEL_0 校验");
  const j = await judgeRole("DIRECTOR", F({ content_type: "知识" }));
  ok(!j.knowledgeIds.includes(sys!.id), "LEVEL_0 知识不进入角色判断");
  ok(j.knowledgeIds.includes(lrn!.id), "LEVEL_2 知识进入角色判断");

  // E. 单案例不能成为高权重规律
  console.log("E. LEVEL_1 低权重");
  const lowW = await createKnowledge({ role: "DIRECTOR", pattern: `16B-TEST::E::${Date.now()}`, source: "test", source_status: "OK", knowledge_origin: "LEARNED", evidence_level: "LEVEL_1", confidence: 30, weight: 25, lifecycle: "ACTIVE", notes: "16B-TEST" });
  ok(!isUsableAsValidated(lowW!), "LEVEL_1 且低权重（<40）不作为高权重规律");

  // F. 热点不能自动成为长期规律
  console.log("F. 热点 vs 长期");
  const hot = await createKnowledge({ role: "OPERATOR", pattern: `16B-TEST::F::${Date.now()}`, source: "market", source_status: "OK", knowledge_origin: "LEARNED", evidence_level: "LEVEL_1", confidence: 60, weight: 60, lifecycle: "ACTIVE", trend_type: "SHORT_TERM", notes: "16B-TEST" });
  const jo = await judgeRole("OPERATOR", F({ content_type: "知识", platform: "抖音" }));
  ok(jo.knowledgeIds.includes(hot!.id) && jo.evidence.some((e) => e.includes("无 LONG_TERM")), "SHORT_TERM 热点不视为长期规律");

  // G. 反例限制权重
  console.log("G. 反例降权");
  const gk = await createKnowledge({ role: "EDITOR", pattern: `16B-TEST::G::${Date.now()}`, source: "test", source_status: "OK", knowledge_origin: "LEARNED", evidence_level: "LEVEL_1", confidence: 60, weight: 60, lifecycle: "ACTIVE", notes: "16B-TEST" });
  const gAfter = await addCounterExample(gk!.id, { counter_example: "情绪类内容不适用", changed_by: "test" });
  ok(gAfter!.weight < gk!.weight && gAfter!.fail_count > 0, `反例使权重下降（${gk!.weight}→${gAfter!.weight}）`);

  // H. 角色越权检测
  console.log("H. 越权");
  const z = await Promise.all(["OPERATOR", "DIRECTOR", "EDITOR", "PRODUCER", "AUDIENCE"].map((r) => judgeRole(r as Role, F({ content_type: "知识", platform: "抖音" }))));
  ok(z.every((x) => !/(必须.{0,3}(蹭|追)热点|所有.{0,3}都要.{0,2}电影|所有.{0,3}都要.{0,2}快剪|必须.{0,3}最便宜|必须.{0,3}娱乐化)/.test(x.conclusion)), "五角色均未越权强制自身偏见");

  // I. inactive 不产生判断
  console.log("I. 闭嘴（inactive）");
  const edit = await runCreativePipeline({ problem: "帮我剪一段30秒抖音视频", materials: "已有素材" });
  ok(!edit.activatedRoles.includes("PRODUCER"), "剪辑任务 Producer inactive");
  ok(!edit.judgments.some((j) => j.role === "PRODUCER"), "Producer 无判断");
  ok(!edit.decision.creative_intent.activated_roles.includes("PRODUCER"), "Producer 未进入 Intent");

  // J. Coordinator 不产生专业知识
  console.log("J. Coordinator 边界");
  ok(edit.decision.knowledge_used.every((id) => edit.judgments.some((j) => j.knowledgeIds.includes(id))), "Coordinator 知识仅来自角色判断，无自造知识");

  // K. scope 正确
  console.log("K. 知识 scope");
  const scopeK = await createKnowledge({ role: "DIRECTOR", pattern: `16B-TEST::K::${Date.now()}`, source: "test", source_status: "OK", knowledge_origin: "LEARNED", evidence_level: "LEVEL_2", confidence: 60, weight: 60, lifecycle: "ACTIVE", platform: "", scope: { platform: "抖音", content_type: "知识" }, notes: "16B-TEST" });
  ok(scopeK!.scope.platform === "抖音" && (scopeK!.scope as any).content_type === "知识", "scope 已存储");
  const recalled = await recallKnowledge("DIRECTOR", { platform: "抖音", content_type: "知识", limit: 50 });
  ok(recalled.some((x) => x.id === scopeK!.id), "scope 匹配时召回");

  // M/N. 跨平台/跨内容污染
  console.log("M/N. 污染检测");
  ok(!(await recallKnowledge("DIRECTOR", { platform: "bilibili", limit: 50 })).some((x) => x.id === scopeK!.id), "跨平台范围不污染");
  ok(!(await recallKnowledge("DIRECTOR", { content_type: "美食", limit: 50 })).some((x) => x.id === scopeK!.id), "跨内容范围不污染");

  // O. 同题五角色专业差异
  console.log("O. 同题五角色差异");
  const jsO = await Promise.all(["DIRECTOR", "PRODUCER", "OPERATOR", "EDITOR", "AUDIENCE"].map((r) => judgeRole(r as Role, F({ content_type: "知识", platform: "抖音", materials: "口播" }))));
  ok(new Set(jsO.map((x) => x.conclusion)).size === 5, "五角色结论互不相同");

  // P. 闭嘴（什么时候不在场）
  console.log("P. 闭嘴场景");
  const story = await runCreativePipeline({ problem: "这个故事应该怎么讲", content_type: "情感" });
  ok(!story.activatedRoles.includes("PRODUCER"), "『怎么讲故事』 Producer 不参与");
  const color = await runCreativePipeline({ problem: "这个视频怎么调色", materials: "已有素材" });
  ok(color.activatedRoles.includes("EDITOR"), "『怎么调色』 Editor 参与");

  // Q. 冲突只有真实矛盾才产生
  console.log("Q. 冲突真实性");
  const clean = await runCreativePipeline({ problem: "知识口播怎么剪", content_type: "知识", materials: "口播素材", platform: "抖音" });
  ok(clean.conflicts.length === 0, "无真实矛盾 → 不制造冲突");

  // R/S/T/U/V. 五角色偏见
  console.log("R/S/T/U/V. 五角色偏见");
  const aud = await judgeRole("AUDIENCE", F({ content_type: "情感", audience: "年轻人" }));
  ok(!/必须.{0,3}娱乐|所有.{0,3}都要.{0,2}娱乐/.test(aud.conclusion), "Audience 不自动娱乐化");
  const prod2 = await judgeRole("PRODUCER", F({ goal: "品牌形象", content_type: "品牌", budget: "充足" }));
  ok(/值得投入/.test(prod2.conclusion), "Producer 不自动保守");
  const op2 = await judgeRole("OPERATOR", F({ content_type: "知识", platform: "抖音" }));
  ok(!/必须.{0,3}(蹭|追)热点/.test(op2.conclusion), "Operator 不自动追热点");
  const dir2 = await judgeRole("DIRECTOR", F({ content_type: "知识" }));
  ok(!/必须.{0,3}电影/.test(dir2.conclusion), "Director 不自动电影化");
  const ed2 = await judgeRole("EDITOR", F({ content_type: "情感", materials: "已有" }));
  ok(!/必须.{0,3}快剪|所有.{0,3}都要.{0,2}快/.test(ed2.conclusion), "Editor 不自动快剪");

  // W. 知识为空系统仍正常运行
  console.log("W. 知识为空");
  const empty = await runCreativePipeline({ problem: "做一条知识口播", content_type: "知识", materials: "口播" });
  ok(empty.decision.creative_intent && empty.decision.creative_intent.core_message.length > 0, "知识为空时系统仍能生成方案");

  // X. NO_DATA 不得生成假判断
  console.log("X. NO_DATA");
  const nd = await judgeRole("AUDIENCE", F({}));
  ok(nd.evidenceSource === "no_data" && /受众未指定|无法判断/.test(nd.conclusion), "无受众/类型 → NO_DATA，不假扮用户行为");

  // 初始化 SYSTEM_DEFINED（幂等，真实基础原则，非测试数据）
  console.log("初始化 SYSTEM_DEFINED 基础原则");
  const init = await initFoundationalKnowledge();
  console.log(`  [init] added=${init.added} skipped=${init.skipped}`);

  // 能力矩阵
  console.log("能力矩阵");
  const matrix = roleCapabilityMatrix();
  ok(matrix.length === Object.keys(TASK_PROFILES).length, `能力矩阵覆盖 ${matrix.length} 任务`);
  ok(matrix.every((m) => !(m.director_weight === 0.2 && m.producer_weight === 0.2 && m.operator_weight === 0.2 && m.editor_weight === 0.2 && m.audience_weight === 0.2)), "无 20/20/20/20/20 固定均权");

  // ── 清理测试知识 ──
  console.log("\n清理测试数据…");
  await q("DELETE FROM knowledge WHERE notes = '16B-TEST' OR pattern LIKE '16B-TEST:%'");
  await q("DELETE FROM creative_task");
  console.log("清理完成");

  console.log(`\n=== 结果：PASS ${pass} / FAIL ${fail} ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("\n[FATAL]", e); process.exit(1); });
