# Abracadawhat 部署说明 v2

## 唯一部署入口

在 `abracadawhat/` 目录运行：

```powershell
npm run deploy
```

不要直接运行：

```powershell
vite build
wrangler deploy
```

聊天表情源文件不在本项目的 `public/` 中，而在仓库共享包：

```text
packages/chat-kit/emojis/
```

Vite 不会自动处理这个目录。项目通过 `postbuild` 执行 `scripts/copy-emojis.mjs`，把启用的表情复制到：

```text
abracadawhat/dist/chat-kit/emojis/
```

`npm run deploy` 会调用 `npm run build`，因此会自动触发 `postbuild`。直接运行 `vite build` 会绕过 `postbuild`，生成的 `dist` 没有聊天表情。

## 部署前检查

运行完整测试和构建：

```powershell
npm test
npm run build
```

`npm test` 包含 `tests/emoji-assets.test.mjs`。它会按 `packages/chat-kit/src/emoji-manifest.json` 检查所有启用的表情是否进入 `dist`。

构建日志必须出现：

```text
> abracadawhat@0.1.0 postbuild
> node scripts/copy-emojis.mjs
...
Emoji copy complete
```

如果没有这段日志，停止部署。不要手工忽略表情目录缺失。

## 部署

```powershell
npm run deploy
```

部署命令会依次执行：

```text
npm run build
  -> vite build
  -> postbuild
  -> copy-emojis.mjs
wrangler deploy
```

Wrangler 的静态资源目录由 `wrangler.toml` 指定为 `./dist`。

## 生产验收

部署成功不等于表情资源可用。至少检查两张来自不同目录的图片：

```powershell
$urls = @(
  'https://abracadawhat.qmzhj.top/chat-kit/emojis/1/stamp0008.png',
  'https://abracadawhat.qmzhj.top/chat-kit/emojis/21/stamp0943.png'
)

foreach ($url in $urls) {
  $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 30
  "$($response.StatusCode) $($response.Headers['Content-Type']) $($response.RawContentLength) $url"
}
```

正确结果必须满足：

```text
HTTP 200
Content-Type: image/png
响应体长度大于 0
```

还要打开游戏聊天面板，确认表情选择器和已发送的表情都显示图片，而不是文件名或 `alt` 文本。

## 故障判断

### 表情只显示名称

浏览器实际是在显示 `<img>` 的 `alt` 文本。先检查图片 URL 的响应类型。

如果结果是：

```text
200 text/html
```

说明图片不存在，Cloudflare 的 SPA fallback 返回了 `index.html`。这不是图片格式问题，也不是聊天消息字段问题。

处理顺序：

1. 检查 `dist/chat-kit/emojis/` 是否存在。
2. 运行 `npm run build`，确认 `postbuild` 和复制日志出现。
3. 运行 `node --test tests/emoji-assets.test.mjs`。
4. 使用 `npm run deploy` 重新部署。
5. 再次检查生产图片 URL 必须返回 `image/png`。

### 构建测试提示 Missing built emoji

检查：

- 源图片是否存在于 `packages/chat-kit/emojis/<folder>/`。
- `emoji-manifest.json` 中的目录和文件名是否与源文件一致。
- `scripts/copy-emojis.mjs` 是否跳过了不该跳过的目录。

`cb` 目录当前按设计禁用，复制脚本和测试都会跳过它。

## 修改表情资源时

1. 在 `packages/chat-kit/emojis/` 增删图片。
2. 更新或重新生成 `packages/chat-kit/src/emoji-manifest.json`。
3. 运行 `npm run build`。
4. 运行 `npm test`。
5. 使用 `npm run deploy` 部署。
6. 验证生产图片 URL 和聊天面板。

不要把共享表情复制进源码目录形成第二份长期副本。`packages/chat-kit/emojis/` 是源文件，`abracadawhat/dist/chat-kit/emojis/` 是可删除、可重建的构建产物。
