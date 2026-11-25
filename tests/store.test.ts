import { mkdtempSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decrypt, encrypt, newKey } from '../src/main/crypto'
import { Store } from '../src/main/store'

const wasm = createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm')

describe('crypto', () => {
  it('round-trips and rejects the wrong key', () => {
    const key = newKey()
    const blob = encrypt(Buffer.from('hello'), key)
    expect(decrypt(blob, key).toString()).toBe('hello')
    expect(() => decrypt(blob, newKey())).toThrow()
  })
})

describe('Store', () => {
  it('persists records to an encrypted file and reads them back', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scout-'))
    const file = join(dir, 'scout.db.enc')
    const key = newKey()
    const s = await Store.open(file, key, wasm)
    s.put('companies', { id: 'co1', name: 'Secret Co' })
    s.putMany('questions', [
      { id: 'q1', engagementId: 'e1', text: 'a' },
      { id: 'q2', engagementId: 'e2', text: 'b' }
    ])
    s.flush()
    expect(readFileSync(file).includes(Buffer.from('Secret Co'))).toBe(false)

    const again = await Store.open(file, key, wasm)
    expect(again.get('companies', 'co1')).toEqual({ id: 'co1', name: 'Secret Co' })
    expect(again.list('questions', 'e1')).toEqual([{ id: 'q1', engagementId: 'e1', text: 'a' }])
    again.removeEngagement('e1')
    expect(again.list('questions')).toHaveLength(1)
    await expect(Store.open(file, newKey(), wasm)).rejects.toThrow()
  })
})
