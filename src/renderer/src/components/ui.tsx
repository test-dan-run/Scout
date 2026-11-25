import { useEffect, useRef, useState, type ReactNode } from 'react'
import { markdownToHtml } from '@shared/markdown'
import { bridge } from '../api'

export function TextField(props: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  hint?: string
}) {
  return (
    <label className="field">
      {props.label && <span className="field-label">{props.label}</span>}
      <input
        type={props.type ?? 'text'}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && <span className="field-hint">{props.hint}</span>}
    </label>
  )
}

export function TextArea(props: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  hint?: string
}) {
  return (
    <label className="field">
      {props.label && <span className="field-label">{props.label}</span>}
      <textarea
        value={props.value}
        rows={props.rows ?? 3}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && <span className="field-hint">{props.hint}</span>}
    </label>
  )
}

export function Select<T extends string>(props: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <label className="field">
      {props.label && <span className="field-label">{props.label}</span>}
      <select value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <h2>{title}</h2>
        {actions && <div className="actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="progress" title={`${done} of ${total}`}>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span>
        {label}: {done} / {total}
      </span>
    </div>
  )
}

export function Markdown({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (a) {
        e.preventDefault()
        void bridge().openSource(a.href)
      }
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [])
  // markdownToHtml escapes all text, so this only renders our own tags.
  return <div ref={ref} className="markdown" dangerouslySetInnerHTML={{ __html: markdownToHtml(source) }} />
}

/** Button that runs an async action and shows progress and errors. */
export function AsyncButton(props: { onClick: () => Promise<void>; children: ReactNode; className?: string; disabled?: boolean; title?: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <span className="async-btn">
      <button
        className={props.className}
        disabled={busy || props.disabled}
        title={props.title}
        onClick={async () => {
          setBusy(true)
          setErr(null)
          try {
            await props.onClick()
          } catch (e) {
            setErr((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Working…' : props.children}
      </button>
      {err && <span className="error">{err}</span>}
    </span>
  )
}

export function ExportButtons({ markdown, title, name }: { markdown: string; title: string; name: string }) {
  const [msg, setMsg] = useState<string | null>(null)
  const run = (format: 'md' | 'docx' | 'pdf') => async () => {
    const path = await bridge().exportDoc({ format, markdown, title, defaultName: name })
    setMsg(path ? `Saved ${path}` : null)
  }
  return (
    <span className="export">
      <AsyncButton onClick={run('md')}>Markdown</AsyncButton>
      <AsyncButton onClick={run('docx')}>Word</AsyncButton>
      <AsyncButton onClick={run('pdf')}>PDF</AsyncButton>
      <button onClick={() => void navigator.clipboard.writeText(markdown).then(() => setMsg('Copied to clipboard'))}>Copy</button>
      {msg && <span className="muted small">{msg}</span>}
    </span>
  )
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
