# Agent 规范索引

> 根 `AGENTS.md` 只写最重要的规则和编排，细则一律放这里。
> 本目录是 Agent 规范的总入口：不知道读什么时，先读这一页。

## 什么时候读哪份

| 文件 | 什么时候读 |
|---|---|
| [`handoff.md`](./handoff.md) | **跨设备/跨会话接手**时；离开一台机器前收尾时 |
| [`archiving.md`](./archiving.md) | 要写交接日志、归档本轮工作时（含日志该记什么、放哪、文件名规则） |
| [`deploy.md`](./deploy.md) | 要部署任何一个站、或换机器后要恢复部署能力时 |
| [`scripts/`](./scripts) | 要用 Playwright 复现线上问题、跑一次性冒烟、做部署后验收时 |
| [`../../.planning/README.md`](../../.planning/README.md) | 长任务要落地计划文件时 |
| [`../MIGRATION-NOTES.md`](../MIGRATION-NOTES.md) | 换新电脑、搭新环境时 |
| [`../lessons-learned.md`](../lessons-learned.md) | 踩坑记录（仓库级）；各项目另有自己的同名文件 |

## 两个固定入口，别自己找

- **接手上一段工作** → `docs/session-logs/CURRENT.md`（永远代表"当前进行中"）
- **本项目 Agent 规则** → 本文件

## 与其他文档的分工

- 各项目 `AGENTS.md`：该项目的专属约定（项目地图、命令、边界）。
- 各项目 `docs/lessons-learned.md`：该项目踩过的坑。
- `docs/session-logs/`：工作交接与里程碑归档，**不是**日常流水账。
- `.planning/`：仍在进行中的任务计划与调查证据。
