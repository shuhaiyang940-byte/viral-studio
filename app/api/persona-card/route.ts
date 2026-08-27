import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPersonaCard, savePersonaCard } from "@/lib/persona";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const card = await getPersonaCard(user.id);
  return NextResponse.json({ card });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const card = await savePersonaCard(user.id, {
    personaTags: Array.isArray(body.personaTags) ? body.personaTags.map((x: any) => String(x)).slice(0, 8) : [],
    resources: Array.isArray(body.resources) ? body.resources.map((x: any) => String(x)).slice(0, 8) : [],
    timing: String(body.timing || "").slice(0, 200),
    accountData: body.accountData && typeof body.accountData === "object" ? body.accountData : {},
    platform: String(body.platform || "").slice(0, 50),
    audience: String(body.audience || "").slice(0, 120),
    learnings: Array.isArray(body.learnings) ? body.learnings.map((x: any) => String(x)).slice(0, 20) : [],
  });
  return NextResponse.json({ card });
}
