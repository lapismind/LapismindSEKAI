# 头像切换 404 修复 & lobby-kit 单独包坑

## 现象
- 个人资料页点头像切换，前端报「切换头像失败」，浏览器控制台出现 404。
- 该 404 来自 `POST /api/me/avatar`，错误体为 `{"error":"user not found"}`，**仅账号（用户名密码）路径**出现。
- GitHub 用户路径用 `parseUserIdFromPlayerId` 反解 id，原本就返回 200，不受影响。

## 根因
- `handleSetAvatar` 的账号分支原本用 `UPDATE users SET avatar_id = ? WHERE provider = 'account' AND player_id = ?` 定位用户行。
- 老账号（`users.player_id` 为 `NULL` 或与当前会话 token 的 playerId 不一致）会导致 `UPDATE` 命中 0 行 → 返回 404。
- 同样，`loadCurrentUser` 的账号分支按 `player_id` 查，`NULL` 时会回退到「账号用户」占位昵称，昵称也错。
- 头像图片 URL 实测返回 200，确认 404 是接口而非图片资源。

## 修复
- 新增 `resolveAccountId(session, env)`，共四级兜底，确保任何已登录账号都能定位到行：
  1. 优先用 token 内 `userId`；
  2. 否则按 `player_id` 定位（若为 `NULL` 则就地 `UPDATE` 补齐，自愈老数据）；
  3. 再否则从 token 内 `pu<id36>-<8>` 反解用户行 id（注册无游客会话时 playerId 编码了 id）；
  4. 最后按 `nickname` 定位（账号 token 现携带 `nickname`，覆盖极老会话且 player_id 完全缺失的边界情况）。
- `handleSetAvatar`、`loadCurrentUser` 的账号分支改用上述解析；GitHub 分支用 `session.userId || parseUserIdFromPlayerId(playerId)`（GitHub 用户 `playerId` 形如 `pu<id>-xxxx`，必能反解出 id，不会 404）。
- lobby-kit 的 `createSessionToken` / `verifyIdentityToken` 现转发 `userId` 与 `nickname`（向后兼容：旧 token 不含这些字段时走兜底逻辑）。

## lobby-kit 是独立 gitignore 包（重要坑）
- `packages/lobby-kit` 被 monorepo 根 `.gitignore` 排除，是**独立发布的 npm 包**。
- 因此 `packages/lobby-kit/src/player-id.js` 的改动**不会进入 monorepo 的 git**。
- 本地 `wrangler deploy` 时，auth 通过 `node_modules/@lapismind/lobby-kit` 的 workspace 软链读取本地源码，所以当前线上打包已含 `userId` 转发改动，功能正确。
- 但若从干净克隆重新 `npm install` 再部署，会拉到**已发布的 npm 版** lobby-kit（不含 `userId` 转发），此时走 auth 的兜底路径（功能依旧正常，仅少了 `userId` 直查优化）。
- 结论：**任何对 lobby-kit 的改动若要长期生效，必须在该包内发版（`npm publish`）并升级依赖**，不能只依赖 monorepo 软链。

## 验证
- 注册账号 → `POST /api/me/avatar {"avatarId":"5"}` 返回 `ok:true`，`/api/me` 回显 `avatarId:"5"` 与真实昵称（不再显示「账号用户」）。
- `/api/achievements` 已返回重写为明确触发条件的 30 条成就描述。
- 头像图片 URL 实测 200。

## 相关文件
- `auth/src/index.js`：`resolveAccountId` / `parseUserIdFromPlayerId` / `handleSetAvatar` / `loadCurrentUser`
- `auth/src/achievements.js`：30 条成就描述改为明确触发条件（与判定逻辑一致）
- `blog/src/pages/profile.astro`：头像改为点击头像弹出 modal 选择，选中即生效；移除头像右下角「换头像」角标与浮窗内的文字说明（点击头像即可，不暗示用户）
- `blog/src/components/UserAvatar.vue`：Header 头像优先显示自选本地头像
- `packages/lobby-kit/src/player-id.js`：`userId` 转发（被 gitignore，需发版才入版本库）
- `auth/migrations/002_avatar_id.sql` + `auth/schema.sql`：`users` 表新增 `avatar_id` 列
