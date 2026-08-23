# turtle-soup 待办问题

## 未解决

### BUG: AI 复盘按钮始终不显示（房主视角）
- 现象：房主打开右侧侧边栏，看不到"AI复盘/AI辅助复盘提示"按钮；但手写复盘笔记功能正常。
- 排查已做：
  - 后端 `amI.isHost=true`（AI 模式房主）已确认正确
  - `canAIHint = game.amModerator || game.isHost` 传参正确（RoomView 第 395 行）
  - 按钮在 DrawerPanel 头部 + 底部两处都放了，仍不显示
  - 推断：疑似前端运行时 `canAIHint` 为 false，或 `amI.isHost` 在前端 store 未正确 hydrate，或浏览器缓存旧 JS
- 下次排查方向：
  1. 用浏览器 DevTools 检查 `game.amI` / `game.isHost` 运行时值
  2. 检查 store hydrate 是否被 `s.amI` 覆盖丢失（enterRoom 后首包 game_state 时序）
  3. 确认是否浏览器强缓存旧版本（清缓存/无痕重试）
  4. DrawerPanel 里加临时 console.log 定位 `canAIHint`

## 已解决
（无）
