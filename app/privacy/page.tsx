import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隐私政策 · 爆款研究所",
  description: "爆款研究所的隐私政策：我们收集什么数据、如何使用、如何删除。",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">隐私政策</h1>
      <p className="mt-2 text-sm text-muted-foreground">生效日期：2026 年 8 月 24 日</p>

      <Section title="我们是谁">
        <p>
          爆款研究所（viral-studio）是一款面向短视频创作者的 AI 分析工具（下称「本服务」）。
          当前处于免费公测阶段。如你对本政策有任何疑问，可发送邮件至
          hello@viralstudio.ai 联系我们。
        </p>
      </Section>

      <Section title="我们收集哪些信息">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>账号信息：</strong>注册邮箱、密码哈希（bcrypt 加密存储，不保存明文）、昵称；可选手机号（绑定手机时提供）。
          </li>
          <li>
            <strong>分析输入：</strong>你粘贴的视频标题、链接，以及你主动上传用于分析的视频文件。
            上传的视频仅用于本次分析，处理完成后立即从服务器删除。
          </li>
          <li>
            <strong>创作资产：</strong>你的分析报告、分镜、拍摄计划、创作历史，保存在账号云端，登录后跨设备可访问。
            用于个性化建议的新手档案信息（剪辑基础、内容方向）暂时保存在本设备，可在「个人中心」修改。
          </li>
          <li>
            <strong>基础日志：</strong>为保障安全与防刷，我们会记录访问 IP、请求时间、接口路径；封禁名单会保留 IP 与到期时间。
          </li>
        </ul>
      </Section>

      <Section title="我们如何使用这些信息">
        <ul className="list-disc space-y-2 pl-5">
          <li>提供账号登录、分析报告、案例收藏、找回密码等核心功能；</li>
          <li>调用第三方 AI 服务（千问 / DeepSeek）生成分析结果——只会发送分析所需的最小必要内容（标题、类型、画面帧摘要）；</li>
          <li>通过 IP 限流与封禁保护服务不被滥用；</li>
          <li>在征得你同意前，不会将你的个人信息用于广告营销或出售给第三方。</li>
        </ul>
      </Section>

      <Section title="我们委托处理数据的服务商">
        <ul className="list-disc space-y-2 pl-5">
          <li>Neon（Postgres 数据库）：存储账号与业务数据；</li>
          <li>阿里云 DashScope / DeepSeek：AI 分析；</li>
          <li>Resend 或同类邮件服务：发送验证 / 重置邮件（如你配置启用）；</li>
          <li>Vercel 或同类托管平台：网站运行与日志。</li>
        </ul>
        <p>以上服务商仅在处理本服务所需数据的范围内接触你的信息，并受其自身隐私政策约束。</p>
      </Section>

      <Section title="数据保留与删除">
        <p>
          你可以随时在「个人中心」查看你的账号信息。删除账号：发送邮件至
          hello@viralstudio.ai（注明注册邮箱），我们会在 15 个工作日内删除账号及相关数据。
          正式创作资产保存在账号云端，删除账号即一并清除；浏览器本地缓存的界面状态可随时通过清除浏览器站点数据移除。
        </p>
      </Section>

      <Section title="Cookie 与会话">
        <p>
          我们使用 HttpOnly + SameSite 的会话 Cookie 维持登录状态，不使用第三方广告追踪 Cookie。
          你可以通过浏览器设置清除 Cookie，但清除后需要重新登录。
        </p>
      </Section>

      <Section title="未成年人">
        <p>
          本服务面向创作者，不针对 14 周岁以下未成年人。如你发现未成年人未经监护人同意使用本服务并提供信息，
          请联系我们删除。
        </p>
      </Section>

      <Section title="政策更新">
        <p>
          本政策可能随产品与法规变化更新，重大变更会通过站内公告或邮件通知。继续使用本服务即视为接受更新后的政策。
        </p>
      </Section>
    </div>
  );
}
