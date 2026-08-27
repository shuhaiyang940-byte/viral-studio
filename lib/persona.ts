// 账号定位档案（P1-①）：策略顾问的地基。用户级，可持久化；learnings 供第 5 环飞轮回流。
import { randomUUID } from "node:crypto";
import { q, hasDatabase } from "./db";

export interface PersonaCard {
  id: string;
  userId: string;
  personaTags: string[];
  resources: string[];
  timing: string;
  accountData: Record<string, unknown>;
  platform: string;
  audience: string;
  learnings: string[];
  createdAt: string;
  updatedAt: string;
}

const P_COLS =
  "id, user_id, persona_tags, resources, timing, account_data, platform, audience, learnings, created_at, updated_at";

function mapCard(r: Record<string, any>): PersonaCard {
  const arr = (v: unknown): string[] => {
    if (Array.isArray(v)) return v;
    try { const x = JSON.parse(String(v || "[]")); return Array.isArray(x) ? x : []; } catch { return []; }
  };
  return {
    id: r.id,
    userId: r.user_id,
    personaTags: arr(r.persona_tags),
    resources: arr(r.resources),
    timing: r.timing || "",
    accountData: typeof r.account_data === "object" && r.account_data ? r.account_data : {},
    platform: r.platform || "",
    audience: r.audience || "",
    learnings: arr(r.learnings),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getPersonaCard(userId: string): Promise<PersonaCard | null> {
  if (!hasDatabase()) return null;
  const rows = await q<Record<string, any>>(`SELECT ${P_COLS} FROM persona_cards WHERE user_id = $1`, [userId]);
  return rows[0] ? mapCard(rows[0]) : null;
}

export async function savePersonaCard(
  userId: string,
  input: {
    personaTags?: string[];
    resources?: string[];
    timing?: string;
    accountData?: Record<string, unknown>;
    platform?: string;
    audience?: string;
    learnings?: string[];
  }
): Promise<PersonaCard | null> {
  if (!hasDatabase()) return null;
  const id = randomUUID();
  await q(
    `INSERT INTO persona_cards (id, user_id, persona_tags, resources, timing, account_data, platform, audience, learnings)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (user_id) DO UPDATE SET
       persona_tags = EXCLUDED.persona_tags,
       resources = EXCLUDED.resources,
       timing = EXCLUDED.timing,
       account_data = EXCLUDED.account_data,
       platform = EXCLUDED.platform,
       audience = EXCLUDED.audience,
       learnings = EXCLUDED.learnings,
       updated_at = now()`,
    [id, userId, JSON.stringify(input.personaTags ?? []), JSON.stringify(input.resources ?? []),
     input.timing ?? "", JSON.stringify(input.accountData ?? {}), input.platform ?? "",
     input.audience ?? "", JSON.stringify(input.learnings ?? [])]
  );
  return getPersonaCard(userId);
}

export async function addPersonaLearning(userId: string, learning: string): Promise<void> {
  if (!hasDatabase()) return;
  await q(
    `UPDATE persona_cards SET learnings = learnings || $2::jsonb, updated_at = now() WHERE user_id = $1`,
    [userId, JSON.stringify([learning])]
  );
}
