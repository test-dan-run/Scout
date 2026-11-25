import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { newKey } from './crypto'

/**
 * The store key is random and kept wrapped by Electron safeStorage, which on macOS
 * uses a key held in the login Keychain. Returns whether the OS keychain protects it.
 * Must be called after the app is ready.
 */
export async function loadOrCreateKey(path: string): Promise<{ key: Buffer; keychain: boolean }> {
  const keychain = await safeStorage.isAsyncEncryptionAvailable()
  if (existsSync(path)) {
    const raw = readFileSync(path)
    if (raw.subarray(0, 6).toString() === 'PLAIN:') {
      return { key: Buffer.from(raw.subarray(6).toString(), 'base64'), keychain: false }
    }
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(raw)
    // The OS rotated its key: re-wrap ours so the next launch uses the new one.
    if (shouldReEncrypt) writeFileSync(path, await safeStorage.encryptStringAsync(result), { mode: 0o600 })
    return { key: Buffer.from(result, 'base64'), keychain: true }
  }
  const key = newKey()
  if (keychain) {
    writeFileSync(path, await safeStorage.encryptStringAsync(key.toString('base64')), { mode: 0o600 })
  } else {
    // Only on systems with no keychain (some Linux setups). macOS always has one.
    writeFileSync(path, `PLAIN:${key.toString('base64')}`, { mode: 0o600 })
  }
  return { key, keychain }
}
