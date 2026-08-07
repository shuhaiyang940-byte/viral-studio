"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { OnboardingQuiz } from "@/components/onboarding-quiz";
import type { OnboardingProfile } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();

  function handleComplete(profile: OnboardingProfile) {
    // 保存后跳转到分析页
    router.push("/analyze");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航条 */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-sm font-semibold tracking-tight">爆款研究所</span>
          <a
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            返回首页
          </a>
        </div>
      </header>

      <OnboardingQuiz onComplete={handleComplete} />

      {/* 底部说明 */}
      <div className="mx-auto max-w-2xl px-4 pb-16 text-center sm:px-6">
        <p className="text-xs text-muted-foreground leading-relaxed">
          你填的每一项都会影响后续的分析报告——剪辑基础决定建议深度，
          内容类型决定拆解角度，痛点决定优先改进项。
          所有数据只存在你的浏览器本地，不会上传到任何服务器。
        </p>
      </div>
    </div>
  );
}
