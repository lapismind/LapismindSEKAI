import { createWSClient } from '@lapismind/lobby-kit'
import { makeMessage, isServerMessageValid } from '../core/protocol'

export const wsClient = createWSClient({ makeMessage, isServerMessageValid })
