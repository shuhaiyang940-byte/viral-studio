import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "关于我们 · 爆款研究所",
  description: "爆款研究所的产品理念：不追求一百分，先把三十分做到七十分。",
};

const PRINCIPLES = [
  {
    title: "普通人也值得被认真对待",
    desc: "巨量创意、蝉妈妈们服务的是达人和直播机构。但长尾里的大量普通创作者，同样值得一套能用的方法论。",
  },
  {
    title: "不做一百分，先做七十分",
    desc: "三十分的作品先变成七十分，六十分的作品做到九十分。每一步都讲人话，给出能照做的清单。",
  },
  {
    title: "手把手，不空谈",
    desc: "不说「提升完播率」这种正确的废话。直接告诉你：这一镜怎么拍、这句台词怎么念、换成你的主题怎么改。",
  },
  {
    title: "诚实标注边界",
    desc: "哪些是真实 AI 分析、哪些是演示数据，我们会在产品里如实标注，不拿模拟数据冒充结论。",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">关于爆款研究所</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        爆款研究所是一款面向普通短视频创作者的 AI 拆解工具：把别人的爆款拆成镜头脚本，
        再翻译成属于你的版本，手把手教你拍。我们相信，爆款不是玄学，而是可以被拆解、学习和复制的结构。
      </p>

      <div className="mt-10 space-y-4">
        {PRINCIPLES.map((p, i) => (
          <div key={p.title} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {i + 1}
              </span>
              <h2 className="text-base font-bold">{p.title}</h2>
            </div>
            <p className="mt-2 pl-11 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <h2 className="text-lg font-bold">当前状态</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>· Beta 免费公测：核心创作功能免费开放；</li>
          <li>· 邮箱验证、找回密码已上线；</li>
          <li>· 上传视频支持真实画面理解（抽帧 + 视觉模型），转写能力随部署环境逐步启用；</li>
          <li>· 数据与隐私详见<a href="/privacy" className="text-primary hover:underline">隐私政策</a>。</li>
        </ul>
        <div className="mt-5">
          <Button asChild variant="gradient">
            <Link href="/analyze">免费体验</Link>
          </Button>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        联系与合作：hello@viralstudio.ai
      </p>
    </div>
  );
}
