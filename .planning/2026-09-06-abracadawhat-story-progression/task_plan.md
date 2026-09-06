# 出包魔法师故事成就实施任务

## 目标

按已确认设计实现故事成就、法师档案、本局故事、最近战报和关键结算 UX。玩家可见的故事稀有度统一使用四星、三星、二星、一星，不显示内部 S/A/B/C。

## 阶段

- [complete] 1. 编写并审查实施计划
- [in_progress] 2. A：正确性与关键 UX 修复
- [pending] 3. B：服务端事实与故事引擎、局后复盘
- [pending] 4. C：传奇成就、法师档案与旧成就迁移
- [pending] 5. D：最近十场战报与个人资料展示
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
