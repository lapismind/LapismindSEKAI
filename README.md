# cloudflareGame — 游戏项目集

D:\\LapismindSEKAI 是个人游戏开发工作区，所有游戏项目集中在这里，共享一套技术栈和联机基础设施，方便复用经验与代码。

## 技术栈约定

所有新游戏默认沿用已验证的路径，不轻易换栈：

- **前端**：Vue 3 + Vite + Tailwind CSS 4 + Pinia
- **部署**：Cloudflare Workers（免费版），联机游戏用 Durable Objects + WebSocket
- **本地开发**：`npm run dev`（Vite dev server）
- **生产构建**：`npm run build`，部署用 `npx wrangler deploy`

## 项目一览

| 目录 | 类型 | 状态 | 简介 |
|------|------|------|------|
| [turtle-soup](./turtle-soup) | 联机推理 | ✅ 已上线 | 回合制联机海龟汤。玩家向主持人提问（只能答是/否/无关），推理出真相即胜出 |
| [showhand](./showhand) | 联机牌桌 | 🔨 开发中 | 多人梭哈，五张/七张两种模式，固定局数积分赛。设计文档见 docs/specs/ |
| [abracadawhat](./abracadawhat) | 联机卡牌 | 🔨 开发中 | 《出包魔法师》联机版：2–5 人暗牌推理卡牌。你只能看别人的牌，宣告魔法由服务端判定成败 |
| [card-game](./card-game) | 技术验证 | 📦 已归档 | 第一个 DO/WebSocket 技术验证项目，为海龟汤铺路。经验在 docs/session-logs 和 lessons-learned |
| [slay-the-spire](./slay-the-spire) | 单机卡牌 | ⏸️ 搁置 | 杀戮尖塔复刻，纯前端。核心战斗循环可玩、已知 bug 全修完（最新 88471aa），但内容量与原版差距大，暂缓 |
| [blog](./blog) | 博客 | 🌱 初始模板 | Astro 官方 blog 模板，尚未定制 |
| [planning-new-game](./planning-new-game) | 规划文档 | 🗂️ 已归档 | 梭哈立项前的选型研究（曾考虑出包魔法师换皮等方向），结论已落地到 showhand |
| [packages](./packages) | 共享代码 | ✅ 活跃 | 跨游戏共享包，见下 |

## packages — 跨游戏共享包

避免同一份逻辑在多个游戏里复制粘贴。`packages/README.md` 有完整说明。

- **@lapismind/lobby-kit**：联机大厅通用件（纯逻辑层，无 UI）。WebSocket 客户端+断线重连、6 位房间码、玩家 ID、大厅状态工厂、26 张头像资源清单。showhand 已接入；新联机游戏照 packages/README.md 的三步接入。

> 📘 新开联机游戏前先读 **[LOBBY_KIT_GUIDE.md](./LOBBY_KIT_GUIDE.md)** —— lobby-kit 完整使用指南（含邀请链接、个人资料组件、身份 token、新游戏检查清单）。

## 常见工作流

### 新建单机小游戏

1. `mkdir <name> && cd <name>`
2. 参考 slay-the-spire 的 package.json 起 Vite + Vue3 + Tailwind 骨架
3. 纯前端逻辑分三层：src/core（引擎）、src/data（数据）、src/views（界面）

### 新建联机游戏

1. 先读 turtle-soup / showhand 的架构：三层隔离（core 抽象 / game 规则 / network 通信）
2. 接入 lobby-kit 处理大厅和连接管理
3. 服务端 DO 类写在 worker 入口，消息协议用 `{ type, data }` 信封
4. 本地调试：`wrangler dev`，多开浏览器标签测多人

### 部署

每个游戏独立 wrangler.toml，互不影响：

```bash
npm run build          # 先确认生产构建无错
npx wrangler deploy    # 输出 https://<name>.<子域名>.workers.dev
```

改了 DO 类名或新增 DO 类时，wrangler.toml 的 migrations 里要加新的 tag。

## 经验沉淀

各项目的踩坑记录在各自的 docs/lessons-learned.md，做新功能前建议先扫一眼相关项目的教训。

---

*最后更新：2026-08-22*
