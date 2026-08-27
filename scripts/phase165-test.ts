/* Phase 16.5：五角色专业能力审计 + 协作校准（确定性，不烧 AI）。
 * 运行：DATABASE_URL=... npx tsx scripts/phase165-test.ts
 */
import { ensureSchema, q, hasDatabase } from "@/lib/db";
import { judgeRole, ROLE_BOUNDARIES } from "@/lib/creative/roles";
import { runCreativePipeline } from "@/lib/creative/coordinator";
import type { CreativeFactSheet } from "@/lib/creative/types";
import type { Role } from "@/lib/knowledge-logic";

let pass = 0, fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  [PASS] ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label}`); }
}

const ALL: Role[] = ["DIRECTOR", "PRODUCER", "OPERATOR", "EDITOR", "AUDIENCE"];
const F = (o: Partial<CreativeFactSheet>): CreativeFactSheet => ({
  taskType: "SCRIPT_CREATION", goal: "", platform: "", content_type: "", audience: "",
  budget: "", time: "", materials: "", analysis: {}, constraints: [], questions: [], ...o,
});

async function main() {
  console.log(`\n=== Phase 16.5 五角色审计 ===`);
  if (!hasDatabase()) { console.log("NO DATA"); process.exit(1); }
  await ensureSchema();
  console.log("[setup] ensureSchema 完成\n");

  // ── 1. 同题五答：五个角色对同一任务是否真正给出不同判断（不是换词） ──
  console.log("1. 同题五答 差异测试");
  const tasks = [
    F({ goal: "知识涨粉", platform: "抖音", content_type: "知识", audience: "年轻人", materials: "口播" }),
    F({ taskType: "BRAND_VIDEO", goal: "品牌形象", content_type: "品牌", budget: "充足", audience: "高端用户", materials: "有" }),
    F({ taskType: "SHOOTING_PLAN", goal: "3分钟电影感", content_type: "剧情", budget: "500元", audience: "", materials: "无演员" }),
  ];
  for (const facts of tasks) {
    const js = await Promise.all(ALL.map((r) => judgeRole(r, facts)));
    const conclusions = js.map((j) => j.conclusion);
    ok(new Set(conclusions).size === 5, `五角色结论互不相同（${facts.taskType}/${facts.content_type}）`);
    let uniqueRoles = 0;
    for (const j of js) {
      const others = js.filter((x) => x.role !== j.role).flatMap((x) => x.recommendations);
      if (j.recommendations.some((r) => !others.includes(r))) uniqueRoles++;
    }
    ok(uniqueRoles >= 4, `每个角色都有独特建议（${uniqueRoles}/5）`);
  }

  // ── 2. 越权/偏见检测（Test 1-5） ──
  console.log("2. 角色越权/偏见检测");
  const variants = [F({}), F({ content_type: "知识", platform: "抖音" }), F({ content_type: "情感", goal: "涨粉", budget: "500元" })];
  const collect = async (r: Role) => (await Promise.all(variants.map((f) => judgeRole(r, f)))).map((j) => `${j.conclusion} ${j.recommendations.join(" ")} ${j.risks.join(" ")}`);
  const noMandate = (texts: string[], re: RegExp) => !texts.some((t) => re.test(t));
  ok(noMandate(await collect("OPERATOR"), /必须.{0,4}(蹭|追)热点|所有.{0,4}都要.{0,2}(蹭|追)热点/), "Operator 未强制蹭热点");
  ok(noMandate(await collect("DIRECTOR"), /所有.{0,4}都要.{0,2}电影|必须.{0,4}电影化/), "Director 未强制电影化");
  ok(noMandate(await collect("EDITOR"), /所有.{0,4}都要.{0,2}(快|加速)|必须.{0,4}快剪/), "Editor 未强制快速剪辑");
  ok(noMandate(await collect("PRODUCER"), /所有.{0,4}都要.{0,2}最便宜|必须.{0,4}(最便宜|省钱)/), "Producer 未强制选最便宜");
  ok(noMandate(await collect("AUDIENCE"), /所有.{0,4}都要.{0,2}娱乐|必须.{0,4}娱乐化/), "Audience 未强制娱乐化");
  const pPremium = await judgeRole("PRODUCER", F({ goal: "品牌形象", content_type: "品牌", budget: "充足", materials: "有" }));
  ok(/值得投入/.test(pPremium.conclusion), `Producer 品牌+充足 → 值得投入（${pPremium.conclusion}）`);
  const pLow = await judgeRole("PRODUCER", F({ goal: "低成本", budget: "500元", materials: "手机" }));
  ok(/低成本|控制/.test(pLow.conclusion), `Producer 低预算 → 控制成本（${pLow.conclusion}）`);

  // ── 3. 20 任务矩阵 ──
  console.log("3. 20 任务矩阵");
  interface Row { n: string; p: string; g?: string; b?: string; t?: string; m?: string; act: Role[]; inact: Role[]; full?: boolean }
  const rows: Row[] = [
    { n: "选题", p: "帮我想一个抖音爆款选题", act: ["OPERATOR", "AUDIENCE"], inact: ["DIRECTOR", "PRODUCER", "EDITOR"] },
    { n: "故事脚本", p: "帮我写一个故事性短视频脚本", act: ["DIRECTOR", "EDITOR", "AUDIENCE", "OPERATOR"], inact: ["PRODUCER"] },
    { n: "五百块拍摄", p: "这个视频预算只有500元怎么拍", b: "500元", act: ["PRODUCER", "EDITOR", "DIRECTOR", "AUDIENCE"], inact: ["OPERATOR"] },
    { n: "剪30s", p: "这是我拍好的素材帮我剪成30秒抖音视频", act: ["EDITOR", "AUDIENCE", "OPERATOR"], inact: ["DIRECTOR", "PRODUCER"] },
    { n: "降成本", p: "这个拍摄方案太贵了帮我降低成本", b: "太贵", act: ["PRODUCER", "EDITOR", "DIRECTOR", "AUDIENCE"], inact: ["OPERATOR"] },
    { n: "追热点", p: "最近行业热点很火我要不要马上跟", t: "知识", act: ["OPERATOR", "PRODUCER", "AUDIENCE", "DIRECTOR"], inact: ["EDITOR"] },
    { n: "脚本不好看", p: "这个脚本哪里不好看", t: "剧情", act: ["DIRECTOR", "EDITOR", "AUDIENCE", "OPERATOR"], inact: ["PRODUCER"] },
    { n: "电影感", p: "怎么拍出电影感", b: "充足", act: ["PRODUCER", "EDITOR", "DIRECTOR", "AUDIENCE"], inact: ["OPERATOR"] },
    { n: "卖产品", p: "我要卖这个产品给我做一条30秒视频", g: "卖货", act: ["OPERATOR", "PRODUCER", "DIRECTOR", "EDITOR", "AUDIENCE"], inact: [], full: true },
    { n: "知识口播", p: "做一条知识科普口播", t: "知识", act: ["DIRECTOR", "EDITOR", "AUDIENCE", "OPERATOR"], inact: ["PRODUCER"] },
    { n: "种草", p: "给这个产品做种草视频", act: ["OPERATOR", "PRODUCER", "DIRECTOR", "EDITOR", "AUDIENCE"], inact: [], full: true },
    { n: "情感剧情", p: "写一个情感剧情向的视频", t: "情感", act: ["DIRECTOR", "EDITOR", "AUDIENCE", "OPERATOR"], inact: ["PRODUCER"] },
    { n: "商业转化", p: "做一个商业转化视频", g: "带货转化", act: ["OPERATOR", "PRODUCER", "DIRECTOR", "EDITOR", "AUDIENCE"], inact: [], full: true },
    { n: "品牌宣传", p: "做品牌宣传片", g: "品牌形象", act: ["DIRECTOR", "PRODUCER", "EDITOR", "AUDIENCE", "OPERATOR"], inact: [], full: true },
    { n: "后期剪辑", p: "帮我后期剪辑一下", t: "口播", act: ["EDITOR", "AUDIENCE", "DIRECTOR", "OPERATOR"], inact: ["PRODUCER"] },
    { n: "低成本口播", p: "低成本做口播视频", b: "有限", t: "口播", act: ["DIRECTOR", "EDITOR", "AUDIENCE", "PRODUCER", "OPERATOR"], inact: [], full: true },
    { n: "素材不足剪", p: "素材不足怎么剪", m: "", act: ["EDITOR", "AUDIENCE", "OPERATOR"], inact: ["DIRECTOR", "PRODUCER"] },
    { n: "镜头时长", p: "成片镜头时长怎么定帮我剪", act: ["EDITOR", "AUDIENCE", "OPERATOR"], inact: ["DIRECTOR", "PRODUCER"] },
    { n: "看不懂", p: "这条内容用户会不会看不懂", t: "知识", act: ["DIRECTOR", "EDITOR", "AUDIENCE", "OPERATOR"], inact: ["PRODUCER"] },
    { n: "五人协作", p: "我要卖这个产品给我做一条30秒视频", g: "卖货", act: ["OPERATOR", "PRODUCER", "DIRECTOR", "EDITOR", "AUDIENCE"], inact: [], full: true },
  ];
  let absentCount = 0, nonEqualCount = 0;
  for (const r of rows) {
    const run = await runCreativePipeline({ problem: r.p, goal: r.g, budget: r.b, content_type: r.t, materials: r.m ?? "已有素材" });
    ok(r.act.every((x) => run.activatedRoles.includes(x)), `[${r.n}] 激活 ${r.act.join("/")}`);
    if (r.full) {
      ok(["DIRECTOR", "PRODUCER", "OPERATOR", "EDITOR", "AUDIENCE"].every((x) => run.activatedRoles.includes(x as any)), `[${r.n}] 五人完整协作`);
    } else {
      ok(run.activatedRoles.length < 5, `[${r.n}] 存在角色缺席（${run.activatedRoles.length}/5）`);
    }
    const vals = run.activatedRoles.map((x) => run.roleWeights[x] ?? 0).filter((v) => v > 0);
    ok(new Set(vals.map((v) => v.toFixed(2))).size >= 2, `[${r.n}] 权重非均等`);
    if (!r.full && run.activatedRoles.length < 5) absentCount++;
    if (new Set(vals.map((v) => v.toFixed(2))).size >= 2) nonEqualCount++;
  }
  ok(absentCount >= 12, `多数任务存在角色缺席（${absentCount}）`);
  ok(nonEqualCount === 20, `全部任务权重非均等（${nonEqualCount}/20）`);
  // 硬禁用角色的稳定缺席（profile.inactive，不受触发条件影响）
  const noProducer = await runCreativePipeline({ problem: "帮我剪一段30秒抖音视频", materials: "已有素材" });
  ok(!noProducer.activatedRoles.includes("PRODUCER"), "剪辑任务 Producer 稳定缺席");
  const noEditor = await runCreativePipeline({ problem: "最近行业热点很火我要不要马上跟", content_type: "知识" });
  ok(!noEditor.activatedRoles.includes("EDITOR"), "热点决策任务 Editor 稳定缺席");

  // ── 4. 三个压力案例 ──
  console.log("4. 压力案例");
  const c1 = await runCreativePipeline({ problem: "我一个人拍摄没有演员没有灯光，想做一条有传播性的产品视频", budget: "500元", time: "一人", goal: "有传播性", materials: "手机" });
  ok(c1.activatedRoles.includes("PRODUCER") && c1.activatedRoles.includes("EDITOR"), "CASE1 制片+剪辑参与");
  ok(/控制|复用|成本/.test(c1.decision.creative_intent.execution_intent), "CASE1 方案体现低成本/可复用");
  ok(!c1.conflicts.some((c) => c.winner === "PRODUCER" && c.conflictType === "feasibility_veto"), "CASE1 制片未否决");

  const c2 = await runCreativePipeline({ problem: "我想做一个节奏很慢有情绪有留白的内容，在抖音快速涨粉", content_type: "情感", platform: "抖音", goal: "慢节奏留白但涨粉", materials: "已有素材" });
  const rolesIn = (pair: Role[]) => c2.conflicts.some((c) => c.roles.includes(pair[0]) && c.roles.includes(pair[1]));
  ok(rolesIn(["DIRECTOR", "OPERATOR"]), "CASE2 记录 Director↔Operator 冲突");
  ok(rolesIn(["DIRECTOR", "AUDIENCE"]), "CASE2 记录 Director↔Audience 冲突");
  ok(!/必须.{0,4}(追|蹭)热点|所有.{0,4}都要.{0,2}追/.test(c2.decision.creative_intent.core_message + " " + c2.decision.creative_intent.priority_rules.join(" ")), "CASE2 未强制追热点");

  const c3 = await runCreativePipeline({ problem: "这个热点现在很火，我要不要马上跟", content_type: "知识", platform: "抖音" });
  ok(c3.activatedRoles.includes("OPERATOR") && c3.activatedRoles.includes("PRODUCER") && c3.activatedRoles.includes("AUDIENCE"), "CASE3 运营/制片/观众评估");
  ok(!/必须.{0,4}(追|跟)|一定要.{0,4}(追|跟)|建议.{0,4}马上.{0,2}(追|跟)/.test(c3.decision.creative_intent.priority_rules.join(" ") + " " + c3.decision.creative_intent.core_message), "CASE3 不因热点高自动建议追");

  // ── 5. 审计：边界/协议 ──
  console.log("5. 角色边界/判断协议");
  ok(ALL.every((r) => ROLE_BOUNDARIES[r].primary && ROLE_BOUNDARIES[r].veto && ROLE_BOUNDARIES[r].outOfScope.length), "五角色均有 primary/veto/out-of-scope");
  const j = await judgeRole("DIRECTOR", F({ content_type: "知识" }));
  ok(["recommendations", "risks", "objections", "must_have", "should_have", "avoid", "questions", "confidence", "evidence"].every((k) => k in j), "RoleJudgment 含结构化字段");

  // ── 清理 ──
  console.log("\n清理测试数据…");
  await q("DELETE FROM creative_task");
  console.log("清理完成");
  console.log(`\n=== 结果：PASS ${pass} / FAIL ${fail} ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("\n[FATAL]", e); process.exit(1); });
