import { contextBridge, ipcRenderer } from 'electron'

const api = {
  list: (kind: string, engagementId?: string) => ipcRenderer.invoke('store:list', kind, engagementId),
  get: (kind: string, id: string) => ipcRenderer.invoke('store:get', kind, id),
  put: (kind: string, rec: unknown) => ipcRenderer.invoke('store:put', kind, rec),
  putMany: (kind: string, recs: unknown[]) => ipcRenderer.invoke('store:putMany', kind, recs),
  remove: (kind: string, id: string) => ipcRenderer.invoke('store:remove', kind, id),
  removeEngagement: (id: string) => ipcRenderer.invoke('store:removeEngagement', id),
  llmStatus: () => ipcRenderer.invoke('llm:status'),
  llmChat: (messages: unknown[], opts?: { json?: boolean }) => ipcRenderer.invoke('llm:chat', messages, opts),
  exportDoc: (args: { format: 'md' | 'docx' | 'pdf'; markdown: string; title: string; defaultName: string }) =>
    ipcRenderer.invoke('export:save', args),
  backup: () => ipcRenderer.invoke('app:backup'),
  info: () => ipcRenderer.invoke('app:info'),
  openSource: (url: string) => ipcRenderer.invoke('shell:openSource', url),
  setApiKey: (key: string) => ipcRenderer.invoke('secrets:setApiKey', key),
  hasApiKey: () => ipcRenderer.invoke('secrets:hasApiKey'),
  research: (companyId: string) => ipcRenderer.invoke('research:run', companyId),
  cancelResearch: (companyId: string) => ipcRenderer.invoke('research:cancel', companyId),
  onResearchProgress: (cb: (p: { companyId: string; message: string }) => void) => {
    const handler = (_e: unknown, p: { companyId: string; message: string }) => cb(p)
    ipcRenderer.on('research:progress', handler)
    return () => ipcRenderer.removeListener('research:progress', handler)
  }
}

contextBridge.exposeInMainWorld('scout', api)
