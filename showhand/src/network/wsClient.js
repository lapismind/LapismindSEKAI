/**
 * network/wsClient.js —— 复用 @lapismind/lobby-kit 的 WSClient，
 * 注入本游戏的协议信封。
 */

import { createWSClient } from '@lapismind/lobby-kit'
import { makeMessage, isServerMessageValid } from '../core/protocol'

export const wsClient = createWSClient({ makeMessage, isServerMessageValid })
