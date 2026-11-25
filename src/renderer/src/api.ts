import type { ChatMessage, Company, Kind, RecordKinds } from '@shared/types'

export interface GatewayStatus {
  ok: boolean
  provider: string
  message: string
  models: string[]
}

interface ScoutBridge {
  list(kind: Kind, engagementId?: string): Promise<unknown[]>
  get(kind: Kind, id: string): Promise<unknown>
  put(kind: Kind, rec: unknown): Promise<unknown>
  putMany(kind: Kind, recs: unknown[]): Promise<void>
  remove(kind: Kind, id: string): Promise<void>
  removeEngagement(id: string): Promise<void>
  llmStatus(): Promise<GatewayStatus>
  llmChat(messages: ChatMessage[], opts?: { json?: boolean }): Promise<string>
  exportDoc(args: { format: 'md' | 'docx' | 'pdf'; markdown: string; title: string; defaultName: string }): Promise<string | null>
  backup(): Promise<string | null>
  info(): Promise<{ dataPath: string; keychain: boolean; version: string }>
  openSource(url: string): Promise<void>
  setApiKey(key: string): Promise<void>
  hasApiKey(): Promise<boolean>
  research(companyId: string): Promise<Company>
  cancelResearch(companyId: string): Promise<void>
  onResearchProgress(cb: (p: { companyId: string; message: string }) => void): () => void
}

declare global {
  interface Window {
    scout: ScoutBridge
  }
}

export const bridge = (): ScoutBridge => window.scout

export async function listAll<K extends Kind>(kind: K): Promise<RecordKinds[K][]> {
  return (await bridge().list(kind)) as RecordKinds[K][]
}

/** Runs a prompt through the local model and returns the reply text. */
export async function askLocalModel(system: string, user: string, json = true): Promise<string> {
  return bridge().llmChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    { json }
  )
}
