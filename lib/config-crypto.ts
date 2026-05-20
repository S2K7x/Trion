import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALG = 'aes-256-gcm'
const IV_LEN = 12   // 96-bit IV (recommended for GCM)
const TAG_LEN = 16  // 128-bit auth tag

function getKey(): Buffer {
  const secret = process.env.MASTER_SECRET
  if (!secret) throw new Error('MASTER_SECRET env var is not set')
  const buf = Buffer.from(secret, 'hex')
  if (buf.length !== 32) {
    throw new Error('MASTER_SECRET must be 64 hex characters (32 bytes) — generate with: openssl rand -hex 32')
  }
  return buf
}

/** Returns base64-encoded [ iv(12) | authTag(16) | ciphertext ] */
export function encryptValue(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALG, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

/** Reverses encryptValue */
export function decryptValue(encoded: string): string {
  const key = getKey()
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, IV_LEN)
  const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
