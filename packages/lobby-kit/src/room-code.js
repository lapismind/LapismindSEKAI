/**
 * 房间码生成 —— 6 位大写字母+数字，排除易混淆字符（0/O/1/I）。
 */

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(length = 6) {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}

export function isValidRoomCode(code) {
  if (typeof code !== 'string') return false
  const normalized = code.trim().toUpperCase()
  if (normalized.length !== 6) return false
  return /^[A-Z2-9]{6}$/.test(normalized)
}
