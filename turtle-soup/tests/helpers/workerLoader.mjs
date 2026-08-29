/**
 * tests/helpers/workerLoader.mjs —— 以源码加载 src/worker/*.js。
 *
 * worker 源码使用无扩展名相对导入（如 ../ai/aiHost），Node ESM 默认不支持，
 * 用 registerHooks 拦截解析并补 .js 后缀，使集成测试可以直接 import 真实源码。
 */
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (err) {
      if (
        specifier.startsWith('.') &&
        !specifier.endsWith('.js') &&
        !specifier.endsWith('.mjs')
      ) {
        return nextResolve(specifier + '.js', context)
      }
      throw err
    }
  },
})
