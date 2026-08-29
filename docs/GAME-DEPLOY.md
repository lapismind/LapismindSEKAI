# 游戏项目部署指南（通用）

> 适用范围：`D:\LapismindSEKAI` 下所有联机游戏（turtle-soup、showhand、abracadawhat、未来的新游戏）
> 架构：Vue3 + Vite 前端，Cloudflare Worker + Durable Objects 后端，绑定 `*.qmzhj.top` 子域名
> 域名规范见 [DOMAIN.md](./DOMAIN.md)，大厅层复用见 [LOBBY_KIT_GUIDE.md](./LOBBY_KIT_GUIDE.md)

## 日常发布流程

改完代码后在对应项目目录执行：

```powershell
npm run deploy   # 等于 vite build && wrangler deploy
```

构建成功标志：vite 输出 `built in xxxs`。
部署成功标志：wrangler 输出 `Deployed <项目名> triggers` 和 `<域名> (custom domain)`。

改完记得归档源码：

```powershell
git add -A; git commit -m "fix: 说明"; git push
```

## 首次部署一个新游戏（从零开始）

日常发布只需要上一节。这一节记录新游戏从零到上线的完整步骤。

### 1. 项目脚手架

照着现有项目（推荐 showhand，结构最新）复制结构：Vite + Vue3 + Tailwind，
`src/worker/index.js` 放 Worker 入口。**npm install 之前先建 .gitignore**
（node_modules / dist / .wrangler / .dev.vars），这是踩过的坑。

package.json 里加部署脚本：

```json
"deploy": "vite build && wrangler deploy"
```

### 2. wrangler.toml

这是部署的核心配置。以 showhand 为例，每个字段的用途：

```toml
name = "showhand"
main = "src/worker/index.js"
compatibility_date = "2025-06-01"

# 自定义域名（Custom Domain：自动创建 DNS + 证书）
[[routes]]
pattern = "showhand.qmzhj.top"
custom_domain = true

# 前端静态资源（Vite 构建产物 dist/）
[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
# WebSocket 与 API 必须先进 Worker，其余请求走静态资源
run_worker_first = ["/ws*", "/api/*"]

# 房间：每房一个 DO 实例（类名按游戏起）
[[durable_objects.bindings]]
name = "ROOM"
class_name = "XxxRoom"

# 首次部署必须注册 DO 类；免费计划用 SQLite 存储后端
[[migrations]]
tag = "v1"
new_sqlite_classes = ["XxxRoom"]
```

要点：

- `run_worker_first` 必须包含 `/ws*` 和 `/api/*`，否则这些请求会直接命中静态资源，进不了 Worker——WebSocket 连不上的第一排查项。
- `new_sqlite_classes` 只在首次部署时需要；之后新增 DO 类才加新的 migration 条目（tag 递增 v2、v3…）。
- Custom Domain 模式下 Cloudflare 自动创建 DNS 记录和 HTTPS 证书，不用手动操作。
- 有非敏感运行时配置放 `[vars]`（参考 turtle-soup 的 AI_BASE_URL）；密钥一律走 secret（下一节）。

### 3. 密钥与环境变量

联机游戏用 lobby-kit 的 HMAC 签名 token 校验玩家身份，生产环境通过 secret 设置：

```powershell
npx wrangler secret put IDENTITY_SECRET
# 统一认证会话密钥（与 sekai-auth Worker 用同一个值；设置后博客登录/游客身份才能带进大厅）
npx wrangler secret put SESSION_SECRET
```

本地开发在项目根目录写 `.dev.vars` 文件（已被 .gitignore 排除）：

```
IDENTITY_SECRET=dev-secret-xxx
SESSION_SECRET=与 sekai-auth 相同的值
```

检查已设置的 secret：`npx wrangler secret list`。

**统一认证与会话携带（重要）**：游戏大厅/房间的登录机制由 @lapismind/lobby-kit 的
auth 客户端提供——页面加载时 auth.init() 自动读跨子域会话：博客登录的 GitHub/账号
用户直接带过来，游客自动登录拿到服务端 playerId。要让 Worker 侧真正以会话身份为准
（覆盖客户端自报 playerId、杜绝任意 ID 冒充），必须给每个游戏 Worker 配置
SESSION_SECRET，且与 sekai-auth 的 SESSION_SECRET 相同。未配置时：登录功能与博客
账号携带照常（前端经 auth /api/me 读会话即带上账号），只是 Worker 侧无法对会话
cookie 验签——防冒充绑定与 /ws 会话身份优先不启用（showhand/abraca 降级为旧 token
机制；turtle 无会话门禁）。

### 4. 本地开发

```powershell
npm run dev          # 仅前端，Vite 开发服务器
npx wrangler dev    # 带本地 Worker + DO 的完整模拟
```

联机逻辑调试用 `wrangler dev`，纯界面调整用 `npm run dev` 即可。

### 5. 部署与验证

```powershell
npm run deploy
```

1. 浏览器打开 `https://<域名>`，确认页面加载正常
2. 开两个无痕窗口各进一房，确认 WebSocket 连接和核心玩法能跑通
3. `npx wrangler tail` 实时看 Worker 日志，报错在这里看最直接

### 6. 接入博客作品集

游戏本体上线后，在博客里露出需要三处（仓库 `D:\LapismindSEKAI\blog`）：

1. `src/data/projects.ts`：games 数组加条目，status 用 `online` 或 `developing`
2. `src/pages/projects/<slug>.astro`：详情页，参照 turtle-soup 或 showhand 页面结构
3. 首页精选和 projects 列表页自动读取 games 数据，无需额外改动

然后按 [BLOG-DEPLOY.md](./BLOG-DEPLOY.md) 流程重新构建部署博客。

## 常见问题

**Q: 部署后访问自定义域名报 404 或证书错误？**
A: Custom Domain 生效需要一两分钟。持续失败用 `npx wrangler deployments list` 确认部署版本，再到 Cloudflare Dashboard 检查该域名的 DNS 和证书状态。

**Q: WebSocket 连不上？**
A: 先查 `wrangler.toml` 里 `run_worker_first` 是否包含 `/ws*`；再确认客户端连接的 wss 地址与部署域名一致；还不行就 `npx wrangler tail` 看升级请求有没有进 Worker。

**Q: 改了代码但线上没变化？**
A: Cloudflare CDN 缓存，强刷 Ctrl+F5。静态资源文件名带 hash，正常情况下新版本立即生效。

**Q: wrangler 卡住或超时？**
A: 国内网络波动，重试一次通常就好。持续失败检查代理设置。

## 已部署项目一览

| 游戏 | 域名 | 状态 |
|------|------|------|
| 真冬的海龟汤 turtle-soup | https://soup.qmzhj.top | online |
| 梭哈 Showhand | https://showhand.qmzhj.top | online |
| abracadawhat | https://abracadawhat.qmzhj.top | online |

新游戏上线后在表格里加一行。
