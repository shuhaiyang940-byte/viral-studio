import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white shadow-sm">
        <Sparkles className="h-4 w-4" />
      </span>
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-tight">爆款研究所</span>
          <span className="text-[10px] font-medium text-muted-foreground">Viral Studio AI</span>
        </span>
      )}
    </Link>
  );
}
