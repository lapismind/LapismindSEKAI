# packages —— 跨游戏共享包

D:\LapismindSEKAI 下所有游戏的共享代码都放在这里，**避免复制粘贴式复用**（同一份逻辑在多个游戏里各改一份，改 bug 要改 N 处）。

## 目录结构

```
packages/
└── lobby-kit/     @lapismind/lobby-kit —— 大厅通用件（纯逻辑层）
```

各游戏通过 npm `file:` 本地依赖引用，例如 showhand 的 package.json：

```json
"dependencies": {
  "@lapismind/lobby-kit": "file:../packages/lobby-kit"
}
```

---

## @lapismind/lobby-kit

多人联机游戏的大厅通用件，**纯逻辑层（无 UI、不依赖 Vue/Pinia/Vite）**，可单测。

### 包含模块

| 模块 | 导出 | 说明 |
|------|------|------|
| `protocol.js` | `makeMessage(type, data)` / `isServerMessageValid(raw)` | 消息统一 `{ type, data }` 信封，校验器用于 ws-client 过滤非法消息 |
| `ws-client.js` | `createWSClient({ wsImpl, makeMessage, isServerMessageValid, reconnectDelayMs, maxRetry })` | WebSocket 客户端：连接 / 指数退避断线重连 / 消息分发 / 单例 |
| `room-code.js` | `generateRoomCode(len=6)` / `isValidRoomCode(code)` | 6 位房间码，排除易混淆字符（0/O/1/I） |
| `player-id.js` | `generatePlayerId()` / `isValidPlayerId(id)` | `p + 时间戳36进制 + 随机`，会话内唯一 |
| `lobby-store.js` | `createLobbyStore()` | 大厅状态工厂：昵称 / 头像 / playerId / 房间码，返回普通对象（非响应式），Pinia 侧薄包装 |
| `avatars/` | `avatars/list.js`：`AVATAR_FILES` / `AVATAR_COUNT` / `isValidAvatarId` | 26 张头像 png + 纯数据清单；图片资源经 `@lapismind/lobby-kit/avatars/` 子路径导出 |

### 在新游戏接入（三步）

1. **装依赖**

```bash
npm install @lapismind/lobby-kit@file:../packages/lobby-kit
```

2. **写自己游戏的协议**（包不定义具体消息类型，由游戏侧定义）

```js
// src/core/protocol.js
export const Msg = {
  SEND_JOIN: 'join',
  RCV_ROOM_STATE: 'room_state',
  // ... 本游戏的消息类型
}
```

3. **薄包装出 wsClient / lobbyStore**

```js
// src/network/wsClient.js
import { createWSClient } from '@lapismind/lobby-kit'
import { makeMessage, isServerMessageValid } from '../core/protocol'
export const wsClient = createWSClient({ makeMessage, isServerMessageValid })
```

```js
// src/stores/lobbyStore.js
import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { createLobbyStore } from '@lapismind/lobby-kit'

export const useLobbyStore = defineStore('lobby', () => {
  const kit = createLobbyStore()
  const state = reactive(kit.state) // 纯对象 → Pinia 响应式
  return { ...state, setNickname: kit.setNickname, setAvatar: kit.setAvatar }
})
```

### wsClient API

```js
wsClient.connect({ roomId, nickname, playerId, avatarId, url })
// url 缺省时自动拼同源 /ws?roomId=..&nickname=..&playerId=..&avatarId=..
// url 只用于自定义连接地址（如测试）

wsClient.send(type, data)         // 封包发送，未连接时丢弃
wsClient.on(type, handler)        // 订阅，返回取消订阅函数
wsClient.disconnect()             // 主动断开，不再重连
wsClient.connected                // getter，连接状态
```

- 收到消息自动按信封校验，非法消息丢弃不触发 handler
- 断线自动重连（指数退避，最多 maxRetry=5 次，上限 10s），重连后自动恢复原会话参数

### 测试

```bash
cd packages/lobby-kit
npm test        # 跑全部 5 个模块测试
```

新增模块/改动时遵循 TDD：先在 `tests/` 写失败测试，再实现，`npm test` 全绿后提交。

### 已知注意点

- `file:` 依赖是**本地路径引用**，改包源码后无需重新 install，但注意包改动后要在游戏侧重新 `npm install`（或重跑 `npm install @lapismind/lobby-kit@file:../packages/lobby-kit`）让 node_modules 里的副本同步
- 包是纯逻辑，**别把 UI 组件/样式放进来**——各游戏的 UI 定制差异大，UI 层保持各游戏自持
- 游戏特有逻辑（如海龟汤的谜题列表）放游戏侧 store，不要混进包

---

## 新增一个包

```bash
mkdir packages/<pkg-name>
cd packages/<pkg-name>
git init
git branch -m main
# 写 package.json（main/exports/files 指向 src/），TDD 开发，README 补充用法
```
