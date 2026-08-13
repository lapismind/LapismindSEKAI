# 🫕 真冬的海龟汤

回合制联机海龟汤推理游戏，基于 Cloudflare Workers 免费版部署。

> 玩家根据"汤面"（谜题描述）向主持人提问，主持人只能回答"是 / 否 / 是也不是 / 无关"，大家推理出"汤底"（真相）即胜出。

线上地址：https://turtle-soup.soiciactlybm.workers.dev

## 功能特性

- **AI 主持 & 真人主持双模式**
  - AI 模式：`deepseek-v4-flash` 担任主持人"大肥鱼"，自动判定玩家提问
  - 真人模式：玩家自愿报名当主持人，多人报名随机抽取，无人报名自动抽一位
- **完整规则**
  - 提问节流：3 秒内仅允许一个玩家提问
  - 问题次数限制：房主可设置全场问题上限，用尽后等待揭底
  - 模糊回答"是也不是"：部分正确但非真相时主持人会给出
- **观战系统**
  - 玩家人数上限 2-8 完整可选
  - 房间满员自动转观战，也可手动切换观战/玩家
  - 观战不能提问，但可参与右侧复盘讨论，不占环形布局
- **复盘系统**
  - 共享笔记：所有玩家可写、全员可见
  - AI 复盘提示：房主/主持人可让"大肥鱼"根据已问问题给出不剧透的提示
- **可视化反馈**
  - 主持人居中、玩家环形环绕布局，回答时指向提问者
  - 判定动图：是/否/是也不是/无关/通关各有专属奶茶鼠动图
- **玩家体验**
  - 26 张默认头像可选
  - 汤面可折叠纸片卡片
  - 右侧滑出侧边栏（问答记录 / 复盘）
  - 自定义谜题提交，提交后房主选谜题时可见

## 技术架构

```
浏览器 ──WebSocket──► Worker 入口(index.js)
                        ├─ /ws     → SoupRoom DO（每局一个实例）
                        ├─ /api    → PuzzleLib DO（谜题库）
                        └─ 静态资源  → 前端 dist/

SoupRoom DO（每桌一实例）
├─ 玩家/观战/主持人身份管理
├─ 牌局状态持久化（SQLite，Hibernation 休眠不计费）
├─ 提问 → AI 判定（OpenCode Go 端点）或真人主持
└─ 复盘笔记 / AI 复盘提示
```

| 组件 | 说明 |
|------|------|
| 前端 | Vue3 + Vite + Tailwind，三层隔离（core / game / network） |
| 后端 | Cloudflare Workers + Durable Objects |
| AI | OpenCode Go `deepseek-v4-flash`，OpenAI 兼容端点 |
| 存储 | Durable Objects SQLite（房间状态 + 自定义谜题） |

## 本地开发

```bash
npm install
npm run dev          # 前端本地预览（Vite）
npx wrangler dev     # 本地联调（含 DO 与 WebSocket，端口 8788）
```

### 配置

- `.dev.vars`（本地，已 gitignore）：`AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`
- 部署时用 `wrangler secret put AI_API_KEY` 配置线上 key

## 部署

```bash
npm run build        # 构建前端
npx wrangler deploy  # 部署到 Cloudflare
```

部署前需 `wrangler login` 授权。首次部署 DO 类通过 `new_sqlite_classes` migration 注册。

## 测试脚本

本地联调回归测试（`scripts/`）：

```bash
npx wrangler dev --port 8788   # 先启动本地
node scripts/ws-human2.mjs     # 真人主持全流程
node scripts/ws-ai2.mjs        # AI 主持全流程（需 key）
node scripts/ws-apply2.mjs     # 主持人报名机制
node scripts/ws-spectator-test.mjs      # 观战机制
node scripts/ws-spectator-switch.mjs    # 观战手动切换
```

## 项目结构

```
├── src/
│   ├── ai/           AI 主持调用（OpenAI 兼容）
│   ├── components/   UI 组件（牌桌/侧边栏/面板/模态框）
│   ├── core/         消息协议、通用工具
│   ├── game/         判定逻辑、动图映射、头像
│   ├── network/      WebSocket 客户端、REST
│   ├── stores/       Pinia 状态
│   ├── views/        大厅 + 房间
│   └── worker/       Worker 入口 + Durable Objects
├── assets/           原始素材（动图、头像）
├── data/puzzles.json 内置谜题
└── scripts/          联调测试脚本
```

## 常见问题

- **AI 判定失败/超时**：会自动降级为关键词兜底判定，保证游戏能继续
- **本机连不上线上**：部署在 workers.dev，国内网络访问可能不稳定，刷新重试即可
- **动图不显示**：判定动图在提问玩家头顶弹出，几秒后消失，属正常交互
