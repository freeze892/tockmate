/**
 * 应用锁密码哈希（纯逻辑）：scrypt 加盐，恒时比较
 */
const crypto = require('crypto')

function hashPassword (password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return { salt, hash }
}

function verifyPassword (password, salt, expectedHash) {
  if (!salt || !expectedHash) return false
  const actual = crypto.scryptSync(String(password), salt, 64)
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

module.exports = { hashPassword, verifyPassword }
