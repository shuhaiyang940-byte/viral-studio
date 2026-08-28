/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // 允许直连 Vercel Blob 存储做视频/截图上传（浏览器 XHR 跨域 PUT 需要）。
      // 放宽到 https: 以彻底排除 CSP 对跨域上传的拦截（connect-src 控制 fetch/XHR）。
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // ffmpeg-static 是带二进制的外部包，必须让 Vercel 追踪并保留（否则函数里找不到可执行文件）
  serverExternalPackages: ["ffmpeg-static"],
  experimental: {
    // 显式把 ffmpeg-static 二进制包含进该函数（Vercel 默认追踪可能忽略大二进制）
    outputFileTracingIncludes: {
      "/api/diagnosis/slice-analyze": ["./node_modules/ffmpeg-static/**"],
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
