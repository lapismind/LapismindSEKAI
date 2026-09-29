import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { writeFileSync } from 'node:fs'

const LAYOUT_FILE = fileURLToPath(new URL('./src/game/maps/twin-cross-68.layout.json', import.meta.url))

/**
 * 地图编辑器的落盘接口（只在 dev server 存在，build 产物里没有）
 *   POST /__niigo/layout  body: { types: string[68] }  → 写回 src/game/maps/twin-cross-68.layout.json
 * 只写这一个固定文件；保存前用与游戏相同的 validateLayout 校验，有 error 拒绝写入。
 */
function layoutSavePlugin() {
  return {
    name: 'niigo-layout-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__niigo/layout', (req, res) => {
        const reply = (code, obj) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(obj))
        }
        // dev server 开了 host:true（局域网可访问），写文件接口只接受本机请求
        const ip = req.socket.remoteAddress ?? ''
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return reply(403, { error: 'localhost only' })
        if (req.method !== 'POST') return reply(405, { error: 'POST only' })
        let body = ''
        req.on('data', (c) => {
          body += c
          if (body.length > 64 * 1024) req.destroy()
        })
        req.on('end', async () => {
          try {
            const { types } = JSON.parse(body)
            // 走 vite 的模块图加载，拿到与前端同一份拓扑与校验逻辑
            const { validateLayout } = await server.ssrLoadModule('/src/game/layout.js')
            const B = await server.ssrLoadModule('/src/game/board.js')
            const r = validateLayout(types, B)
            if (r.errors.length) return reply(422, { errors: r.errors })
            const text = JSON.stringify({ id: 'twin-cross-68', types }, null, 0)
              .replace('"types":[', '"types":[\n  ')
              .replace(/\]\}$/, '\n]}') + '\n'
            writeFileSync(LAYOUT_FILE, text, 'utf8')
            reply(200, { ok: true, warnings: r.warnings })
          } catch (e) {
            reply(400, { error: String(e?.message ?? e) })
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), layoutSavePlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
})
