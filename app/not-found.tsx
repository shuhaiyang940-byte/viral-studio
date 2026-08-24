import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-black tracking-tight text-primary/20">404</p>
      <h1 className="mt-4 text-xl font-bold">这一页没找到</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        可能链接已失效，或者页面还在建设中。回首页继续探索爆款规律吧。
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild variant="gradient">
          <Link href="/">返回首页</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/analyze">去分析</Link>
        </Button>
      </div>
    </div>
  );
}
