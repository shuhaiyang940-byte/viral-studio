# 爆款研究所 · Viral Studio AI

> **项目维护：自 2026-08-24 起由 Codex 接管维护，不再使用 WorkBuddy 生成。**
> 部署架构按 Vercel Serverless 设计：视频上传走 Blob 直传 + Qwen-VL 视频 URL 理解，
> 热点/编辑计划等数据全部走数据库（KV），不依赖服务器文件系统。

面向普通短视频创作者的 AI 视频拆解 SaaS。

上传视频或粘贴链接，AI 生成「爆款拆解报告」：爆款评分、为什么火、结构拆解、可复制模板、标题优化、拍摄建议；并配套案例库、找对标、文案生成、分镜与剪辑方案。

定位：**不追求一百分，先帮普通创作者把三十分做到七十分**——报告按镜头级拆解（分镜蓝图），并把参考视频逐镜头翻译成用户主题的版本（主题适配 + 照做清单），手把手教怎么拍。

信任与商业化基础：邮箱验证 + 找回密码、隐私政策 / 服务条款 / 关于我们、分布式全局限流 + IP 自动封禁、真实视频理解（上传抽帧 + Qwen-VL）、SEO（sitemap / robots / OG）。

## 技术栈

- **前端 / 全栈**：Next.js 15（App Router）+ React 19 + TypeScript（strict）
- **样式**：Tailwind CSS v4 + shadcn 风格组件 + Lucide 图标
- **深色模式**：next-themes（系统 / 浅色 / 深色）
- **后端 API**：Next.js Route Handlers（`app/api/*`）
- **数据库**：Neon Postgres（`@neondatabase/serverless`，HTTP 驱动，参数化 SQL）
- **账号体系**：邮箱 + 密码 → bcryptjs 加盐哈希 → jose 签发 JWT（HS256）→ HttpOnly Cookie
- **AI 接入**：统一适配器，千问 Qwen（理解层）+ DeepSeek（生成层），可回退 Mock
- **视频存储**：Vercel Blob 直传（`@vercel/blob`），前端拿预签名票据直传对象存储

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
| `AI_LIMIT_ANALYZE` 等 | AI 接口单 IP 每小时次数（`AI_LIMIT_<SCOPE>`，SCOPE 见下） | 否 |
| `AI_BAN_THRESHOLD` | 连续触发限流几次后自动封禁（默认 3） | 否 |
| `AI_BAN_MS` | 自动封禁时长毫秒（默认 24h） | 否 |
| `ADMIN_TOKEN` | IP 封禁管理接口口令（`/api/admin/ip`） | 否 |
| `NEXT_PUBLIC_FREE_FULL_ACCESS` | 免费公测开关：设为 `0` 恢复会员门禁（正式收费后设置） | 否 |
| `SITE_URL` | 站点对外根地址（邮件链接 / sitemap 使用） | 生产推荐 |
| `RESEND_API_KEY` · `EMAIL_FROM` | 邮件服务（邮箱验证 / 找回密码）；不配置时开发模式返回 devLink | 否 |
| `AI_VISION_MOCK` | 视觉理解演示开关：`1` 不调视觉模型；留空且配 QWEN_API_KEY 时真实 | 否 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 读写令牌（视频直传对象存储；配置后走 Serverless 视频 URL 理解） | Vercel 推荐 |
| `AI_ASR` · `QWEN_AUDIO_MODEL` | 语音转写开关（Qwen-Audio）与模型 | 否 |

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
| `ip_blocklist` | IP 防刷封禁名单（到期自动失效） |

## 安全措施

- 密码 bcrypt（cost 10）哈希存储，输入长度上限 72 字符（避免 bcrypt 静默截断）。
- 会话为 HttpOnly + SameSite Cookie，前端 localStorage 只是 UI 镜像，**服务端为唯一可信来源**。
- `/api/auth/me` 每次回读数据库，用户被删/降级即时生效。
- `middleware.ts` 守卫 `/profile`，已登录用户访问 `/login` 自动跳首页；登录后跳转做了 open-redirect 过滤。
- 登录/注册接口带滑动窗口限流（IP 15 分钟 20 次、邮箱 15 分钟 10 次、注册 IP 1 小时 5 次）。
- **AI 接口 IP 防刷**：`/api/analyze`、`/api/copy`、`/api/replicate`、`/api/hotspots`、`/api/plan`、`/api/render` 均接入 IP 维度守卫——滑动窗口限流 + 连续违规自动封禁（默认 24h）；封禁名单有数据库时写入 `ip_blocklist` 表（多实例共享），无数据库时退化为内存态。
- **分布式全局限流**：限流计数走数据库原子 UPSERT（`rate_limits` 表，多实例精确共享）；无数据库时自动回退内存限流。
- 全部 SQL 走参数化查询，无字符串拼接注入面。
- `next.config.mjs` 配置了安全响应头。
- **邮箱验证 / 找回密码**：一次性令牌（数据库只存 sha256 哈希）+ 邮件发送抽象（Resend / 开发模式控制台）。
- **真实视频理解**：`/api/analyze/upload` 上传视频 → ffmpeg 均匀抽帧 → Qwen-VL 逐帧理解 → 报告生成；`AI_VISION_MOCK=1` 或未配千问 Key 时返回演示摘要。
- **服务器化视频理解（Vercel 主路径）**：前端直传 Blob → 公网 URL → `/api/analyze/url` 把 URL 交给 Qwen-VL 视频理解（video_url）+ Qwen-Omni 语音转写（AI_ASR=1，已公网实测）→ 报告生成。全程无 ffmpeg / 无本地文件。
- **无本地文件系统依赖**：热点缓存/历史/详情、编辑计划全部走 `kv_store` 表（无数据库时内存回退），Vercel Serverless 只读文件系统不再阻塞。

### IP 封禁管理

```bash
# 列出当前封禁
ADMIN_TOKEN=<你的口令> node scripts/ip-admin.mjs list

# 手动封禁 1.2.3.4（默认 24 小时，可指定小时数和原因）
ADMIN_TOKEN=<你的口令> node scripts/ip-admin.mjs ban 1.2.3.4 48 "恶意刷接口"

# 解封
ADMIN_TOKEN=<你的口令> node scripts/ip-admin.mjs unban 1.2.3.4
```

管理接口：`GET /api/admin/ip`（查）、`POST /api/admin/ip`（封，body `{ip, hours?}`）、`DELETE /api/admin/ip`（解封，body `{ip}`），均需 `Authorization: Bearer <ADMIN_TOKEN>`。未配置 `ADMIN_TOKEN` 时管理接口返回 503，不影响正常访问。

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
✅ AI 分析与报告（含分镜拆解 + 主题适配）· ✅ 文案 / 分镜 / 剪辑方案 · ✅ 本地历史记录
✅ AI 接口 IP 防刷（限流 + 自动封禁 + 管理接口）· ✅ 分布式全局限流（DB 原子计数）
✅ 邮箱验证 + 找回密码 · ✅ 真实视频理解（上传抽帧 + Qwen-VL，视环境）
✅ 隐私政策 / 服务条款 / 关于我们 · ✅ SEO（sitemap / robots / OG / favicon）
✅ 服务端配额与会员权益（免费 1 次/天、匿名按 IP 3 次/天、会员不限；DB 原子计数）

⏳ 未接入：支付与真实会员开通（价格页为展示态，公测期全站免费）。
⏳ 已搁置：智能剪辑 / 自动出片（remotion 渲染）——算力成本高、体验不如本地剪映，暂缓；
   分镜表 + 剧本（可复制拍摄脚本）为主推功能。

> 当前为免费公测阶段（`NEXT_PUBLIC_FREE_FULL_ACCESS=1`），完整报告全站免费开放；会员功能建设中，正式收费前请保持该开关。
