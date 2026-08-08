# 爆款研究所 · 真·公网实例（隧道临时部署）

## 公网地址（现在就能点）
**https://happy-buckets-clean.loca.lt**

这是把沙箱里运行的生产构建（Next.js 15 + React 19 + 真实账号体系）通过隧道暴露出的**真实、可注册、可用**的实例，不是截图。

## 验证过能用的
- 首页 / 案例库 / 找对标 / 定价 / 支付页 → 全部 200
- 注册新账号 → 返回完整 user 对象（bcrypt + JWT 真实链路）
- 会话回读 `/api/auth/me` → 200
- 案例库 → 12 条种子案例 / 找对标 → 14 条种子对标
- 投稿 / 收藏 / 关注 / AI 分析 全功能可跑（AI 走你 .env.local 里的真实 Qwen/DeepSeek key）

## 必须知道的 4 个边界（诚实交代）
1. **这是临时实例**：隧道 + 服务只在本会话存活，会话结束即失效；数据库是内存库，重启即清空（需重新灌种子）。
2. **链接是公开的**：localtunnel 子域任何拿到链接的人都能访问，别在里面放真实隐私信息。
3. **消耗你的 AI 额度**：分析功能走你自己的 Qwen/DeepSeek 真实 key。
4. **不是你的自有域名 / 不是持久化生产部署**：要真正的 `你的域名.com` + 不丢数据的数据库，**仍需你自己的 Vercel + Neon 账号**（之前的 7 步清单照做即可）。

## 我"填好"的沙箱侧信息
- `DATABASE_URL` → 指向内存库 fake-neon（:5555）
- `JWT_SECRET` / `SEED_TOKEN` → 本次自生成（demo 值，非生产）
- `NEON_FETCH_ENDPOINT=http://127.0.0.1:5555/sql`
- `ALLOW_DEMO_UPGRADE=1`（演示用，可测会员升级流程）
- 种子已灌：12 案例 / 14 对标

## 想变成"真正的生产部署"，你只需 7 步（用你自己的账号）
1. 推代码到 GitHub/GitLab
2. Neon 建库拿 `DATABASE_URL`（Free 档够）
3. 终端生成 `JWT_SECRET`/`SEED_TOKEN`
4. Vercel 导入仓库，填环境变量（含 `AI_PROVIDER=qwen` + 两个 AI key，`ALLOW_DEMO_UPGRADE` 生产留空）
5. Deploy
6. 一次性 `curl "https://你的域名/api/seed?token=你的SEED_TOKEN"`
7. 绑自定义域名（可选，Vercel 免费 SSL）

> 支付系统按你要求暂未接（无营业执照），全站免费档可用，无功能被会员等级卡死。
