import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const MAGIC = Buffer.from('SCT1')
const IV_LEN = 12
const TAG_LEN = 16

/** AES-256-GCM. File layout: "SCT1" | iv (12) | tag (16) | ciphertext. */
export function encrypt(plain: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error('Key must be 32 bytes')
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body])
}

export function decrypt(blob: Buffer, key: Buffer): Buffer {
  if (blob.length < MAGIC.length + IV_LEN + TAG_LEN || !blob.subarray(0, 4).equals(MAGIC)) {
    throw new Error('Not a Scout store file')
  }
  const iv = blob.subarray(4, 4 + IV_LEN)
  const tag = blob.subarray(4 + IV_LEN, 4 + IV_LEN + TAG_LEN)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(blob.subarray(4 + IV_LEN + TAG_LEN)), decipher.final()])
}

export function newKey(): Buffer {
  return randomBytes(32)
}
