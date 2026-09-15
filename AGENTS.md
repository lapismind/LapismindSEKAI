# AGENTS.md — LapismindSEKAI 跨 Agent 约定

> 本文件只写**最重要的规则**和**编排**（去哪读什么）。细则一律放 `docs/agent/`，不要往这里堆。

## 会话启动（必做）

1. 读本文件。
2. 读 `docs/agent/README.md` —— Agent 规范总入口，按它的索引去读需要的细则。
3. **接手上一段工作时**，先读 `docs/session-logs/CURRENT.md`（跨设备/跨会话的唯一接力入口）。
4. 进入某个项目前，读该项目的 `AGENTS.md`。

## 会话收尾（离开这台机器前）

把状态写回 `docs/session-logs/CURRENT.md`，然后一条命令提交并推送：

```powershell
.\scripts\sync.ps1 ship -m "做到哪了 / 下次从哪继续"
```

跨设备开发的完整流程见 [`docs/agent/handoff.md`](docs/agent/handoff.md)。

## 最重要的四条

1. **先读规范再动手。** 入口是 `docs/agent/README.md`；各项目另有自己的 `AGENTS.md` 和 `docs/lessons-learned.md`。
2. **错误即时记录，禁止静默忽略。** 记入对应项目的 `docs/lessons-learned.md`；跨项目通用的再往仓库根 `docs/lessons-learned.md` 提炼。
3. **长任务先落地计划。** 用 planning-with-files 落到 `.planning/YYYY-MM-DD-任务名/`；完成后整理进 `docs/session-logs/`。
4. **"做到了"才算完成。** 功能实现要验证通过、逻辑通了要跑通；没验证的结论必须标明是待确认。

## 边界

- **不改已交付、不改已上线**，除非明确要求。
- **不擅自提交或部署**：可以建议，动手前先确认。
- 各项目的"不要动的地方"写在各自的 `AGENTS.md` 里（例如 `blog/AGENTS.md` 的看板娘位置）。

## 浏览器操作

- Python 3.13 的 Playwright。复现脚本放 `docs/agent/scripts/`。
