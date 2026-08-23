# 当前状态（card-game）

> 最近更新：2026-08-14

## 项目概况
回合制联机网页打牌游戏，部署于 Cloudflare Workers 免费版。
线上地址：https://card-game.soiciactlybm.workers.dev
状态：已上线，基础流程可玩，游戏规则为 Mock 占位。

## 技术栈
- 前端：Vue3 + Vite + Tailwind（组件化，三层隔离：core/game/network）
- 后端：Cloudflare Workers + Durable Objects（GameRoom 每桌一实例 + Lobby 单例）
- 通信：WebSocket（Hibernation API），房间走 REST

## 最近进展（2026-08-14）
- 完成部署上线
- 修复 Hibernation 内存状态丢失（改用 serializeAttachment + getWebSockets）
- 修复 K 卡死全场（全场跳过 -> 桌面重置回到出牌者）

## 遗留事项
- [ ] 游戏规则为 Mock（"出牌必须 >= 上家"简化接龙），真实玩法未定
- [ ] 本机到 Cloudflare 网络不稳定，线上验证需重试

## 如何继续
```
cd D:\cloudflareGame\card-game
npx wrangler dev   # 本地联调
npx wrangler deploy  # 部署上线
```
回归测试：`node scripts/ws-test.mjs <roomId>`（需先 wrangler dev 起本地）
