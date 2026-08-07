# 爆款研究所 · Viral Studio AI

面向普通短视频创作者的 AI 视频拆解 SaaS（MVP Demo）。

上传一个视频或粘贴链接，AI 自动生成「爆款拆解报告」：爆款评分、为什么火、结构拆解、可复制模板、标题优化、拍摄建议。

> ⚠️ 当前为 MVP Demo：**分析结果为模拟数据（Mock）**，用于演示完整产品流程，不代表真实 AI 分析结论。

## 技术栈

- **前端 / 全栈**：Next.js 15（App Router）+ React 19 + TypeScript
- **样式**：Tailwind CSS v4 + shadcn 风格组件 + Lucide 图标
- **深色模式**：next-themes（系统 / 浅色 / 深色）
- **后端 API**：Next.js Route Handlers（`/app/api/*`）
- **AI 接入**：统一适配器，默认 Mock，可切换 OpenAI / DeepSeek / Claude

## 快速开始

```bash
# 安装依赖
npm install

# 本地开发
npm run dev
# 打开 http://localhost:3000
```

## 构建与生产

```bash
npm run build
npm run start
```

## 环境变量

复制 `.env.example` 为 `.env.local` 并按需填写：

```bash
cp .env.example .env.local
```

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `AI_PROVIDER` | `mock` / `openai` / `deepseek` / `claude` | `mock` |
| `OPENAI_API_KEY` | OpenAI Key | - |
| `OPENAI_MODEL` | 如 `gpt-4o` | `gpt-4o` |
| `DEEPSEEK_API_KEY` | DeepSeek Key | - |
| `DEEPSEEK_MODEL` | 如 `deepseek-chat` | `deepseek-chat` |
| `CLAUDE_API_KEY` | Anthropic Key | - |
| `CLAUDE_MODEL` | 如 `claude-3-5-sonnet-...` | - |

> 不设任何 Key 时，系统默认走 Mock，保证 Demo 永远可运行；真实接口异常时也会自动回退 Mock。

## 部署到 Vercel

1. 推送代码到 Git 仓库（GitHub / GitLab / Bitbucket）。
2. 在 [Vercel](https://vercel.com) 导入该仓库，框架自动识别为 Next.js。
3. （可选）在 Vercel 项目设置中添加上述环境变量。
4. 点击 Deploy。

也可直接 `npx vercel` 命令行部署。

## 目录结构

```
app/
  layout.tsx          根布局（主题 / 导航 / 页脚）
  page.tsx            首页 Landing
  analyze/page.tsx    视频分析页（上传 / 链接 / 流水线）
  report/page.tsx     报告页（服务端读取 id）
  library/page.tsx    爆款案例库
  profile/page.tsx    个人中心
  api/                Mock 后端接口
    analyze/          生成结构化报告
    library/          案例列表
    history/          历史记录
    auth/             登录注册（Mock）
components/           UI 组件 + 业务组件
lib/
  ai/                 AI 适配器（mock / openai / deepseek / claude）
  mock-data.ts        Mock 数据
  storage.ts          本地记录（localStorage）
  types.ts            领域类型
  utils.ts            cn / 格式化
```

## MVP 范围

✅ 用户注册登录（Mock） · ✅ 上传视频 / 链接 · ✅ AI 分析 · ✅ 生成报告 · ✅ 保存历史记录

后续阶段：账号分析（高级会员）、AI 选题助手、AI 创作工作流。
