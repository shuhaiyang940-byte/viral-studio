// 把 Creative Intent 落地到 Storyboard / Plan（仅做约束/剪辑建议，不改变核心）。
// 兼容：无 intent 时原样返回；有 intent 时按团队硬约束收窄。

import type { CreativeIntent } from "./types";
import { intentShotRules } from "./intent";

export function applyIntentToShots<T extends { index?: number; durationSec?: number; no?: string }>(
  shots: T[],
  intent?: CreativeIntent
): T[] {
  if (!intent) return shots;
  const { maxShots, maxShotSec } = intentShotRules(intent);
  let out = shots;
  if (maxShots != null) out = out.slice(0, maxShots);
  if (maxShotSec != null) {
    out = out.map((s) => ({ ...s, durationSec: Math.min(s.durationSec ?? maxShotSec, maxShotSec) })) as T[];
  }
  return out;
}

export function applyIntentToPlan<T extends { durationSec?: number; note?: string }>(
  clips: T[],
  intent?: CreativeIntent
): { clips: T[]; note: string | null } {
  if (!intent) return { clips, note: null };
  const { maxShots, maxShotSec } = intentShotRules(intent);
  let out = clips;
  if (maxShots != null) out = out.slice(0, maxShots);
  if (maxShotSec != null) {
    out = out.map((c) => ({ ...c, durationSec: Math.min(c.durationSec ?? maxShotSec, maxShotSec) })) as T[];
  }
  const note = [
    intent.editing_intent && `剪辑参考：${intent.editing_intent}`,
    intent.audience_intent && `观众参考：${intent.audience_intent}`,
    intent.hard_constraints.length && `硬约束：${intent.hard_constraints.join("；")}`,
  ].filter(Boolean).join(" ｜ ") || null;
  return { clips: out, note };
}
