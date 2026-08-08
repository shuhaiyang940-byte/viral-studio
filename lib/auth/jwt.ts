import { SignJWT, jwtVerify } from "jose";

/** 会话载荷（不含敏感信息，仅用于标识用户身份与等级） */
export interface SessionPayload {
  /** 用户 id（users 表主键） */
  sub: string;
  email: string;
  name: string;
  /** 会员等级 free | pro | premium */
  tier: string;
}

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET 未配置（请在 .env.local 或 Vercel 环境变量中设置）");
  return new TextEncoder().encode(s);
}

/** 签发会话 JWT（HS256，30 天有效） */
export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ email: p.email, name: p.name, tier: p.tier })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

/** 校验会话 JWT，失败抛错 */
export async function verifySession(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    sub: String(payload.sub),
    email: String(payload.email),
    name: String(payload.name),
    tier: String(payload.tier),
  };
}
