import Link from "next/link";
import { Logo } from "@/components/logo";
import { BETA_OPEN } from "@/lib/beta";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            你的 AI 短视频导演：上传爆款视频，拆解为什么火、怎么复制成你的下一条。
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">产品</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/analyze" className="hover:text-foreground">爆款拆解</Link></li>
            <li><Link href="/library" className="hover:text-foreground">案例库</Link></li>
            <li><Link href="/find-peer" className="hover:text-foreground">找对标</Link></li>
            <li><Link href="/pricing" className="hover:text-foreground">{BETA_OPEN ? "公测说明" : "会员方案"}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">关于</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/help" className="hover:text-foreground">帮助中心</Link></li>
            <li><Link href="/about" className="hover:text-foreground">关于我们</Link></li>
            <li><Link href="/profile" className="hover:text-foreground">我的 AI 导演</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">合规</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/privacy" className="hover:text-foreground">隐私政策</Link></li>
            <li><Link href="/terms" className="hover:text-foreground">服务条款</Link></li>
            <li><a href="mailto:hello@viralstudio.ai" className="hover:text-foreground">联系：hello@viralstudio.ai</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} 爆款研究所 · AI 短视频导演. 保留所有权利。</span>
          <span>
            {BETA_OPEN
              ? "Beta 公测中 · 核心创作功能限时免费开放"
              : "分析结果由 AI 生成，请结合自身情况判断"}
          </span>
        </div>
      </div>
    </footer>
  );
}
