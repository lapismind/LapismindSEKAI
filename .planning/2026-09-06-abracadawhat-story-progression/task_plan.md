# 出包魔法师故事成就实施任务

## 目标

按已确认设计实现故事成就、法师档案、本局故事、最近战报和关键结算 UX。玩家可见的故事稀有度统一使用四星、三星、二星、一星，不显示内部 S/A/B/C。

## 阶段

- [complete] 1. 编写并审查实施计划
- [complete] 2. A：正确性与关键 UX 修复
- [complete] 3. B：服务端事实与故事引擎、局后复盘
- [complete] 4. C：传奇成就、法师档案与旧成就迁移
- [complete] 5. D：最近十场战报与个人资料展示
- [pending] 6. 全链路审阅、生产验证、部署与收尾

## 约束

- 遵循 TDD，先看测试失败，再改生产代码。
- 每阶段由实现 Subagent 提交，随后独立审阅；Critical/Important 未清零不得进入下一阶段。
- 游戏 Worker 是事实来源；Auth 负责校验、解锁和保存；前端不重新推导事实。
- 故事内部可使用 S/A/B/C 排序；玩家界面只能显示 `★★★★ / ★★★ / ★★ / ★`。
- 故事星级是世界观稀有度，不声称来自达成率统计。
- 不纳入准备系统、房主迁移、重赛投票、排行榜、赛季和观战。

## 错误记录

| 错误 | 尝试 | 处理 |
|---|---:|---|
| 读取实施计划时 offset 1001 超出 767 行范围 | 1 | 前两次读取已覆盖完整文件；确认总行数后不再请求越界片段。 |
| A1 路由 RED 首次被假 D1 不支持 matches INSERT 污染 | 1 | 为该测试提供覆盖完整旧上报路径的专用假 D1，重新运行直到得到纯业务断言 RED。 |
| A1 review 修复的 turnSpellSets 上限测试把 36+1 个跨回合事件误写成单回合超限 | 1 | 改为同一回合 37 个事件，准确验证每回合 36 上限；保留总事件独立上限。 |
| A3 Playwright 测试夹具首次运行未挂载，定位按钮超时 | 1 | 该结果不算行为 RED；先采集 browser console/pageerror 和入口响应，修复夹具后再验证目标断言。 |
| A3 夹具诊断发现 Vue runtime-only 不支持 JS 内联 template | 2 | 改用 test-only `.vue` SFC，由项目已有 Vite Vue 插件编译，不修改生产 Vue alias。 |
| A3 夹具同时存在两个“猫头鹰效果说明”导致 Playwright strict mode | 3 | 将 SpellCard 定位限定到对应 `data-testid` 容器，公共区定位限定到自身 section。 |
| A3 Playwright `page.on` 直接传 `list.append` 抛 AttributeError | 4 | 改用 lambda 包装事件参数后追加到列表。 |
| B1 migration test 用 `npx.cmd` + `shell: false` 未启动 | 1 | 改为读取 Wrangler package 的真实 bin 路径并由 Node 直接启动，保留参数边界。 |
| B1 preflight 经 shell 传多行 SQL 被拆成未知参数 | 2 | 预检改读仓库 SQL 文件，并由 Node 直接调用 Wrangler CLI。 |
| B1 只读 SQL 测试把注释里的 delete 当成语句 | 3 | 扫描前剥离 `--` 注释，只检查 executable SQL。 |
| B1 final 真实 D1 测试 readiness fetch 无超时 | 1 | 增加 500ms AbortSignal 与 15 次有界重试，失败打印 Wrangler stdout/stderr。 |
| B1 final 临时 Wrangler config 使用不同 database ID | 2 | 复用仓库公开 D1 ID，并继续用独立 `persist-to` 隔离默认本地库。 |
| B1 final fixture legacy match 使全表计数多一行 | 3 | v2 幂等断言限定 `report_id IS NOT NULL`，保留 legacy fixture。 |
| B2 pre-damage 补丁残留旧循环变量并重复声明 `victim` | 1 | 立即读取修改片段，删除旧引用；后续状态变量替换后先做聚焦语法/测试验证。 |
| B2 v2 完整性标记使现有手工 v2 fixture 走 v1 fallback | 1 | 仅给明确表示 B2-capable v2 的 fixture 增加 `factsVersion: 2`；旧持久房间 fixture 保持无标记验证 fallback。 |
| 更新进度时误写 B1 SHA，补丁上下文不匹配 | 1 | 补丁整体未应用；读取真实进度后用准确 `bbf82dc` 追加。 |
| Todo 列表写入 D1 优先级和 D4 描述时混入草稿字符 | 1 | 立即用完整列表覆盖校正，未影响代码或任务状态。 |
| Stage C 进度补丁标题混入草稿字符 | 1 | 整体未应用；使用计划中的准确标题重做。 |
