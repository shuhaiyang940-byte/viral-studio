import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            AI 帮你拆解爆款视频，普通人也能找到爆款规律。
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">产品</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/analyze" className="hover:text-foreground">AI分析</Link></li>
            <li><Link href="/library" className="hover:text-foreground">案例库</Link></li>
            <li><Link href="/find-peer" className="hover:text-foreground">找对标</Link></li>
            <li><Link href="/studio" className="hover:text-foreground">智能剪辑</Link></li>
            <li><Link href="/pricing" className="hover:text-foreground">价格</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">资源</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/help" className="hover:text-foreground">帮助中心</Link></li>
            <li><Link href="/#about" className="hover:text-foreground">关于我们</Link></li>
            <li><Link href="/profile" className="hover:text-foreground">个人中心</Link></li>
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
          <span>© {new Date().getFullYear()} 爆款研究所 Viral Studio AI. 保留所有权利。</span>
          <span>本网站为 MVP Demo，分析结果为模拟数据。</span>
        </div>
      </div>
    </footer>
  );
}
