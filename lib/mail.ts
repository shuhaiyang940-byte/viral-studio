/**
 * 邮件发送抽象层。
 *
 * 支持两种模式：
 *  - Resend（推荐）：设置 RESEND_API_KEY 后真实发信，发件地址用 EMAIL_FROM
 *    （默认 onboarding@resend.dev，仅限 Resend 测试；正式请绑自己的域名）。
 *  - 控制台（开发）：未配置任何邮件服务时，把邮件内容打到服务端日志，
 *    接口在非生产环境返回 devLink 便于本地测试；生产环境不会泄露链接。
 *
 * 国内替代：阿里云邮件推送 / 腾讯云 SES，接入时在 sendMail 里加一个分支即可。
 */

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export type MailResult =
  | { ok: true; method: "resend" | "console"; id?: string }
  | { ok: false; method?: never; error: string };

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * 是否允许把「控制台模式」邮件链接带回 API 响应。
 * 生产环境默认禁止（防泄露）；本地 / 预发联调可设 MAIL_DEV_LINKS=1。
 */
export function shouldExposeDevLink(method: string): boolean {
  return method === "console" && (process.env.NODE_ENV !== "production" || process.env.MAIL_DEV_LINKS === "1");
}

export async function sendMail(payload: MailPayload): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "爆款研究所 <onboarding@resend.dev>",
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          ...(payload.text ? { text: payload.text } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `邮件发送失败（Resend ${res.status}）：${body.slice(0, 200)}` };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: true, method: "resend", id: data?.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "邮件发送异常" };
    }
  }

  // 开发模式：不打日志会让人以为邮件丢了，这里明确输出
  console.log(
    `\n[mail:dev] 收件人 ${payload.to}\n[mail:dev] 主题 ${payload.subject}\n[mail:dev] 内容\n${payload.html}\n`
  );
  return { ok: true, method: "console" };
}
