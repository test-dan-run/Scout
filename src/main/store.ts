import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import initSqlJs, { type Database } from 'sql.js'
import { decrypt, encrypt } from './crypto'

export interface StoredRecord {
  id: string
  engagementId?: string
  companyId?: string
}

/**
 * Local store: SQLite (sql.js, compiled to WebAssembly so there is no native module to
 * rebuild) held in memory and written to disk as one AES-256-GCM encrypted file.
 */
export class Store {
  private db!: Database
  private saveTimer: NodeJS.Timeout | null = null

  private constructor(
    /** null keeps the database in memory only (used by tests). */
    private readonly file: string | null,
    private readonly key: Buffer
  ) {}

  /** wasmPath: path to sql.js's sql-wasm.wasm. */
  static async open(file: string | null, key: Buffer, wasmPath: string): Promise<Store> {
    const store = new Store(file, key)
    const wasm = readFileSync(wasmPath)
    const SQL = await initSqlJs({ wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer })
    if (file && existsSync(file)) {
      store.db = new SQL.Database(decrypt(readFileSync(file), key))
    } else {
      store.db = new SQL.Database()
    }
    store.migrate()
    return store
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS records (
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        engagement_id TEXT,
        company_id TEXT,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (kind, id)
      );
      CREATE INDEX IF NOT EXISTS idx_records_engagement ON records(kind, engagement_id);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    `)
    this.db.run(`INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1')`)
  }

  list<T>(kind: string, engagementId?: string): T[] {
    const stmt = engagementId
      ? this.db.prepare('SELECT data FROM records WHERE kind = ? AND engagement_id = ? ORDER BY updated_at')
      : this.db.prepare('SELECT data FROM records WHERE kind = ? ORDER BY updated_at')
    stmt.bind(engagementId ? [kind, engagementId] : [kind])
    const out: T[] = []
    while (stmt.step()) out.push(JSON.parse(stmt.get()[0] as string) as T)
    stmt.free()
    return out
  }

  get<T>(kind: string, id: string): T | null {
    const stmt = this.db.prepare('SELECT data FROM records WHERE kind = ? AND id = ?')
    stmt.bind([kind, id])
    const row = stmt.step() ? (JSON.parse(stmt.get()[0] as string) as T) : null
    stmt.free()
    return row
  }

  put<T extends StoredRecord>(kind: string, record: T): T {
    this.db.run(
      `INSERT INTO records (kind, id, engagement_id, company_id, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(kind, id) DO UPDATE SET engagement_id = excluded.engagement_id,
         company_id = excluded.company_id, data = excluded.data, updated_at = excluded.updated_at`,
      [kind, record.id, record.engagementId ?? null, record.companyId ?? null, JSON.stringify(record), new Date().toISOString()]
    )
    this.scheduleSave()
    return record
  }

  putMany<T extends StoredRecord>(kind: string, records: T[]): void {
    this.db.run('BEGIN')
    try {
      for (const r of records) this.put(kind, r)
      this.db.run('COMMIT')
    } catch (e) {
      this.db.run('ROLLBACK')
      throw e
    }
  }

  remove(kind: string, id: string): void {
    this.db.run('DELETE FROM records WHERE kind = ? AND id = ?', [kind, id])
    this.scheduleSave()
  }

  /** Deletes an engagement and everything that hangs off it. */
  removeEngagement(engagementId: string): void {
    this.db.run('DELETE FROM records WHERE engagement_id = ?', [engagementId])
    this.db.run(`DELETE FROM records WHERE kind = 'engagements' AND id = ?`, [engagementId])
    this.scheduleSave()
  }

  private scheduleSave(): void {
    if (!this.file) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.flush(), 400)
  }

  /** Writes the encrypted database atomically (temp file, then rename). */
  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, encrypt(Buffer.from(this.db.export()), this.key), { mode: 0o600 })
    renameSync(tmp, this.file)
  }

  /** An encrypted copy for backup, readable with the same key. */
  backupTo(path: string): void {
    writeFileSync(path, encrypt(Buffer.from(this.db.export()), this.key), { mode: 0o600 })
  }
}
