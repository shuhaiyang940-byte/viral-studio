import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: "爆款研究所 | AI 短视频策略顾问",
  description:
    "AI 短视频策略顾问：填账号定位 + 选对标，算出你的原创爆款脚本，自带分镜、音效、声音设计；拍完回传数据复盘，越拍越准。",
  keywords: ["短视频", "爆款", "AI 拆解", "分镜", "口播文案", "抖音", "小红书", "视频号"],
  openGraph: {
    title: "爆款研究所 | AI 短视频策略顾问",
    description:
      "从你的账号定位出发生成原创爆款脚本：策略说明 + 分镜 + 音效 + 声音设计，拍完复盘写回档案，越拍越准。",
    type: "website",
    locale: "zh_CN",
    siteName: "爆款研究所",
  },
  twitter: {
    card: "summary",
    title: "爆款研究所 | AI 短视频策略顾问",
    description: "填定位 + 选对标 → 你的原创爆款脚本 → 拍完复盘，越拍越准。",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
