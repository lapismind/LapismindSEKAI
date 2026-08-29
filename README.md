# LapismindSEKAI

我的个人游戏项目集和博客。所有东西跑在 Cloudflare 免费版上：前端是静态页面，联机用 Workers + Durable Objects + WebSocket，不花服务器钱。

## 在线试玩

| 项目 | 地址 | 说明 |
|------|------|------|
| 联机海龟汤 | [soup.qmzhj.top](https://soup.qmzhj.top) | 回合制推理游戏。向主持人提问（只能答是/否/无关），推出真相即胜出，支持真人/AI 主持 |
| 出包魔法师 | [abracadawhat.qmzhj.top](https://abracadawhat.qmzhj.top) | 2–5 人暗牌推理对决，宣告魔法由服务端判定成败 |
| 多人梭哈 | [showhand.qmzhj.top](https://showhand.qmzhj.top) | 五张/七张两种模式，固定局数积分赛 |
| 博客 | [blog.qmzhj.top](https://blog.qmzhj.top) | 开发记录和作品集 |

## 这个仓库里有什么

| 目录 | 状态 | 简介 |
|------|------|------|
| [turtle-soup](./turtle-soup) | ✅ 已上线 | 第一个完整上线的联机游戏 |
| [showhand](./showhand) | ✅ 已上线 | 设计文档在 `showhand/docs/specs/` |
| [abracadawhat](./abracadawhat) | ✅ 已上线 | 《出包魔法师》联机版：2–5 人暗牌推理。你只能看别人的牌，宣告魔法由服务端判定成败 |
| [slay-the-spire](./slay-the-spire) | ⏸️ 搁置 | 杀戮尖塔复刻，纯单机。核心战斗循环可玩，内容量追不上原版 |
| [card-game](./card-game) | 📦 已归档 | 最早的技术验证项目，验证了 DO/WebSocket 可行，为海龟汤铺路 |
| [blog](./blog) | ✅ 已上线 | Astro 博客，开发记录都在这 |
| [packages](./packages) | ✅ 活跃 | 跨游戏共享代码 |

## 技术栈

一套栈用到黑，不轻易换：

- **前端** Vue 3 + Vite + Tailwind CSS 4 + Pinia
- **后端** Cloudflare Workers，联机房间用 Durable Objects，通信走 WebSocket
- **博客** Astro，部署在 Cloudflare Pages

## 架构约定

每个联机游戏分三层：`core`（抽象接口）、`game`（规则逻辑）、`network`（通信）。服务端逻辑写在 Worker 里，消息协议统一 `{ type, data }` 信封。

大厅、断线重连、房间码、玩家资料这些每个联机游戏都要的东西，抽成了共享包 [lobby-kit](./packages)：WebSocket 客户端自动重连、6 位房间码、身份 token、26 张头像。新游戏接入只需三步，见 [docs/LOBBY_KIT_GUIDE.md](./docs/LOBBY_KIT_GUIDE.md)。

## 本地跑起来

```bash
cd turtle-soup    # 任选一个项目
npm install
npm run dev       # Vite dev server

npx wrangler dev  # 联机游戏本地调试 DO，多开浏览器标签测多人
```

部署是各游戏独立 `wrangler.toml`：

```bash
npm run build && npx wrangler deploy
```

详细的从零上线流程（域名、DNS、DO migration、密钥管理）写在 [docs/GAME-DEPLOY.md](./docs/GAME-DEPLOY.md)。

## 踩坑记录

每个项目有自己的 `docs/lessons-learned.md`。做新功能前先扫一眼相关项目的教训，能省不少重复踩坑的时间。

---

*最后更新：2026-08-29*
