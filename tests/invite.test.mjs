import assert from 'node:assert/strict'
import { buildInviteUrl } from '../src/invite.js'

// buildInviteUrl
const u1 = buildInviteUrl('https://example.com', 'ABC234')
assert.equal(u1, 'https://example.com/?room=ABC234')

const u2 = buildInviteUrl('https://example.com', 'abc234')
assert.equal(u2, 'https://example.com/?room=ABC234', '房间码大写化')

const u3 = buildInviteUrl('https://example.com', 'XYZ789', { paramName: 'join' })
assert.equal(u3, 'https://example.com/?join=XYZ789', '自定义参数名')

console.log('invite tests passed')
