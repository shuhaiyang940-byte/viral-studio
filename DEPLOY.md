# 爆款研究所 · 部署速查卡（照抄即用）

> 在你自己电脑的 **Terminal.app** 里依次执行以下命令。
> 每条命令都是完整的，复制粘贴回车即可。

---

## 第 1 步：在 GitHub 建仓库并推送代码

```bash
# 1a. 进入项目目录
cd /Users/maxshy/WorkBuddy/2026-08-05-12-16-11

# 1b. 创建 GitHub 仓库（需要你第一次登录授权）
#    如果没装 gh CLI，先装：brew install gh && gh auth login
gh repo create viral-studio --public --source=. --push

# 如果上面报错"not logged in"，先跑：
# gh auth login  → 选 GitHub.com → 浏览器登录 → 再重试上面那条
```

**如果不想用命令行**，替代方案：
1. 打开 https://github.com/new
2. Repository name: `viral-studio`
3. 选 **Public**
4. **不要**勾选 "Add a README"（我们已有代码）
5. 点 Create repository
6. 然后终端里跑：
```bash
cd /Users/maxshy/WorkBuddy/2026-08-05-12-16-11
git remote add origin https://github.com/你的GitHub用户名/viral-studio.git
git branch -M main
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

- [ ] 打开首页 → 看到「爆款研究所」导航栏
- [ ] 点注册 → 填邮箱密码 → 注册成功跳转
- [ ] 点案例库 → 看到 12 条种子案例
- [ ] 点找对标 → 看到 14 条种子对标
- [ ] 登录后收藏一个案例 → 刷新还在
- [ ] 跑一次分析 → AI 返回结果
- [ ] 未登录访问 `/profile` → 自动跳转登录页

全部通过 = 上线完成 ✅

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
