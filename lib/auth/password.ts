import bcrypt from "bcryptjs";

/** 哈希密码（bcrypt，cost=10，纯 JS 无原生编译依赖） */
export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

/** 校验明文密码与哈希是否匹配 */
export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
