# @lapismind/lobby-kit

多人联机游戏大厅通用件。纯逻辑层，不依赖 Vue/Pinia/Vite，可直接 `node` 单测。

## 模块契约

### src/protocol.js
- `makeMessage(type, data = {})` → `{ type, data }`
- `isServerMessageValid(raw)` → boolean。信封必须：对象、非数组、`type` 为字符串、`data` 缺省或为非数组对象

### src/ws-client.js
- `createWSClient({ wsImpl, makeMessage, isServerMessageValid, reconnectDelayMs = 500, maxRetry = 5 })`
  - `wsImpl` 注入 WebSocket 构造函数（浏览器默认 `globalThis.WebSocket`，测试传 Fake）
  - `makeMessage` / `isServerMessageValid` **必填**，缺失抛错
- 返回：`{ connected, connect, disconnect, send, on, off, _emit }`
  - `connect({ roomId, nickname, playerId, avatarId, url })`，`avatarId` 可选
  - 重连闭包持有 session，`disconnect()` 置 null 后不再重连
  - `_emit` 仅供测试

### src/room-code.js
- `generateRoomCode(length = 6)` → 字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（去 0/O/1/I）
- `isValidRoomCode(code)` → 校验（trim 大写后恰 6 位且字符集匹配）

### src/player-id.js
- `generatePlayerId()` → `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
- `isValidPlayerId(id)` → `p` 开头且长度 > 1（宽松校验）

### src/lobby-store.js
- `createLobbyStore()` → `{ state, setNickname, setAvatar, joinByCode }`
  - `state` 普通对象：`{ myPlayerId, myNickname='玩家', myAvatarId='0', roomCode='' }`
  - `setNickname(name)`：trim，空/空白回退 '玩家'
  - `setAvatar(id)`：`String(id)`
  - `joinByCode(raw?)`：`(raw ?? state.roomCode).trim().toUpperCase()`，空返回 null
  - **每次调用返回独立实例**（state 不共享）

### avatars/list.js
- `AVATAR_FILES` → `['1.png'..'26.png']`
- `AVATAR_COUNT` → 26
- `isValidAvatarId(id)` → `Number(id)` 为 1-26 整数
- 图片经子路径导出：`@lapismind/lobby-kit/avatars/1.png`（在 package.json exports 里配了 `./avatars/*`）

## 测试

```bash
npm test   # protocol → room-code → player-id → ws-client → lobby-store
```

ws-client 测试用内存 FakeWS，注意**共享实例数组会串测**，每段测试前 `FakeWS.instances = []` 重置。
