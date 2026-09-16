# 部署配置对照

> 什么时候读：要部署任何一个站、或换了机器要恢复部署能力时。
> 相关文档：凭证位置与登录排查见 [`../MIGRATION-NOTES.md`](../MIGRATION-NOTES.md) 第三节；
> 各站细节见 [`../GAME-DEPLOY.md`](../GAME-DEPLOY.md)、[`../BLOG-DEPLOY.md`](../BLOG-DEPLOY.md)、
> `abracadawhat/docs/deployment-v2.md`。本文只回答"**部署到底需要机器上有哪些配置**"。

## 一句话结论

**换机器部署，本地唯一需要的东西是 `npx wrangler login`。**

其余（密钥、变量、KV/DO/D1 绑定、域名路由）**全部在 Cloudflare 侧**，跟着 Worker 走，
仓库里没有、也不需要有。所以：

- ❌ 不需要把 `.dev.vars` 带到新机器才能部署（那东西只影响本地 `wrangler dev`）。
- ❌ 不需要在本地导出 `CLOUDFLARE_API_TOKEN`（OAuth 登录即可）。
- ❌ 不要把 Cloudflare 凭证提交进仓库。

## 一、部署前置检查（三条）

| # | 检查 | 命令 / 判据 |
|---|---|---|
| 1 | Node 版本 | `node -v` ≥ `22.12.0`（各项目 `engines` 要求） |
| 2 | **wrangler 已登录** | `npx wrangler whoami` 打印账号邮箱；打印 `You are not authenticated` 则先 `npx wrangler login` |
| 3 | 字体已同步（gitignore 产物） | `turtle-soup/public/fonts` 等目录下应有 97 个 `.woff2`；由 `prebuild` 自动生成，正常不要手管 |

第 3 条为什么算前置：`public/fonts/` 是 gitignore 的，**全新 clone 上是空的**。
只要走 `npm run build` 就会自动同步；但如果绕过构建直接发布，站点会静默退回系统字体。

上面第 2 条的命令**要在某个项目目录里跑**（如 `turtle-soup/`）——仓库根没有安装 wrangler，
在根目录 `npx wrangler` 会失败（`npx canceled due to missing packages`），不是登录有问题。

## 二、四个站怎么部署

| 站 | Cloudflare name | 域名 | 命令（在对应目录） |
|---|---|---|---|
| 博客 | `blog` | blog.qmzhj.top | `npm run build && npx wrangler deploy` |
| 海龟汤 | `turtle-soup` | soup.qmzhj.top | `npm run deploy` |
| 梭哈 | `showhand` | showhand.qmzhj.top | `npm run deploy` |
| 出包魔法师 | `abracadawhat` | abracadawhat.qmzhj.top | `npm run deploy` |
| 认证服务 | `sekai-auth` | auth.qmzhj.top | `npx wrangler deploy` |

- 四个游戏/博客的 `npm run deploy` == `npm run build && wrangler deploy`（**博客没有 deploy 脚本**，
  所以它必须手写这两步）。
- `auth` 是纯 JS Worker，没有构建步骤。

### 为什么不能绕过构建

`deploy` 脚本一律写成 `npm run build && wrangler deploy`，不要拆成 `vite build && wrangler deploy`：

- `vite build` **不会触发 `prebuild`**，而字体同步就挂在 `prebuild` 上。2026-09-15 实际踩过：
  turtle-soup 原本写的是 `vite build`，全新 clone 上部署会发出一个**没有字体**的站。
- 另一个方向也不行：只跑 `npx wrangler deploy` 而不构建，会把**上一次的 `dist/`** 发上去。
- `abracadawhat` 还多一步 `postbuild`（复制聊天表情到 `dist/chat-kit/emojis/**`），
  绕过构建同样会让表情变文件名。

## 三、Cloudflare 侧配了什么（本地不需要有）

各自 Worker 实际读取的绑定与变量（来源：各项目 `wrangler.toml` + 源码里的 `env.*` 引用）：

| 站 | 变量（`[vars]`，明文、随仓库） | 密钥（Secret，只在 Cloudflare） | 其他绑定 |
|---|---|---|---|
| `blog` | — | — | `ASSETS` |
| `turtle-soup` | `AI_BASE_URL`、`AI_MODEL` | `SESSION_SECRET`、`IDENTITY_SECRET` | `ASSETS`、DO `SoupRoom` / `PuzzleLib` |
| `showhand` | — | `SESSION_SECRET`、`IDENTITY_SECRET` | `ASSETS`、DO `ShowhandRoom` |
| `abracadawhat` | — | `SESSION_SECRET`、`IDENTITY_SECRET` | `ASSETS`、DO `AbracaRoom` |
| `sekai-auth` | `GITHUB_CLIENT_ID`、`ADMIN_GITHUB_ID` | `GITHUB_CLIENT_SECRET`、`SESSION_SECRET`、`MATCH_REPORT_SECRET` | D1 `DB`（`sekai-db`） |

要点：

- **这些密钥部署时不需要本地存在**，`wrangler deploy` 只上传代码与资源；密钥留在 Cloudflare。
- 需要重设时才用 `npx wrangler secret put <NAME>`（**没有 `--dry-run`，会立刻生效**，谨慎）。
- `wrangler.toml` 里出现明文值的是"变量"（非密钥）；**不要在文档或仓库里复制密钥值**。
- DO 的 `[[migrations]]` 已就位；改 DO 类名/新增类必须加 migration tag，不能只改代码。

## 四、`.dev.vars`：和部署无关，只影响本地调试

- 各项目 `.dev.vars` 是 gitignore 的，**只被 `wrangler dev` 读取**，`wrangler deploy` 不读。
- 缺了它的表现（**不是回归**）：
  - 三个游戏的 `/api/identity` 返回 **500**，错误信息 `server not configured`——
    handler 里有显式守卫 `if (!secret) return 500`。游戏功能正常，走降级路径
    （`/ws` 跳过验签，以客户端自报身份为准，见 `GAME-DEPLOY.md`）。
  - `auth` 本地起不来完整流程（缺 GitHub OAuth 与 D1 会拿不到数据）。
- 需要本地跑联机验证时再从其他机器用安全通道取一份；内容对应上表"密钥"那一列。

## 五、部署后验收（照做，别只看"上传成功"）

```powershell
python docs/agent/scripts/playwright-verify-deploy.py
```

判据（`all_passed: true` 才算过）：

1. **两张表情资源必须 `200 image/png`**（`/chat-kit/emojis/1/stamp0008.png`、
   `/chat-kit/emojis/21/stamp0943.png`）。`abracadawhat/docs/deployment-v2.md` 的强制项：
   返回 `200 text/html` 说明是 SPA 兜底、图片没进 dist。
2. 四站首页 HTTP 200、`pageerror` 为 0。
3. **字体真的生效**：`body` 的计算 `font-family` 含 `LXGW WenKai Screen`。

**两个已知误报，别被带偏**：

- 脚本第一版没带浏览器 UA，被 Cloudflare 直接 **403**（`server: cloudflare`）。
  实测同一 URL：`User-Agent: Python-urllib/*` → 403，浏览器 UA → `200 image/png`。
  脚本已修（带 UA + 403 提示）。任何用 `urllib`/`curl` 手查线上资源的地方都要带 UA。
- `blog` 偶发 `music/se_0248_01.mp3` 的 `net::ERR_ABORTED`：浏览器取消媒体预加载，
  不是故障（09-04 审阅已记录）。

`auth` 不在该脚本覆盖范围内，单独确认（实测返回 `HTTP 200` + `{"user":null}` 表示服务正常、
只是当前无会话）：

```powershell
curl.exe -i https://auth.qmzhj.top/api/me    # 应为 200 且是 JSON；500 才是故障
```

（用 `curl` 也要带 UA，见上面的 403 提示。）

## 六、回滚

- **首选**：Cloudflare 控制台 → Workers → 对应 Worker → 版本历史 → 退回上一个 Version。
  最快，且不需要本地环境。
- 等价做法：`git revert <commit>` 后重新构建部署。
- 部署是整站替换，没有灰度；四个站各自独立，回滚互不影响。

## 七、本仓库独有的部署注意（容易忘）

- `blog` 的 `/live2d/*` 走 Worker（`run_worker_first`），它的缓存头在 `src/worker.ts` 里设；
  其余静态目录靠 `blog/public/_headers`。**改一个别忘另一个。**
- `blog` 的 `npm run build` 会跑 `postbuild` → `scripts/precompress-live2d.mjs`（moc3 预压 `.br`）。
  **不 build 直接 deploy 会发上一次的产物**（那个 `.br` 不会自动补）。
- Wrangler 版本以各项目 `devDependencies` 为准；不同机器上 `npx wrangler` 可能临时装更新的版本，
  行为差异以此为主要排查方向。
