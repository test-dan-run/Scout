import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultSettings, emptyContextPack, seedCompanies } from '../shared/seed'
import type { ChatMessage, Kind, Settings } from '../shared/types'
import { markdownToDocx, markdownToPdf } from './exporters'
import { Gateway } from './gateway'
import { loadOrCreateKey } from './keychain'
import { Store, type StoredRecord } from './store'

const KINDS: Kind[] = [
  'companies',
  'engagements',
  'contextPack',
  'experts',
  'hypotheses',
  'questions',
  'briefs',
  'meetings',
  'writeups',
  'settings'
]

let store: Store
let keychain = false
let mainWindow: BrowserWindow | null = null

function checkKind(kind: unknown): Kind {
  if (typeof kind !== 'string' || !KINDS.includes(kind as Kind)) throw new Error(`Unknown record kind: ${String(kind)}`)
  return kind as Kind
}

function settings(): Settings {
  return store.get<Settings>('settings', 'main') ?? defaultSettings()
}

async function openStore(): Promise<void> {
  const dir = app.getPath('userData')
  const k = await loadOrCreateKey(join(dir, 'scout.key'))
  keychain = k.keychain
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
  store = await Store.open(join(dir, 'scout.db.enc'), k.key, wasmPath)
  if (!store.get('settings', 'main')) {
    store.put('settings', defaultSettings())
    store.put('contextPack', emptyContextPack())
    const seed = seedCompanies()
    store.putMany('companies', seed.companies)
    store.putMany('engagements', seed.engagements)
    store.flush()
  }
}

/** Blocks every network request from the interface except the local dev server. */
function lockDownNetwork(): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const u = details.url
    const allowed =
      u.startsWith('file:') ||
      u.startsWith('data:') ||
      u.startsWith('devtools:') ||
      u.startsWith('chrome-extension:') ||
      (!!devUrl && (u.startsWith(devUrl) || u.startsWith(devUrl.replace('http', 'ws'))))
    cb({ cancel: !allowed })
  })
}

function registerIpc(): void {
  ipcMain.handle('store:list', (_e, kind: unknown, engagementId?: string) => store.list(checkKind(kind), engagementId))
  ipcMain.handle('store:get', (_e, kind: unknown, id: string) => store.get(checkKind(kind), id))
  ipcMain.handle('store:put', (_e, kind: unknown, rec: StoredRecord) => store.put(checkKind(kind), rec))
  ipcMain.handle('store:putMany', (_e, kind: unknown, recs: StoredRecord[]) => store.putMany(checkKind(kind), recs))
  ipcMain.handle('store:remove', (_e, kind: unknown, id: string) => store.remove(checkKind(kind), id))
  ipcMain.handle('store:removeEngagement', (_e, id: string) => store.removeEngagement(id))

  const gateway = new Gateway(settings)
  ipcMain.handle('llm:status', () => gateway.status())
  ipcMain.handle('llm:chat', (_e, messages: ChatMessage[], opts?: { json?: boolean }) => gateway.chat(messages, opts))

  ipcMain.handle(
    'export:save',
    async (_e, args: { format: 'md' | 'docx' | 'pdf'; markdown: string; title: string; defaultName: string }) => {
      const ext = args.format
      const res = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: `${args.defaultName}.${ext}`,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
      })
      if (res.canceled || !res.filePath) return null
      const data =
        ext === 'md'
          ? Buffer.from(args.markdown, 'utf8')
          : ext === 'docx'
            ? await markdownToDocx(args.markdown)
            : await markdownToPdf(args.markdown, args.title)
      writeFileSync(res.filePath, data)
      return res.filePath
    }
  )

  ipcMain.handle('app:backup', async () => {
    const res = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `scout-backup-${new Date().toISOString().slice(0, 10)}.enc`
    })
    if (res.canceled || !res.filePath) return null
    store.backupTo(res.filePath)
    return res.filePath
  })

  ipcMain.handle('app:info', () => ({ dataPath: app.getPath('userData'), keychain, version: app.getVersion() }))

  ipcMain.handle('shell:openSource', (_e, url: string) => {
    if (typeof url === 'string' && /^https:\/\//.test(url)) return shell.openExternal(url)
    return undefined
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1000,
    minHeight: 640,
    title: 'Scout',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  // Links open in the system browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault())
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) void mainWindow.loadURL(devUrl)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  await openStore()
  lockDownNetwork()
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => store?.flush())
app.on('window-all-closed', () => {
  store?.flush()
  if (process.platform !== 'darwin') app.quit()
})
