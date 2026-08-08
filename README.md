# 爆款研究所 · Viral Studio AI

面向普通短视频创作者的 AI 视频拆解 SaaS。

上传视频或粘贴链接，AI 生成「爆款拆解报告」：爆款评分、为什么火、结构拆解、可复制模板、标题优化、拍摄建议；并配套案例库、找对标、文案生成、分镜与剪辑方案。

## 技术栈

- **前端 / 全栈**：Next.js 15（App Router）+ React 19 + TypeScript（strict）
- **样式**：Tailwind CSS v4 + shadcn 风格组件 + Lucide 图标
- **深色模式**：next-themes（系统 / 浅色 / 深色）
- **后端 API**：Next.js Route Handlers（`app/api/*`）
- **数据库**：Neon Postgres（`@neondatabase/serverless`，HTTP 驱动，参数化 SQL）
- **账号体系**：邮箱 + 密码 → bcryptjs 加盐哈希 → jose 签发 JWT（HS256）→ HttpOnly Cookie
- **AI 接入**：统一适配器，千问 Qwen（理解层）+ DeepSeek（生成层），可回退 Mock

## 快速开始

```bash
npm install
cp .env.example .env.local   # 填入 DATABASE_URL / JWT_SECRET 等
npm run dev                  # http://localhost:3000
```

## 构建与生产

```bash
npm run build
npm run start
```

## 环境变量

| 变量 | 说明 | 是否必填 |
| --- | --- | --- |
| `DATABASE_URL` | Neon Postgres 连接串（`?sslmode=require`） | 账号功能必填 |
| `JWT_SECRET` | 会话签名密钥，随机长串。改动会让所有人被登出 | 账号功能必填 |
| `SEED_TOKEN` | 保护 `/api/seed` 的口令；不设置则该接口直接拒绝 | 建议填 |
| `ALLOW_DEMO_UPGRADE` | 设 `1` 才允许「不付费直接升会员」（仅内测/演示）。**正式环境务必留空** | 否 |
| `AI_PROVIDER` | `mock` / `qwen` / `deepseek` / `openai` / `claude` | 否（默认 mock） |
| `QWEN_API_KEY` · `QWEN_MODEL` · `QWEN_VL_MODEL` | 千问（DashScope 兼容 OpenAI 协议） | 否 |
| `DEEPSEEK_API_KEY` · `DEEPSEEK_MODEL` | DeepSeek | 否 |
| `LLM_API_KEY` | 通用兜底 Key | 否 |
| `OPENAI_API_KEY` / `CLAUDE_API_KEY` | 可选备用 | 否 |

生成 `JWT_SECRET`：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> **无数据库也能跑**：所有接口都做了优雅降级——未配置 `DATABASE_URL` 时，案例库 / 找对标返回内置种子数据（响应里带 `db:false`），注册登录返回 503 并提示未配置。演示不会白屏。

## 部署到 Vercel

1. 在 [neon.tech](https://neon.tech) 建一个免费 Postgres，复制连接串。
2. 推送代码到 Git 仓库，在 Vercel 导入（自动识别 Next.js）。
3. 在 Vercel → Settings → Environment Variables 添加：
   `DATABASE_URL`、`JWT_SECRET`、`SEED_TOKEN`（以及需要的 AI Key）。
4. Deploy。
5. **首次部署后执行一次种子导入**（幂等，可重复跑）：

   ```bash
   curl "https://你的域名/api/seed?token=<SEED_TOKEN>"
   # → {"ok":true,"cases":12,"benchmarks":14}
   ```

   表结构由 `ensureSchema()` 自动创建，无需手动建表。

## 数据表

| 表 | 用途 |
| --- | --- |
| `users` | 账号（email 唯一、password_hash、tier、phone） |
| `cases` | 爆款案例（含种子数据与用户投稿，`is_seed` 区分） |
| `benchmarks` | 对标账号 |
| `case_saves` | 用户收藏案例（联合主键） |
| `benchmark_tracks` | 用户关注对标（联合主键） |

## 安全措施

- 密码 bcrypt（cost 10）哈希存储，输入长度上限 72 字符（避免 bcrypt 静默截断）。
- 会话为 HttpOnly + SameSite Cookie，前端 localStorage 只是 UI 镜像，**服务端为唯一可信来源**。
- `/api/auth/me` 每次回读数据库，用户被删/降级即时生效。
- `middleware.ts` 守卫 `/profile`，已登录用户访问 `/login` 自动跳首页；登录后跳转做了 open-redirect 过滤。
- 登录/注册接口带滑动窗口限流（IP 15 分钟 20 次、邮箱 15 分钟 10 次、注册 IP 1 小时 5 次）。
- 全部 SQL 走参数化查询，无字符串拼接注入面。
- `next.config.mjs` 配置了安全响应头。

> ⚠️ 限流是**单实例内存态**，Vercel 多实例场景下不是全局限流。真要抗刷需换 Upstash Redis 之类的共享存储。

### 会员等级为什么只能服务端改

前端 `localStorage` 只是 UI 镜像，`useSession()` 每次挂载都会回读 `/api/auth/me`（以数据库为准）。
所以任何「只改本地 tier」的做法都会被立刻覆盖，产生「支付页说解锁了、导航栏还是免费」的分裂。
会员等级只走 `/api/billing/demo-upgrade`，且该接口默认 403 —— 不设 `ALLOW_DEMO_UPGRADE=1` 谁也升不了。

## 目录结构

```
app/
  layout.tsx            根布局（主题 / 导航 / 页脚）
  page.tsx              首页
  analyze/              视频分析（上传 / 链接 / 流水线）
  report/               报告页
  library/              爆款案例库（筛选 / 搜索 / 收藏 / 投稿）
  find-peer/            找对标（多维筛选 / 关注）
  copywriting/          文案生成
  hotspots/             热点
  studio/               剪辑工作台
  storyboard/           分镜
  profile/              个人中心（真实收藏 / 报告 / 配额）
  login/                登录注册
  api/
    auth/               register · login · logout · me · bind-phone
    library/            案例列表与投稿 · saved 收藏
    benchmarks/         对标列表 · tracked 关注
    analyze/ copy/ plan/ render/ hotspots/ history/
    seed/               种子数据导入（需 SEED_TOKEN）
components/             UI 组件 + 业务组件
lib/
  ai/                   AI 适配器
  auth/session.ts       JWT 签发 / 校验 / 当前用户
  auth.ts               客户端会话（useSyncExternalStore 响应式）
  db.ts                 Neon 连接 · ensureSchema · 参数化 q()
  rate-limit.ts         内存滑动窗口限流
  benchmarks.ts         对标种子数据与类型
  mock-data.ts          案例种子数据
middleware.ts           路由守卫
scripts/
  fake-neon.mjs         本地假 Neon HTTP 端点（仅开发自测用，勿上线）
```

## 本地无数据库自测

沙箱/无网环境可用内置的假 Neon 端点跑通完整数据库链路：

```bash
node scripts/fake-neon.mjs 5555 &
DATABASE_URL="postgresql://u:p@localhost/db" \
NEON_FETCH_ENDPOINT="http://localhost:5555/sql" \
JWT_SECRET="dev-only-secret" SEED_TOKEN="testseed" \
npm run start -- -p 3100
# 测试账号 demo@viral.studio / 123456
```

## 现状

✅ 真实账号注册登录 · ✅ 案例库（DB 驱动 + 收藏 + 投稿）· ✅ 找对标（多维筛选 + 关注）
✅ AI 分析与报告 · ✅ 文案 / 分镜 / 剪辑方案 · ✅ 本地历史记录

⏳ 未接入：支付与会员开通（价格页为展示态）、分布式限流、邮箱验证与找回密码。
