"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { OnboardingQuiz } from "@/components/onboarding-quiz";
import { getProfile } from "@/lib/onboarding";
import type { OnboardingProfile } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [isEdit, setIsEdit] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  // 等客户端确定 edit 参数后再渲染问卷，确保初始值能正确回填
  React.useEffect(() => {
    setIsEdit(new URLSearchParams(window.location.search).get("edit") === "1");
    setReady(true);
  }, []);

  function handleComplete(profile: OnboardingProfile) {
    // 编辑态：保存后回到「我的」；创建态：去分析页
    router.push(isEdit ? "/profile" : "/analyze");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航条 */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-sm font-semibold tracking-tight">爆款研究所</span>
          <a
            href={isEdit ? "/profile" : "/"}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isEdit ? "返回我的" : "返回首页"}
          </a>
        </div>
      </header>

      {ready ? (
        <OnboardingQuiz
          onComplete={handleComplete}
          initialProfile={isEdit ? getProfile() ?? undefined : undefined}
          editMode={isEdit}
        />
      ) : (
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {/* 底部说明 */}
      <div className="mx-auto max-w-2xl px-4 pb-16 text-center sm:px-6">
        <p className="text-xs text-muted-foreground leading-relaxed">
          你填的每一项都会影响后续的分析报告——剪辑基础决定建议深度，
          内容类型决定拆解角度，痛点决定优先改进项。
          这些档案信息当前保存在本设备，用于定制你的分析报告；正式创作资产（报告、分镜、拍摄计划）保存在账号云端。
        </p>
      </div>
    </div>
  );
}
