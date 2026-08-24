import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "服务条款 · 爆款研究所",
  description: "爆款研究所的服务条款与使用约定。",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">服务条款</h1>
      <p className="mt-2 text-sm text-muted-foreground">生效日期：2026 年 8 月 24 日</p>

      <Section title="1. 服务说明">
        <p>
          爆款研究所提供短视频拆解、文案生成、热点追踪等 AI 辅助创作工具。
          当前为<b>免费公测阶段</b>，会员功能建设中，暂不收费；公测期间服务可能随时调整或终止，恕不另行赔偿。
        </p>
      </Section>

      <Section title="2. 账号与安全">
        <ul className="list-disc space-y-2 pl-5">
          <li>你应妥善保管账号密码，对账号下发生的操作负责；</li>
          <li>请勿批量注册、利用接口刷取分析额度、绕过 IP 限流与封禁；</li>
          <li>如发现账号被盗或异常，请及时修改密码并联系我们。</li>
        </ul>
      </Section>

      <Section title="3. 内容与合规">
        <ul className="list-disc space-y-2 pl-5">
          <li>你上传或输入的内容应为你拥有合法权利或已获授权的内容；</li>
          <li>请勿上传违法、侵权、色情、暴力或侵犯他人隐私的内容；</li>
          <li>AI 生成的分析、文案、分镜仅供创作参考，请结合平台规则与法律法规自行判断后使用。</li>
        </ul>
      </Section>

      <Section title="4. AI 结果免责声明">
        <p>
          AI 生成内容可能不准确或不完整。爆款评分、播放量预估等均为模型推断，不构成任何承诺或数据事实。
          上传视频的「画面理解」依赖本机/运行环境能力与视觉模型，可能存在失败或偏差。请勿仅凭 AI
          结果做出重大决策。
        </p>
      </Section>

      <Section title="5. 知识产权">
        <p>
          本服务的界面、文案、代码与设计归爆款研究所所有。你在本服务生成的内容归你所有；
          案例库中的示例数据仅用于产品演示。
        </p>
      </Section>

      <Section title="6. 服务变更与终止">
        <p>
          我们可能随时调整或下线功能、修改条款。重大变更会提前公告；你继续使用服务即视为接受变更。
          违反本条款可能导致账号被限制或封禁。
        </p>
      </Section>

      <Section title="7. 法律适用与争议">
        <p>
          本条款适用中华人民共和国法律。因本服务产生的争议，双方应友好协商；协商不成的，向服务运营方所在地有管辖权的人民法院提起诉讼。
        </p>
      </Section>

      <Section title="8. 联系我们">
        <p>邮件：hello@viralstudio.ai</p>
      </Section>
    </div>
  );
}
