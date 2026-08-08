import Link from "next/link";
import { Logo } from "@/components/logo";

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
            <li><Link href="/pricing" className="hover:text-foreground">价格</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">资源</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/help" className="hover:text-foreground">帮助中心</Link></li>
            <li><Link href="/#about" className="hover:text-foreground">关于我们</Link></li>
            <li><Link href="/profile" className="hover:text-foreground">我的 AI 导演</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">联系</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>hello@viralstudio.ai</li>
            <li>商务合作 / 媒体咨询</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} 爆款研究所 · AI 短视频导演. 保留所有权利。</span>
          <span>本网站为 MVP Demo，分析结果为模拟数据。</span>
        </div>
      </div>
    </footer>
  );
}
