# AGENTS.md — niigo-party

> **25時、ナイトコードで。四人**的回合制联机派对游戏。
> 图版层复刻《星引擎 Party》，小游戏层借鉴《揍击派对》。
> 上层：[仓库根 AGENTS.md](../AGENTS.md) ｜ Agent 规范入口：[../docs/agent/README.md](../docs/agent/README.md)
> 最后更新：2026-09-26

## ⚠️ 跨仓库约定（本项目最重要的一条）

**本项目只放引擎 / 进度 / 规划 / 要求。美术素材在另一个仓库。**

| 仓库 | 目录 | 负责 |
|---|---|---|
| `C:\Projects\AI-game` | `niigo\` | **25時 的美术素材**：立绘、chibi 贴片、动画序列帧、卡牌插画、棋盘背景 |
| `C:\Projects\Web\LapismindSEKAI` | `niigo-party\`（**本目录**） | **游戏引擎、项目进度、规划、要求** |

**为什么要分开**：

- 那批素材可能**不止用在这一个游戏**上
- 这个游戏也可能**不止用 niigo 的素材**

**素材怎么进来**：本仓库**不提交素材**。

```
构建/开发前  →  node scripts/sync-assets.mjs  →  public/assets/niigo/   （已 gitignore）
```

这是仓库既有约定（与 `design-kit` 字体的处理方式一致：真源在别处，构建前同步，产物不入库）。

素材源路径取 `NIIGO_ASSET_SRC` 环境变量，缺省 `../../../AI-game/niigo`（相对本目录）。

## 会话启动（沿用仓库根规矩）

1. `.\scripts\sync.ps1 pull`
2. 读本文件
3. 读 [`docs/agent/README.md`](../docs/agent/README.md)

## 这个项目是什么 / 做到哪了

**四人回合制派对游戏**：图版层复刻《星引擎 Party》，小游戏层借鉴《揍击派对》。
角色是 25時 四人（`mfy` / `ena` / `kanade` / `mizuki`），各带主动 + 被动技能。

- **进度、已定决策、下一步** → [`docs/进度.md`](docs/进度.md)（**会变的东西放 docs，不放这里**）
- **设计规格** → [`docs/specs/`](docs/specs/)
- **踩过的坑** → [`docs/lessons-learned.md`](docs/lessons-learned.md)

## 技术栈

| 项 | 用什么 |
|---|---|
| 前端 | Vue 3 + Vite + Tailwind 4 + Pinia（照抄 showhand） |
| 后端 | Cloudflare Workers + Durable Objects + WebSocket |
| 大厅 | [`@lapismind/lobby-kit`](../packages/lobby-kit)（房间码 / 邀请链接 / 断线重连 / 身份） |
| 设计语言 | [`@lapismind/design-kit`](../packages/design-kit) |
| 分流 | 三层：`core`(抽象接口) / `game`(规则逻辑) / `network`(通信)，消息统一 `{type, data}` 信封 |

**部署参考**：[../docs/GAME-DEPLOY.md](../docs/GAME-DEPLOY.md)

> 域名：**`niigo-party.qmzhj.top`**（与目录名一致，不套短域名）。
> 建 `wrangler.toml` 时别忘了免费计划的 DO 必须用 `new_sqlite_classes`（踩过 `code:10097`）。

## 命令

```powershell
node scripts/sync-assets.mjs   # 从 AI-game 同步素材到 public/assets/niigo/
npm run dev                    # 只起前端（Vite）
npx wrangler dev               # 带本地 Worker + DO（联机必须用这个）
npm run deploy                 # = npm run build && wrangler deploy
```

## 边界

- **不提交素材产物**（`public/assets/`）。真源在 AI-game，产物由脚本生成。
- **不擅自提交或部署**（沿用仓库根规矩）。
- **素材需求变更**改 AI-game 侧的 `niigo\AGENTS.md`，改完同步到这里提一句。
- 大体积二进制不进 git：棋盘背景、序列帧、卡牌插画全部走同步脚本。

## 变更记录

- **2026-09-26 建立**：脚手架 + 跨仓库素材约定；素材仓同步命名为 `niigo`。
