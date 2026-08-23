/**
 * network/wsClient.js
 * WebSocket 客户端 —— 复用 @lapismind/lobby-kit，注入本游戏协议信封。
 * 断线自动重连，重连后恢复房间会话。
 */

import { createWSClient } from '@lapismind/lobby-kit'
import { makeMessage, isServerMessageValid } from '../core/protocol'

export const wsClient = createWSClient({ makeMessage, isServerMessageValid })
