# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。

> 日期：2026-09-15
> 性质：工程约定 + 修复（已完成并推送；本次**未部署**，线上无变化）
> Git：`2eaf4d3`（路径统一，已推送）；本文件与归档随本次收工提交一并推送
> 上一轮：blog 动效 / Live2D 性能 / 浮动控件修复，已归档到 [`2026-09-15-blog-动效与性能-handoff.md`](./2026-09-15-blog-动效与性能-handoff.md)

## 本轮目标

两台设备把仓库放在不同目录（一台 `D:\LapismindSEKAI`，另一台 `C:\Projects\Web\LapismindSEKAI`），
仓库里写死的绝对路径在其中一台上必然失效。要求：**统一改成相对路径**，
且**不能**简单地把旧路径替换成当前这台机器的路径（那样只是把问题换个方向）。

## 执行摘要

- **三个脚本是真会坏的，不只是文档问题**（`2eaf4d3`）：`blog/convert_cursor.py`、
  `blog/sekai-demo/live2d-preview/download-normal.ps1`、`blog/sekai-demo/live2d-preview/cleanup.ps1`
  原来写死 `D:/LapismindSEKAI/...`，改成**按脚本自身位置解析**。
- **`docs/MIGRATION-NOTES.md` 整篇重写**：原第二章是"必须修改的 3 处硬编码路径"，
  并教你 `把 D:/... 全部替换为 C:/...`——正是要避免的做法。现改为「路径约定」，
  说明脚本已自解析、换机器无需改任何路径，并给出新脚本该遵守的规则。
- **其余文档改为仓库内相对路径**：命令写成 `cd blog` 并注明"在仓库根目录执行"，
  指路用 `blog/`、`docs/`（`BLOG-DEPLOY.md`、`GAME-DEPLOY.md`、`packages/README.md`、showhand 设计文档等）。
- **两处个人绝对路径改环境变量**：`%APPDATA%\...`（wrangler 凭证位置）、`%USERPROFILE%\...`（npm 装错位置的教训）。
- **约定写进接力文档**：`docs/agent/handoff.md` 的「硬限制」新增一条——仓库内脚本与文档一律写相对路径，不写盘符。
- 共 17 个文件，`54 insertions(+), 42 deletions(-)`。

## 关键决策（git 查不到的部分）

- **按"脚本自身位置"解析，而不是写死任何一台机器的路径**：PowerShell 用 `Join-Path $PSScriptRoot "mafuyu"`，
  Python 用 `os.path.dirname(os.path.abspath(__file__))`。这样换机器、换目录、改仓库名都不用再动。
- **文档用"仓库内相对路径 + 描述性说法"两种表达**：能给可执行命令的地方写 `cd blog`（附"在仓库根目录执行"），
  只做指路的地方写 `blog/`、`docs/`。比绝对路径更耐迁移，也比纯占位符更可读。
- **外部目录去掉盘符、改为角色描述**：`D:\tianxunruida\docs\通用错误记忆库.md` → "外部通用错误记忆库
  （Agent 配置目录下的 `docs/通用错误记忆库.md`，不在本仓库内）"；`D:\AGENT` → "Agent 配置目录"。
  这些目录不在仓库里，写相对路径没有意义，所以只去掉设备相关的盘符。
- **不动 `.planning/` 里的历史证据**：`.planning/2026-09-06-abracadawhat-story-progression/`
  有 3 处盘符路径（一条命令记录 + 两处直接粘贴的 wrangler 原始输出）。那是逐字保留的历史证据，
  改它等于篡改记录；且不是仓库路径、不影响任何东西运行。**有意保留，不是漏改。**
- **`docs/lessons-learned.md` 的 `D:/xxx/yyy` 与 `sync.ps1` 的 `C:\x\y` 也保留**：那是讲正反斜杠写法差异的占位示例。

## 验证证据

- **三个脚本**：PowerShell 两个文件 `[scriptblock]::Create()` 解析通过；`$PSScriptRoot` 解析出的目标目录
  `blog/sekai-demo/live2d-preview/mafuyu` **确实存在**（7 个文件在内）。Python 脚本 `ast.parse` 通过，
  解析出的 `blog/public/cursors` **存在**。
- **未实际执行这三个脚本**（待确认）：`cleanup.ps1` 会**删文件**、`download-normal.ps1` 会**联网下载**，
  所以只做了语法与路径解析验证，没有跑端到端。真要确认请手动跑一次 download（会覆盖 `mafuyu/` 下的模型文件）。
- **全仓库复核命令**（写进了 `MIGRATION-NOTES.md` 的验证清单）：
  `git grep -nIE '(^|[^A-Za-z0-9])[A-Za-z]:[\\/]'`，剩余命中已逐条核对，全部是上面「有意保留」的项。
  注意这条命令的 `-I` 不能省：不加会把 webp/mp3/moc3 等二进制文件里的随机字节当成命中。
- **本次没有跑 `npm run build` / `test`**：改动只涉及文档与两个一次性脚本，不进入任何构建产物或线上代码。
  按"没验证的结论必须标明"的要求，这里明确标注为**未跑**（非"通过"）。

## 生产状态

- **未部署，四个线上站点均无变化**（本次没有触碰任何 Worker、前端产物或 wrangler 配置）。
- 线上仍是上一轮状态：`blog.qmzhj.top` Version `bc42df85`（对应 `02a3182`）。
- 无需回滚。

## 关键文件

| 文件 | 作用 |
|---|---|
| `docs/MIGRATION-NOTES.md` | 迁移说明 + **路径约定（第二节）**，换机器的唯一入口 |
| `docs/agent/handoff.md` | 接力协议；「硬限制」里有"一律写相对路径"的新约定 |
| `blog/convert_cursor.py` | 改为按 `__file__` 定位 `public/cursors` |
| `blog/sekai-demo/live2d-preview/{download-normal,cleanup}.ps1` | 改为 `Join-Path $PSScriptRoot "mafuyu"` |
| `scripts/sync.ps1` | 收工命令；本身是**无 BOM** 的 UTF-8 文件，见下方踩坑 |
| `docs/lessons-learned.md` | 新增 2026-09-15 条目（PowerShell 编码坑） |

## 踩坑记录

**1. `sync.ps1` 在 Windows PowerShell 5.1 下直接报语法错误（最容易再犯）**

用 `powershell -File scripts/sync.ps1 ship -m "..."` 会得到一堆
`字符串缺少终止符` / `缺少右"}"`，看起来像脚本被改坏了。**实际是编码问题**：
`sync.ps1` 是 UTF-8 **无 BOM** 且含中文字符串，5.1 对无 BOM 文件默认按 ANSI/GBK 解码，中文乱码后让引号提前闭合。
解析阶段就失败，脚本一行都没执行（所以不会误提交）。

**用 `pwsh`（PowerShell 7）执行即可**——7.x 默认按 UTF-8 读无 BOM 文件。本机 `pwsh` 7.6.6、5.1 为 5.1.26100。
已记入 `docs/lessons-learned.md`。彻底消除差异的办法是给脚本加 UTF-8 BOM（3 字节），**尚未做**（见"下次可做之事"）。

**2. `grep` 的盘符模式容易写出假阳性/假阴性**

搜绝对路径时 `[A-Za-z]:[\\/]` 会把 `https://` 全部匹配进来（`s:/` 命中）；
反过来漏掉 `-I` 会让 webp/mp3/moc3 的二进制随机字节刷屏。正确写法见上面的复核命令。
另外用 `grep -f 模式文件` 传递含 `\\` 的模式在 Git Bash 下不可靠（实测漏报过），建议直接写 `git grep -E '模式'`。

## 当前状态

- 路径统一已完成、已推送。工作区本来干净，本次新增的是**归档文件 + 本文件 + 一条 lessons 记录**，随收工提交一起推送。
- **没有进行中的半成品。**
- 唯一遗留的"未做"是 `sync.ps1` 的 BOM 修复（见下），以及 `.planning/` 的历史路径（有意保留）。

## 推荐技能

- 接手本文件 → 直接读即可，本文件是自足的。
- 继续博客侧工作 → 先读归档 `2026-09-15-blog-动效与性能-handoff.md`，那里的"下次可做之事"仍然有效。
- 要动设计语言 → 先读 `packages/design-kit/README.md`（令牌唯一真源，禁止在项目里重写）。

## 环境与权限

- **收工/开工命令必须用 `pwsh`，不要用 `powershell`**：
  `pwsh -NoProfile -File scripts/sync.ps1 ship -m "..."` / `... pull`
- 部署（如需要）：`blog` 目录下 `npm run build && npx wrangler deploy`（wrangler 已登录）。
- 本地验证：`npx astro preview` **不跑 Worker**；验证 Worker 行为要用 `npx wrangler dev`。
- 浏览器验证：Python 3.13 的 Playwright（见 `docs/agent/scripts/`）。
- 本地 auth 服务默认 `http://localhost:8787`，不启动时页面出现 `net::ERR_FAILED` 属**预期现象**，不是回归。

## 阻塞项

无。

## 下次可做之事（按推荐排序，均未与用户确认）

1. **给 `scripts/sync.ps1` 加 UTF-8 BOM**（3 字节）：让 5.1 与 7 都能跑，消除"某台机器只有 5.1 就翻车"的隐患。
   做完把 `docs/lessons-learned.md` 里"要彻底消除…"那句改成"已加 BOM"。成本极低、收益明确。
2. **博客侧那批方向仍然有效**，完整清单见归档 `2026-09-15-blog-动效与性能-handoff.md`，
   最推荐的两条：把上一轮工作写成一篇博客（素材现成）；把三个游戏的战绩/成就串成跨游戏看板。
3. **`.planning/` 的历史路径**：若要清理，3 处（1 条命令记录 + 2 处 wrangler 原始输出粘贴）。
   本次**有意不动**——那是逐字历史证据，改它等于篡改记录。用户明确要求时再动。

**不建议**：把任何文档里的示例路径"统一"成当前这台机器的绝对路径——那正是本次要消除的问题。
