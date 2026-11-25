import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { newKey } from './crypto'

/**
 * The store key is random and kept wrapped by Electron safeStorage, which on macOS
 * uses a key held in the login Keychain. Returns whether the OS keychain protects it.
 */
export function loadOrCreateKey(path: string): { key: Buffer; keychain: boolean } {
  const keychain = safeStorage.isEncryptionAvailable()
  if (existsSync(path)) {
    const raw = readFileSync(path)
    if (raw.subarray(0, 6).toString() === 'PLAIN:') {
      return { key: Buffer.from(raw.subarray(6).toString(), 'base64'), keychain: false }
    }
    return { key: Buffer.from(safeStorage.decryptString(raw), 'base64'), keychain: true }
  }
  const key = newKey()
  if (keychain) {
    writeFileSync(path, safeStorage.encryptString(key.toString('base64')), { mode: 0o600 })
  } else {
    // Only on systems with no keychain (some Linux setups). macOS always has one.
    writeFileSync(path, `PLAIN:${key.toString('base64')}`, { mode: 0o600 })
  }
  return { key, keychain }
}
