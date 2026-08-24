import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: "爆款研究所 | 你的 AI 短视频导演",
  description:
    "上传一个爆款视频，AI 爆款导演帮你拆解：为什么火、爆款结构是什么、哪些能复制、怎么变成你的下一条内容。",
  keywords: ["短视频", "爆款", "AI 拆解", "分镜", "口播文案", "抖音", "小红书", "视频号"],
  openGraph: {
    title: "爆款研究所 | 你的 AI 短视频导演",
    description:
      "把别人的爆款拆成你的镜头脚本：逐镜头拆解 + 换成你的主题怎么拍，手把手教你把三十分做到七十分。",
    type: "website",
    locale: "zh_CN",
    siteName: "爆款研究所",
  },
  twitter: {
    card: "summary",
    title: "爆款研究所 | 你的 AI 短视频导演",
    description: "把别人的爆款，拆成你的镜头脚本。",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
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
