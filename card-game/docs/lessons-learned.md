# card-game 错误记忆

> 供本项目及 D:\LapismindSEKAI 下其他项目复用。跨项目通用教训已提炼到 D:\tianxunruida\docs\通用错误记忆库.md。

## 2026-08-14

### 1. Durable Objects 的 WebSocket 用 Hibernation 时禁止内存 Map 存连接映射
- 现象：多玩家互相看不到、操作被静默忽略；本地快速测试通过，线上必炸。
- 根因：DO 休眠后内存清空，`socketToPlayer` Map 丢失。
- 教训：Hibernation 模式下，连接相关状态必须用 `socket.serializeAttachment()` 持久化，遍历用 `ctx.getWebSockets()`。
- 检测：本地测试必须加"等待 DO 休眠 -> 唤醒后继续操作"的场景，只测快速连续操作会漏掉这类 bug。

### 2. 回合制游戏的"最大牌死局"必须有兜底
- 现象：打出全场最大牌后所有人只能无限跳过。
- 根因：比较类规则（出牌 >= 上家）无重置机制。
- 教训：任何"比大小"规则都要考虑"没人能大过"的情况，常见解法是全场跳过时重置桌面回到最后出牌者。
- 检测：针对规则边界写专门测试脚本（scripts/ws-rule-k.mjs）。

### 3. Cloudflare 免费计划 DO 必须用 new_sqlite_classes
- 现象：deploy 报 code:10097。
- 教训：免费计划只支持 SQLite 存储后端，wrangler.toml 的 migrations 必须写 `new_sqlite_classes`，不能用 `new_classes`。

### 4. 部署验证注意本机到 Cloudflare 的网络连通性
- 现象：REST/WebSocket 时好时坏（ETIMEDOUT / HTTP 000），误以为代码有问题。
- 教训：先确认本机出口到目标域名的 TCP 连通性（Test-NetConnection），区分网络问题和代码问题。
