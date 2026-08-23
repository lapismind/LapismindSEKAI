---
title: '从零到一：我的第一个上线作品「真冬的海龟汤」'
description: '海龟汤游戏的开发与上线记录：从想法到 Cloudflare Workers 免费部署，第一个真正跑在公网上的作品。'
pubDate: 'Aug 14 2026'
heroImage: '../../assets/turtle-soup-cover.png'
---

## 为什么做海龟汤

海龟汤是一种逆向推理游戏：主持人给出一个奇怪的"汤面"（一句话谜题），玩家通过提问还原完整"汤底"（真相）。主持人只能回答是 / 否 / 是也不是 / 无关。

这个游戏天然适合联机，也天然适合 AI 来当主持人——判定玩家的问题只需要理解"是否接近真相"，这正是大模型擅长的事。

## 技术选型

- **前端**：Vue3 + Vite + Tailwind
- **后端**：Cloudflare Workers + Durable Objects（WebSocket 实时通信，SQLite 持久化房间状态）
- **AI 主持**：OpenCode Go 的 deepseek-v4-flash，OpenAI 兼容端点

选 Cloudflare 免费版的考虑：一个个人项目，不想为服务器掏钱。Workers 的免费额度对一个小游戏完全够用，Durable Objects 的 Hibernation 休眠机制让房间空闲时不计费。

## 架构设计

每局游戏一个 Durable Objects 实例（`SoupRoom`），全局一个谜题库实例（`PuzzleLib`）：

```
浏览器 ──WebSocket──► Worker 入口
                        ├─ /ws  → SoupRoom（每桌一实例）
                        ├─ /api → PuzzleLib（谜题库）
                        └─ 静态资源 → 前端 dist/
```

## 遇到的两个坎

**1. AI 判定超时会卡死游戏。** 兜底方案是关键词判定：AI 没响应时自动降级，至少保证游戏能继续。这个"降级保底"的思路后来被证明确实管用——AI 端点偶发超时，但玩家体验不到中断。

**2. 国内网络访问 workers.dev 不稳定。** 最终把域名绑定到自己的 `soup.qmzhj.top`，用 Cloudflare Custom Domain（而非 Routes），自动建 DNS 记录和证书，稳定多了。

## 上线

2026-08-14，v1.0.0 正式上线：https://soup.qmzhj.top

这是第一个真正跑在公网上的作品。从玩别人的游戏，到自己搭一个给大家玩，感觉完全不同。
