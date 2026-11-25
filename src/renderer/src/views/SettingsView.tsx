import { useEffect, useState } from 'react'
import { DEFAULT_BASE_URL, assertLocalEndpoint } from '@shared/llm'
import type { LlmProvider, Settings } from '@shared/types'
import { bridge, type GatewayStatus } from '../api'
import { AsyncButton, Badge, Section, Select, TextField } from '../components/ui'
import { useData } from '../data'

export function SettingsView() {
  const { settings, put } = useData()
  const [status, setStatus] = useState<GatewayStatus | null>(null)
  const [info, setInfo] = useState<{ dataPath: string; keychain: boolean; version: string } | null>(null)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const set = (patch: Partial<Settings>) => put('settings', { ...settings, ...patch })

  useEffect(() => {
    void bridge().info().then(setInfo)
  }, [])

  let urlError: string | null = null
  if (settings.llmProvider !== 'none') {
    try {
      assertLocalEndpoint(settings.llmBaseUrl)
    } catch (e) {
      urlError = (e as Error).message
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <Section title="You">
        <TextField label="Your name" value={settings.userName} onChange={(v) => set({ userName: v })} hint="Used when you sign off a write-up." />
      </Section>

      <Section title="Local model">
        <p className="muted small">
          Phase 1 works without a model, using built-in templates. A local model served by Ollama or LM Studio adds drafting help for
          expert inputs, hypotheses and the brief. Scout refuses any model address that is not on this Mac.
        </p>
        <div className="grid3">
          <Select<LlmProvider>
            label="Provider"
            value={settings.llmProvider}
            options={[
              { value: 'none', label: 'None (templates only)' },
              { value: 'ollama', label: 'Ollama' },
              { value: 'lmstudio', label: 'LM Studio' }
            ]}
            onChange={(v) => {
              set({ llmProvider: v, llmBaseUrl: v === 'none' ? settings.llmBaseUrl : DEFAULT_BASE_URL[v], llmModel: '' })
              setStatus(null)
            }}
          />
          <TextField label="Address" value={settings.llmBaseUrl} onChange={(v) => set({ llmBaseUrl: v })} hint={urlError ?? undefined} />
          {status?.models.length ? (
            <Select label="Model" value={settings.llmModel} options={[{ value: '', label: 'Pick a model' }, ...status.models.map((m) => ({ value: m, label: m }))]} onChange={(v) => set({ llmModel: v })} />
          ) : (
            <TextField label="Model" value={settings.llmModel} onChange={(v) => set({ llmModel: v })} placeholder="e.g. qwen3:14b" />
          )}
        </div>
        <div className="row">
          <AsyncButton disabled={settings.llmProvider === 'none' || !!urlError} onClick={async () => setStatus(await bridge().llmStatus())}>
            Test connection
          </AsyncButton>
          {status && <Badge tone={status.ok ? 'good' : 'warn'}>{status.message}</Badge>}
        </div>
      </Section>

      <Section title="Data">
        {info && (
          <>
            <p>
              Data folder: <code>{info.dataPath}</code>
            </p>
            <p>
              {info.keychain ? (
                <Badge tone="good">Encrypted, key held in the macOS Keychain</Badge>
              ) : (
                <Badge tone="warn">Encrypted, but no OS keychain was available, so the key is stored next to the data</Badge>
              )}
            </p>
            <p className="muted small">Nothing leaves this Mac. Scout sends no telemetry, and the interface cannot make network requests.</p>
          </>
        )}
        <div className="row">
          <AsyncButton
            onClick={async () => {
              const p = await bridge().backup()
              setBackupMsg(p ? `Backup saved to ${p}. It is encrypted with this Mac's key.` : null)
            }}
          >
            Back up data
          </AsyncButton>
          {backupMsg && <span className="muted small">{backupMsg}</span>}
        </div>
        {info && <p className="muted small">Scout {info.version}</p>}
      </Section>
    </div>
  )
}
