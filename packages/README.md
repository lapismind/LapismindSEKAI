# packages —— 跨游戏共享包

D:\LapismindSEKAI 下所有游戏的共享代码都放在这里，**避免复制粘贴式复用**（同一份逻辑在多个游戏里各改一份，改 bug 要改 N 处）。

## 目录结构

```
packages/
├── lobby-kit/      @lapismind/lobby-kit   大厅通用件（纯逻辑层 + 少量共享 Vue 组件）
├── chat-kit/       @lapismind/chat-kit    多人聊天与表情（Vue 组件 + 表情资源）
└── design-kit/     @lapismind/design-kit  设计语言（CSS 令牌 + 基础样式 + 字体资产）
```

各项目通过 npm `file:` 本地依赖引用，例如 showhand 的 package.json：

```json
"dependencies": {
  "@lapismind/lobby-kit": "file:../packages/lobby-kit",
  "@lapismind/design-kit": "file:../packages/design-kit"
}
```

**分层原则**：按"哪种复用"分包，不按技术栈分包。

- **逻辑复用** → `lobby-kit`（协议信封、重连、房间码、身份）
- **功能复用** → `chat-kit`（整套聊天能力，含 UI 与资源）
- **视觉复用** → `design-kit`（配色、字体、圆角、阴影、层次规则）

包内可以有 UI 与静态资源。判断标准不是"有没有 UI"，而是**"各项目是不是该长得一样"**：聊天面板与配色该一样，所以进包；牌桌、棋盘这类游戏核心界面差异大，留在各自项目里。

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
| `auth.js` | `createAuthClient(opts)` / `getSharedAuth(opts)` | 统一认证客户端：init 自动游客登录/读跨子域会话、GitHub/账号登录、游客升级注册、getIdentity/refresh、成就查询；getSharedAuth 为页面级共享实例 |
| `vue/` | `ProfileEditor.vue` / `AuthBadge.vue` | 共享 Vue 组件：个人资料编辑（昵称+头像九宫格）；统一身份徽章（登录状态展示 + GitHub/账号登录/注册入口），经 `@lapismind/lobby-kit/vue` 导出 |
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
- `lobby-kit` 是纯逻辑层，**别把 UI 放进这个包**——它是"逻辑复用"包。UI 该不该进包看分层原则（见上）：`chat-kit` / `design-kit` 就是专门装 UI 与样式的包
- 游戏特有逻辑（如海龟汤的谜题列表）放游戏侧 store，不要混进包
- **大体积二进制资源不进 git**（字体、表情包等）：在包目录放一份真源，消费方构建/开发前用脚本同步到自己的 `public/`，并把产物目录 gitignore。`chat-kit/emojis/` 与 `design-kit/fonts/files/` 都按此处理

---

## 新增一个包

```bash
mkdir packages/<pkg-name>
cd packages/<pkg-name>
git init
git branch -m main
# 写 package.json（main/exports/files 指向 src/），TDD 开发，README 补充用法
```
