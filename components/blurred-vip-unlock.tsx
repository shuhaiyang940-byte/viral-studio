"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BlurredVipUnlockCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/50 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold">导演级避坑 & 情绪曲线</p>
        <p className="text-xs text-muted-foreground">开通后解锁完整版</p>
      </div>

      {/* 上半：可见内容 */}
      <div className="space-y-2">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">避坑 1：</span>第 02 镜语速别慢，否则完播率暴跌。
        </div>
        {/* 伪情绪曲线 */}
        <svg viewBox="0 0 200 60" className="h-16 w-full text-primary/60">
          <path d="M0,45 C30,45 40,15 70,20 C100,25 110,12 140,28 C170,42 180,30 200,18" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      {/* 下半：模糊锁 */}
      <div className="relative mt-3">
        <div className="pointer-events-none space-y-2 blur-sm" aria-hidden>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">避坑 2：</span>开场前 3 秒别自报家门。
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">避坑 3：</span>结尾叠两个 CTA 反而没人点。
          </div>
        </div>

        {/* 渐隐遮罩 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-transparent via-card/70 to-card/95 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-lg shadow-primary/20"
          >
            <Lock className="h-5 w-5 text-primary" />
          </motion.div>
          <p className="max-w-[240px] text-xs text-muted-foreground">
            已解锁该爆款的 3 个隐形避坑 & 导演级分镜表
          </p>
          <Button asChild size="sm" variant="gradient" className="gap-1.5">
            <Link href="/pricing?feature=storyboard">
              <Sparkles className="h-3.5 w-3.5" /> 开通创作者 VIP 查看
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
