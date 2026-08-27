// 冲突 / 挑战 / 否决机制。
// 冲突不是错误；但「证据不足」时不许强行裁决。

import type { CreativeConflict, CreativeFactSheet, RoleJudgment } from "./types";
import type { Role } from "@/lib/knowledge-logic";

const JOIN = (js: RoleJudgment[], r: Role) => js.find((x) => x.role === r);
const txt = (...parts: (string | string[])[]) =>
  parts.flatMap((p) => (Array.isArray(p) ? p : [p])).join(" ");
const hit = (s: string, re: RegExp) => re.test(s);

export function detectAndResolve(
  judgments: RoleJudgment[],
  facts: CreativeFactSheet,
  weights: Record<Role, number>,
  vetoRoles: Role[]
): CreativeConflict[] {
  const conflicts: CreativeConflict[] = [];
  const dir = JOIN(judgments, "DIRECTOR");
  const ed = JOIN(judgments, "EDITOR");
  const op = JOIN(judgments, "OPERATOR");
  const au = JOIN(judgments, "AUDIENCE");
  const prod = JOIN(judgments, "PRODUCER");

  // 1) Pacing：导演要留白/慢/铺垫 vs 编辑/观众/运营要信息/快/留存
  if (dir && (ed || au || op)) {
    // 只看导演的「正面推荐」是否提出留白/慢；risks 里的「别留白」不算提出。
    const dirSlow = hit(txt(dir.recommendations), /留白|呼吸|慢|铺垫/);
    const othersWantFast = [ed, au, op].some((j) => j && hit(txt(j.recommendations, j.risks, j.objections), /划走|拖沓|掉留存|信息|前2秒|前3秒|紧凑|快/));
    if (dirSlow && othersWantFast) {
      const winner: Role = au && hit(txt(au.objections, au.risks), /不理解|划走|自嗨/) ? "AUDIENCE" : ed ? "EDITOR" : "OPERATOR";
      conflicts.push({
        conflictType: "pacing",
        roles: ["DIRECTOR", winner],
        evidence: [dir.conclusion, winner === "AUDIENCE" ? au?.conclusion ?? "" : winner === "EDITOR" ? ed?.conclusion ?? "" : op?.conclusion ?? ""].filter(Boolean),
        severity: Math.round((0.4 + (weights[winner] ?? 0) * 0.6) * 100) / 100,
        resolution: winner === "AUDIENCE" ? "前3秒保证信息承诺，再用情绪/细节做氛围" : "缩短留白，前2秒给钩子",
        winner,
        reason: `${winner}（权重 ${weights[winner] ?? 0}）在高留存判断上更关键`,
        unresolved: false,
      });
    }
  }

  // Director ↔ Operator：叙事情绪（留白/慢） vs 市场增长（涨粉/转化/强 CTA）
  if (dir && op) {
    const dirSlow = hit(txt(dir.recommendations), /留白|慢节奏|铺陈|情绪/);
    const market =
      hit(txt(op.conclusion, op.recommendations), /涨粉|转化|CTA|点击|蹭|热点|抢/) ||
      hit(facts.goal || "", /涨粉|转化|流量|带货|涨粉/);
    if (dirSlow && market) {
      conflicts.push({
        conflictType: "narrative_vs_market",
        roles: ["DIRECTOR", "OPERATOR"],
        evidence: [dir.conclusion, op.conclusion].filter(Boolean),
        severity: 0.7,
        resolution: "保留叙事情绪，但前2秒给出市场钩子，避免情绪成为留存黑洞",
        winner: "OPERATOR",
        reason: "运营在平台增长点上有更强证据",
        unresolved: false,
      });
    }
  }

  // Director ↔ Editor：叙事情绪 vs 剪辑信息密度/节奏
  if (dir && ed) {
    const dirSlow = hit(txt(dir.recommendations), /留白|慢节奏|铺陈|情绪/);
    const edFast = hit(txt(ed.recommendations), /紧凑|信息密度|逐镜头|降低时长|控制时长|1~3|高信息|更快/);
    if (dirSlow && edFast) {
      conflicts.push({
        conflictType: "narrative_vs_editing",
        roles: ["DIRECTOR", "EDITOR"],
        evidence: [dir.conclusion, ed.conclusion].filter(Boolean),
        severity: 0.75,
        resolution: "把留白压缩到可为情绪留余地的极限（约0.8~1.5秒），保住信息密度",
        winner: "EDITOR",
        reason: "剪辑在实际节奏上有更强技术证据",
        unresolved: false,
      });
    }
  }

  // 2) Producer 否决：明显不可执行 / 投入产出比过低
  if (prod && hit(txt(prod.objections, prod.conclusion), /不可执行|投入产出/)) {
    conflicts.push({
      conflictType: "feasibility_veto",
      roles: ["PRODUCER", "DIRECTOR"],
      evidence: prod.objections,
      severity: 1,
      resolution: "降级为单人/单场景/手机可执行方案，控制拍摄镜头数与成本",
      winner: "PRODUCER",
      reason: "制片否决：方案超出用户预算/时间约束（否决必须有理由）",
      unresolved: false,
    });
  }

  // 3) Editor 技术否决：素材不足却要做复杂方案
  if (ed && ed.evidenceSource === "no_data") {
    conflicts.push({
      conflictType: "technical_veto",
      roles: ["EDITOR", "DIRECTOR"],
      evidence: ["materials 未明确（NO_DATA）"],
      severity: 0.9,
      resolution: "用现有素材简化实现，缺近景/镜头时用字幕/音效/B-roll 补",
      winner: "EDITOR",
      reason: "剪辑否决：技术无法在当前素材条件实现（必须有理由）",
      unresolved: false,
    });
  }

  // 4) Audience 风险：用户理解 / 自嗨
  // 只有 actual objection（情绪类内容才产生）才算观众风险；泛化 risk 不算冲突。
  if (au && hit(txt(au.objections), /不理解|自嗨|划走|拖沓/)) {
    const strong = !!facts.audience || !!facts.content_type;
    conflicts.push({
      conflictType: "audience_risk",
      roles: ["AUDIENCE", "DIRECTOR"],
      evidence: au.objections,
      severity: strong ? 0.8 : 0.4,
      resolution: strong ? "优先保证用户可理解，再保留创作表达" : "证据不足，采用保守方案（先给信息、少留白）",
      winner: strong ? "AUDIENCE" : null,
      reason: strong ? "观众研究否决：用户可能不理解" : "证据不足，不强行裁决",
      unresolved: !strong,
    });
  }

  return conflicts;
}

/** 汇总冲突：是否有硬性否决（severity>=0.9 且 winner 在否决集内）。 */
export function hasVeto(conflicts: CreativeConflict[]): boolean {
  return conflicts.some((c) => c.severity >= 0.9 && c.winner);
}

export function summaryReason(conflicts: CreativeConflict[]): string {
  if (!conflicts.length) return "无主要冲突";
  const hard = conflicts.filter((c) => c.severity >= 0.9);
  if (hard.length) return `硬性否决：${hard.map((c) => `${c.winner} 否决（${c.conflictType}）`).join("；")}`;
  const undc = conflicts.filter((c) => c.unresolved);
  if (undc.length) return "存在证据不足的冲突，采用保守方案";
  return `已仲裁：${conflicts.map((c) => `${c.conflictType}→${c.winner ?? "保守"}`).join("；")}`;
}
