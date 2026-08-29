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

### src/auth.js —— 统一认证客户端 + 跨游戏共享登录

- `createAuthClient({ baseUrl, fetchImpl })` → 认证客户端实例；`baseUrl`
  默认生产 `https://auth.qmzhj.top`（非 qmzhj 域开发环境 fallback `http://localhost:8787`）
- `getSharedAuth(opts)` → **页面级共享实例**：main.js 预加载与 AuthBadge 等 UI
  共用同一个 client，避免重复 init，登录/注册后各处读到同一份身份
- `await auth.init()` → 页面加载调一次：/api/me 读跨子域会话；未登录自动走
  /api/guest 游客登录（服务端签发 playerId，写入 HttpOnly 会话 cookie）
- `auth.getUser()` → `{ provider, nickname, avatarUrl, playerId, avatarId, displayName? } | null`
- `auth.getIdentity()` → 归一化 `{ playerId, nickname, avatarId }`，创建/加入房间前
  用它填充大厅状态，保证 WebSocket 身份与会话 cookie 一致
- `auth.refresh()` → 重拉 /api/me（GitHub 回调回页/登录注册后刷新身份）
- `auth.loginWithGithub(redirectTo?)` / `auth.register(name, password)` /
  `auth.loginWithPassword(name, password)` / `auth.logout()`
- `auth.setAvatar(id)` / `auth.setNickname(name)`：登录用户落库，游客存 localStorage
- `auth.getAchievements()` → 成就展馆全量目录 + 解锁标记
- `auth.isGuest()`

**会话携带约定**：会话在 HttpOnly cookie 里（domain=.qmzhj.top），跨子域自动携带。
博客登录的用户进入游戏大厅时 init() 直接读到同一会话，无需二次登录；游客由 init()
自动签发会话。游戏侧接入步骤见 docs/LOBBY_KIT_GUIDE.md 的「统一登录」一节。

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

### src/vue/ —— 共享 Vue 组件（`@lapismind/lobby-kit/vue`）

- `<ProfileEditor v-model="draft" :avatar-choices="choices" />` 昵称 + 头像九宫格
- `<AuthBadge @identity-change="onIdentityChange" :dark="false" :compact="false" />`
  统一身份徽章：显示当前登录身份（GitHub 头像昵称 / 账号 / 游客），游客可一键
  GitHub 登录或用用户名密码注册升级/登录，登录态变化通过 identity-change 事件
  通知宿主（游戏侧同步大厅身份、必要时重连）

## 测试

```bash
npm test   # protocol → room-code → player-id → ws-client → lobby-store
```

ws-client 测试用内存 FakeWS，注意**共享实例数组会串测**，每段测试前 `FakeWS.instances = []` 重置。
