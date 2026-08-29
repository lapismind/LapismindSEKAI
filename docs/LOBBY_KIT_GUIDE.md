# Lobby-Kit 使用指南 —— 联机游戏大厅通用件

> 面向读者：在 cloudflareGame 工作区里**新开一个联机游戏**的开发者（未来的你）。
> 目标：照着这篇文档，30 分钟内把大厅（昵称 / 头像 / 房间码 / WebSocket 连接 / 邀请链接）跑通，只写游戏特有的部分。

## 一、lobby-kit 是什么、不是什么

`@lapismind/lobby-kit`（源码在 `packages/lobby-kit`）是所有联机游戏共用的"大厅层"，把每个联机游戏都要写一遍的东西沉淀成了一个包：

- **WebSocket 客户端**：连接、断线自动重连（指数退避）、消息分发、非法消息过滤
- **房间码**：6 位大写字母数字（排除易混淆的 0/O/1/I），生成 + 校验
- **玩家身份**：playerId 生成、HMAC 签名 token（服务端验证用）
- **大厅状态工厂**：昵称 / 头像 / playerId / 当前房间码的纯逻辑 state
- **邀请链接工具**：构建分享链接、读 URL 里的房间码、复制到剪贴板
- **个人资料组件**（Vue）：昵称输入 + 26 张头像九宫格，一个组件搞定玩家资料编辑
- **头像资源**：26 张 png + 清单，各游戏直接用同一套头像

**它不包含**（这些由各游戏自己定义）：

- 具体的游戏消息类型和规则（协议信封格式统一是 `{ type, data }`，但 type 由游戏定）
- 游戏房间的 UI 布局、牌桌 / 棋盘 / 聊天区等
- 服务端 Durable Object 的业务逻辑

设计原则：**包保持薄而稳**——只放"每个联机游戏都一模一样"的东西。UI 组件只放"样式完全通用"的（目前只有 ProfileEditor），游戏特色 UI 不要往包里塞。

## 二、快速接入（四步）

### 第 1 步：安装依赖

在你的游戏目录下：

```bash
npm install @lapismind/lobby-kit@file:../packages/lobby-kit
```

这是本地路径引用，改包源码后无需重新 install，游戏侧构建直接生效。

### 第 2 步：定义你的游戏协议

包不管具体消息，你自己建 `src/core/protocol.js`：

```js
export const Msg = {
  SEND_JOIN: 'join',
  RCV_ROOM_STATE: 'room_state',
  // 本游戏的消息类型...
}
```

信封格式必须遵守 `{ type, data }`（ws-client 会用它过滤非法消息）。

### 第 3 步：薄包装 Pinia store

```js
// src/stores/lobbyStore.js
import { defineStore } from 'pinia'
import { reactive, toRefs } from 'vue'
import { createLobbyStore } from '@lapismind/lobby-kit'

export const useLobbyStore = defineStore('lobby', () => {
  const kit = createLobbyStore()
  const state = reactive(kit.state)
  return {
    ...toRefs(state),
    setNickname: kit.setNickname,
    setAvatar: kit.setAvatar,
    joinByCode: kit.joinByCode,
  }
})
```

⚠️ 注意两个坑：

1. `kit.setNickname()` 直接改原始对象不触发 Vue 响应，必须先 `reactive(kit.state)` 再包装 setter 操作响应式对象。
2. 展开 reactive 对象要用 `toRefs(state)`，直接 `...state` 是值快照不响应。

参考实现：showhand 和 turtle-soup 的 `src/stores/lobbyStore.js`。

### 第 4 步：连接 WebSocket

```js
import { createWSClient } from '@lapismind/lobby-kit'

const wsClient = createWSClient({
  makeMessage,            // 你的 protocol.js 导出
  isServerMessageValid,   // 同上
})

wsClient.connect({
  roomId: 'ABC234',
  nickname: lobby.myNickname,
  playerId: lobby.myPlayerId,
  avatarId: lobby.myAvatarId,
  // url 缺省时自动拼同源 /ws?roomId=..&nickname=..&playerId=..&avatarId=..
})
```

API 一览：

```js
wsClient.send(type, data)     // 封包发送，未连接丢弃
wsClient.on(type, handler)    // 订阅，返回取消函数
wsClient.disconnect()         // 断开且不再重连
wsClient.connected            // boolean getter
```

断线重连是自动的（指数退避最多 5 次），重连后自动恢复会话参数。

## 三、邀请链接与房间加入流程

这是每个联机游戏都会遇到的"创建房间 → 分享链接 → 好友点开加入"闭环，kit 提供了三个工具函数：

```js
import {
  buildInviteUrl,        // 构建邀请链接
  copyToClipboard,       // 复制文本到剪贴板
  readRoomCodeFromUrl,   // 从当前 URL 读房间码
} from '@lapismind/lobby-kit'
```

### 房主：生成并复制邀请链接

```js
// RoomView 里（房间页）
const url = buildInviteUrl(window.location.origin, roomCode)
try {
  await copyToClipboard(url)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
} catch {
  alert('复制链接：' + url)   // 剪贴板不可用的兜底
}
```

`buildInviteUrl(origin, roomId)` 返回 `https://你的域名/?room=房间码`，房间码自动大写化。

### 受邀方：从链接进入大厅并自动填入房间码

```js
// LobbyView 里（大厅页）
const invited = readRoomCodeFromUrl()   // 没有则返回 null
if (invited) {
  roomCode.value = invited              // 自动填入输入框
  // 可以顺便显示"你被邀请进入房间 XXX"提示条
}
```

完整参考：showhand 的 `LobbyView.vue`（vue-router 版）和 turtle-soup 的 `LobbyView.vue`（无路由 replaceState 版）。两者路由方式不同但都用这套函数，说明它对路由方案没有假设。

## 四、个人资料编辑（共享 Vue 组件）

如果游戏前端是 Vue 3，直接复用现成组件，不用再手写昵称框和头像九宫格：

```vue
<script setup>
import { ref } from 'vue'
import { ProfileEditor } from '@lapismind/lobby-kit/vue'
import { avatarChoices } from '../game/avatars'  // 见下方"头像资源"
</script>

<template>
  <ProfileEditor v-model="profileDraft" :avatar-choices="avatarChoices" />
</template>
```

`profileDraft` 是 `ref({ nickname, avatarId })`，打开弹层前从 lobby store 初始化，保存时写回 store 并触发重连即可。

这个组件在 showhand 的两处（大厅 + 房间内资料弹层）和 turtle-soup 的大厅都在用，Tailwind v4 会自动扫描依赖包里的类名，无需额外配置。

## 五、头像资源

26 张头像（1.png ~ 26.png）在包内，通过 Vite 资源导入使用：

```js
// src/game/avatars.js
import { AVATAR_FILES, AVATAR_COUNT } from '@lapismind/lobby-kit/avatars/list'

const AVATAR_URLS = AVATAR_FILES.map((f) =>
  new URL(`../../node_modules/@lapismind/lobby-kit/avatars/${f}`, import.meta.url).href
)

export function avatarUrl(avatarId) {
  const n = Number(avatarId)
  if (!Number.isInteger(n) || n < 1 || n > AVATAR_COUNT) return null
  return AVATAR_URLS[n - 1]
}

export const avatarChoices = AVATAR_URLS.map((url, i) => ({ id: String(i + 1), url }))
```

avatarId 约定为字符串 `'1'`~`'26'`，`'0'` 或缺省表示未选择（前端可用首字占位）。

## 六、playerId 与身份 token（安全）

明文 playerId 可被伪造（别人猜到你 id 就能冒充），所以 kit 提供 HMAC 签名机制：

```js
import { createIdentityToken, verifyIdentityToken } from '@lapismind/lobby-kit'

// 服务端签发（Worker 里，IDENTITY_SECRET 用 wrangler secret 配置）
const token = await createIdentityToken(playerId, secret)
// 客户端连接时带上，服务端 DO 收到后验签
const ok = await verifyIdentityToken(token, playerId, secret)
```

- token 有效期 24 小时，过期需重新获取（调 `/api/identity` 端点）
- 双层校验：Worker 入口拦一次，DO 层再验一次，缺一不可
- 已在 showhand 上线验证，新游戏照搬即可

## 七、测试与维护约定

```bash
cd packages/lobby-kit
npm test        # 目前 6 个测试文件，全部纯 node 无浏览器依赖
```

- 包改动遵循 TDD：先在 `tests/` 写失败测试再实现，全绿后提交
- 新增模块记得同步更新 `packages/README.md` 的模块表和本文档
- 改了包代码后，游戏侧无需 reinstall，直接重新 build 即可生效

## 八、"新开联机游戏"检查清单

- [ ] `npm install @lapismind/lobby-kit@file:../packages/lobby-kit`
- [ ] 写 `src/core/protocol.js`（本游戏消息类型，遵守 `{ type, data }` 信封）
- [ ] 写 `src/stores/lobbyStore.js`（薄包装，注意 toRefs 坑）
- [ ] 大厅页接 `readRoomCodeFromUrl()` + `ProfileEditor`
- [ ] 房间页接 `buildInviteUrl()` + `copyToClipboard()`
- [ ] WebSocket 用 `createWSClient()`，别自己裸写 new WebSocket
- [ ] 服务端 DO 接 identity token 校验（参考 showhand worker）
- [ ] 大厅与房间各放一个 AuthBadge「统一登录」组件（游客登录 / GitHub / 账号注册登录，见「九」）
- [ ] Worker 配置 SESSION_SECRET（与 sekai-auth 相同），/ws 会话覆盖 playerId（参考三个游戏 worker）
- [ ] 游戏特有逻辑放游戏侧 store / core，不要往包里加

---

*最后更新：2026-08-22 · 基于 lobby-kit 0.1.0*
### 九、统一登录（跨游戏共享）

所有联机游戏共用同一个认证体系（sekai-auth）：登录后种下的 HttpOnly 会话 cookie
（domain=.qmzhj.top）跨子域携带，所以**博客登录的用户点进游戏大厅会自动带账号**；
游客进任意游戏也会自动登录（拿到服务端 playerId）。

### 9.1 客户端：main.js 预加载

```js
// main.js
import { getSharedAuth } from '@lapismind/lobby-kit'
import { useLobbyStore } from './stores/lobbyStore'

const pinia = createPinia()
async function bootstrap() {
  // 2 秒超时兜底：认证服务慢/不可达不阻塞进游戏，身份稍后由 AuthBadge 补齐
  const auth = getSharedAuth()
  const user = await Promise.race([
    auth.init().catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
  ])
  useLobbyStore(pinia).syncIdentity(user)
  createApp(App).use(pinia).mount('#app')
}
bootstrap()
```

### 9.2 大厅身份徽章

```vue
<!-- LobbyView.vue -->
<AuthBadge @identity-change="onIdentityChange" />

<script setup>
function onIdentityChange(user) {
  lobby.syncIdentity(user) // 同步后 myPlayerId 就是会话 playerId，入房自动带上
}
</script>
```

深色主题（如海龟汤）传 dark，房间内传 compact。游客在徽章里可一键
GitHub 登录，或用用户名密码注册（注册 = 游客升级，战绩成就保留）/ 登录。

### 9.3 房间内换身份重连

游客在房间里登录/注册升级后 playerId 会变：AuthBadge 通过 identity-change 通知，
游戏侧同步大厅身份并用新 playerId 重连（参考 showhand RoomView 的 onIdentityChange）。

### 9.4 Worker：会话优先

各游戏 Worker 配置 SESSION_SECRET（与 sekai-auth 相同）后：

- /api/identity：存在有效会话时只给会话 playerId 签发 token（杜绝任意 ID 冒充）

游戏分两种接入形态：

1. **token 架构（showhand / abracadawhat）**：/ws 只做 token 校验后原样转发；
   DO 以**验签后的 token 身份**为准（忽略 URL 自报 playerId）。因为 /api/identity
   会话优先签发，token 只可能是会话 playerId，URL 冒充就此失效。
2. **无 token 架构（turtle-soup）**：/ws 验证会话后把身份写入请求头
   x-sekai-session-player-id 再转发，soupRoom 优先读该头、回退 URL 参数。
   注意不要用 new Request(request, { url }) 改写 URL——该写法在部分运行时不可靠。

未配置 SESSION_SECRET 时：登录功能与博客账号携带照常（前端经 auth /api/me 读会话即带上账号），
只是 Worker 侧无法对会话 cookie 验签——防冒充绑定与 /ws 会话身份优先不启用。
部署密钥流程见 GAME-DEPLOY.md「密钥与环境变量」。
