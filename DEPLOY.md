# 爆款研究所 · 部署速查卡（照抄即用）

> 在你自己电脑的 **Terminal.app** 里依次执行以下命令。
> 每条命令都是完整的，复制粘贴回车即可。

---

## 第 1 步：推送代码到 GitHub

> 仓库已经建好、remote 也配好了（`https://github.com/shuhaiyang940-byte/viral-studio.git`），
> 但**本地 10 个 commit 一次都没推上去过**。只需要推一次：

```bash
cd /Users/maxshy/WorkBuddy/2026-08-05-12-16-11
git push -u origin main
```

**如果提示要账号密码**：GitHub 早就不收密码了，要用 Personal Access Token。
1. 打开 https://github.com/settings/tokens → Generate new token (classic)
2. 勾选 `repo` 权限 → 生成 → 复制那串 `ghp_xxxx`
3. 回到终端重跑 `git push -u origin main`，用户名填你的 GitHub 用户名，**密码位置粘贴那串 token**

**如果嫌麻烦**，用 gh CLI 一次授权永久省事：
```bash
brew install gh && gh auth login   # 选 GitHub.com → 浏览器登录
git push -u origin main
```

---

## 第 2 步：建 Neon 数据库（免费）

1. 打开 https://neon.tech → Sign up / Log in
2. 点 **Create a project**
3. 名字随便填（如 `viral-studio-db`）
4. Region 选离你近的（AWS Asia / Tokyo）
5. 点 Create project
6. 创建完成后，页面会显示 **Connection string**，格式类似：
   ```
   postgresql://username:password@ep-xxx.region.neon.tech/dbname?sslmode=require
   ```
7. **复制整串**，下一步要用。

---

## 第 3 步：Vercel 部署 + 配环境变量

### 3a. 导入项目
1. 打开 https://vercel.com/import
2. 选 Import from **Git Repository**
3. 找到 `viral-studio` 仓库，点 Import
4. Framework Preset 会自动识别为 **Next.js** ✅
5. 先点 **Deploy**（先用默认配置部署一次）

### 3b. 配环境变量（关键！不配则功能不可用）
1. 部署完成后，进项目 **Settings → Environment Variables**
2. 逐条添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | 第 2 步复制的 Neon 连接串 | 必填 |
| `JWT_SECRET` | 见下方生成 | 必填 |
| `SEED_TOKEN` | 见下方生成 | 必填 |
| `AI_PROVIDER` | `qwen` | 必填 |
| `QWEN_API_KEY` | 你的通义千问 API Key | 必填 |
| `DEEPSEEK_API_KEY` | 你的 DeepSeek API Key | 必填 |

**生成 JWT_SECRET 和 SEED_TOKEN**（在终端跑）：
```bash
echo "JWT_SECRET: $(openssl rand -base64 48)"
echo "SEED_TOKEN: $(openssl rand -hex 32)"
```

把输出分别填入对应变量。

**⚠️ ALLOW_DEMO_UPGRADE 不要填！** 生产环境留空。

### 3c. 重新部署
配完环境变量后：
1. 去 **Deployments** 页面
2. 点最新一次部署右边的 **⋯** → **Redeploy**
3. 勾选 "Use existing Build Cache" 取消（确保用新环境变量重建）
4. 点 Redeploy

---

## 第 4 步：灌种子数据（一次性）

部署成功后，在终端跑：
```bash
curl "https://你的域名.vercel.app/api/seed?token=你在SEED_TOKEN填的值"
```

返回 `{"ok":true,"cases":12,"benchmarks":14}` 就成功了。

---

## 第 5 步：（可选）绑自定义域名

1. Vercel 项目 → Settings → Domains
2. 输入你的域名（如 `viral.studio`）
3. Vercel 会给你一条 CNAME 记录
4. 去你的域名商（阿里云/Cloudflare/Namecheap）添加 CNAME
5. 等 DNS 生效（通常几分钟），Vercel 自动配 SSL

---

## 验证清单（部署后逐项检查）

**账号与流程**
- [ ] 打开首页 → 看到「爆款研究所」导航栏
- [ ] 未登录访问 `/profile`、`/onboarding` → 都自动跳转登录页
- [ ] 登录页看到四个入口：邮箱 / 手机号 / QQ / 微信（后三个带「演示」徽章）
- [ ] **用邮箱注册** → 成功 → 因为没手机号，被弹到 `/bind-phone`
- [ ] 绑手机页填任意手机号 + 任意 6 位验证码 → 通过 → 进入「认识你自己」摸底
- [ ] 摸底填完 → 进入分析页
- [ ] 「我的」页看到创作档案 → 点「修改」→ **已填内容被带出来**（不是空白重填）→ 改完保存回「我的」

**数据与功能**
- [ ] 点案例库 → 看到 12 条种子案例
- [ ] 点找对标 → 看到 14 条种子对标
- [ ] 登录后收藏一个案例 → 刷新还在
- [ ] 跑一次分析 → AI 返回结果
- [ ] 「复刻助手」免费档 → 1 个标题 + 3 个分镜；升级后 → 5 标题 + 6 分镜
- [ ] 「我的」页 AI 导演卡 → 有分析记录后显示诊断与本周选题

全部通过 = 上线完成 ✅

---

## ⚠️ 上线时必须知道的「哪些是真、哪些是演示」

诚实口径，别对外宣传成已完成：

| 能力 | 状态 |
|------|------|
| 邮箱注册 / 登录 | ✅ **真实**（Neon 数据库 + bcrypt + JWT） |
| 手机号 / QQ / 微信 登录 | ⚠️ **演示**（点了模拟成功，不走真实 OAuth） |
| 短信验证码 | ⚠️ **演示**（任意 6 位通过，不真发短信） |
| 会员升级支付 | ⚠️ **演示**（无营业执照，未接真实支付） |
| 复刻助手每日限次 | ⚠️ 存在浏览器本地，**清缓存可绕过**（要真防刷需落服务端） |
| AI 分析 / 复刻 / 导演 | ✅ **真实**（千问 + DeepSeek；未配 Key 时优雅回落到 Mock） |

**要把演示变真，各自需要什么：**
- QQ/微信登录 → 开放平台 AppID + Secret + 服务端回调域名（微信还要企业认证）
- 短信 → 阿里云/腾讯云短信服务（签名 + 模板，按条计费）
- 支付 → 营业执照 + 微信支付/支付宝商户号

---

## 常见问题

**Q: 部署后页面白屏？**
A: 检查 `DATABASE_URL` 是否正确复制了完整连接串（含 `?sslmode=require`）。去 Vercel → Deployments → 点最新部署 → 看 Build Log 有没有报错。

**Q: 注册提示"数据库未配置"？**
A: 环境变量没生效。确认第 3b 步填完后做了 Redeploy（不是只保存）。

**Q: AI 分析报错？**
A: 检查 `QWEN_API_KEY` 和 `DEEPSEEK_API_KEY` 是否正确（去阿里云 DashScope 和 DeepSeek 平台确认 key 有效）。

**Q: 想改域名？**
A: Vercel Settings → Domains 可以随时加/改域名，免费 SSL 自动续期。
