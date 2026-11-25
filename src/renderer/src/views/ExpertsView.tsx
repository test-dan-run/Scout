import { useState } from 'react'
import { expertExtractionPrompt, extractHeuristic, parseExtraction } from '@shared/expert'
import { RUBRIC, criterionName } from '@shared/rubric'
import type { CriterionKey, ExpertInput, ExtractedItem } from '@shared/types'
import { newId, nowIso } from '@shared/util'
import { askLocalModel } from '../api'
import { AsyncButton, Badge, Empty, Section, Select, TextArea, TextField } from '../components/ui'
import { useData } from '../data'

const CRITERION_OPTIONS = [{ value: '' as const, label: 'No criterion' }, ...RUBRIC.map((c) => ({ value: c.key, label: c.name }))]

function blankInput(): ExpertInput {
  const now = nowIso()
  return { id: newId('ex'), expertName: '', role: '', topic: '', rawText: '', extracted: [], createdAt: now, updatedAt: now }
}

export function ExpertsView() {
  const { data, put, remove, settings } = useData()
  const [draft, setDraft] = useState<ExpertInput | null>(null)
  const companyOptions = [{ value: '', label: 'All companies' }, ...data.companies.map((c) => ({ value: c.id, label: c.name }))]

  return (
    <div className="page">
      <header className="page-head">
        <h1>Expert inputs</h1>
        <p className="muted">
          Paste an expert's email or chat message. Scout pulls out the concerns and questions, and you confirm each one. Confirmed
          items become must-ask questions for the companies they are tagged with. Expert inputs never leave this Mac.
        </p>
      </header>

      {!draft && (
        <div className="actions">
          <button className="primary" onClick={() => setDraft(blankInput())}>
            Paste a new expert input
          </button>
        </div>
      )}

      {draft && (
        <Section title="New expert input">
          <div className="grid3">
            <TextField label="Expert" value={draft.expertName} onChange={(v) => setDraft({ ...draft, expertName: v })} />
            <TextField label="Role or area" value={draft.role} onChange={(v) => setDraft({ ...draft, role: v })} placeholder="e.g. Security, Legal, Finance BU" />
            <TextField label="Topic" value={draft.topic} onChange={(v) => setDraft({ ...draft, topic: v })} />
          </div>
          <div className="grid2">
            <Select label="Company" value={draft.companyId ?? ''} options={companyOptions} onChange={(v) => setDraft({ ...draft, companyId: v || undefined })} />
            <Select<CriterionKey | ''>
              label="Rubric criterion"
              value={draft.criterion ?? ''}
              options={CRITERION_OPTIONS}
              onChange={(v) => setDraft({ ...draft, criterion: v || undefined })}
            />
          </div>
          <TextArea label="Pasted message" value={draft.rawText} onChange={(v) => setDraft({ ...draft, rawText: v })} rows={8} />
          <div className="actions">
            <button
              className="primary"
              disabled={!draft.rawText.trim()}
              onClick={() => {
                const rec = { ...draft, extracted: extractHeuristic(draft.rawText) }
                put('experts', rec)
                setDraft(null)
              }}
            >
              Save and extract
            </button>
            <button onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </Section>
      )}

      {data.experts.length === 0 && !draft && <Empty>No expert inputs yet.</Empty>}

      {[...data.experts].reverse().map((e) => (
        <ExpertCard
          key={e.id}
          input={e}
          companyName={data.companies.find((c) => c.id === e.companyId)?.name ?? 'All companies'}
          modelReady={settings.llmProvider !== 'none'}
          onChange={(rec) => put('experts', rec)}
          onRemove={() => remove('experts', e.id)}
        />
      ))}
    </div>
  )
}

function ExpertCard(props: {
  input: ExpertInput
  companyName: string
  modelReady: boolean
  onChange: (e: ExpertInput) => void
  onRemove: () => void
}) {
  const e = props.input
  const [showRaw, setShowRaw] = useState(false)
  const setItem = (id: string, patch: Partial<ExtractedItem>) =>
    props.onChange({ ...e, extracted: e.extracted.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const pending = e.extracted.filter((x) => x.confirmed === null).length

  return (
    <Section
      title={`${e.expertName || 'Expert'}${e.role ? `, ${e.role}` : ''}`}
      actions={
        <>
          <Badge>{props.companyName}</Badge>
          {e.criterion && <Badge tone="info">{criterionName(e.criterion)}</Badge>}
          {pending > 0 && <Badge tone="warn">{pending} to review</Badge>}
          <AsyncButton
            disabled={!props.modelReady}
            title={props.modelReady ? 'Re-extract with the local model' : 'Set up a local model in Settings'}
            onClick={async () => {
              const p = expertExtractionPrompt(e.rawText, e.role)
              const items = parseExtraction(await askLocalModel(p.system, p.user))
              if (!items) throw new Error('The model reply was not valid JSON. Try again or keep the built-in extraction.')
              const kept = e.extracted.filter((x) => x.confirmed === true)
              props.onChange({ ...e, extracted: [...kept, ...items] })
            }}
          >
            Extract with local model
          </AsyncButton>
          <button className="link" onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? 'Hide message' : 'Show message'}
          </button>
          <button className="link danger" onClick={props.onRemove}>
            Delete
          </button>
        </>
      }
    >
      {e.topic && <p className="muted small">Topic: {e.topic}</p>}
      {showRaw && <pre className="raw">{e.rawText}</pre>}
      {e.extracted.length === 0 && <Empty>Nothing found. Add items by hand.</Empty>}
      {e.extracted.map((x) => (
        <div key={x.id} className={`row card tight item-${x.confirmed === null ? 'pending' : x.confirmed ? 'yes' : 'no'}`}>
          <Select value={x.kind} options={[{ value: 'concern', label: 'Concern' }, { value: 'question', label: 'Question' }]} onChange={(v) => setItem(x.id, { kind: v })} />
          <div className="grow">
            <TextField value={x.text} onChange={(v) => setItem(x.id, { text: v })} />
          </div>
          <Select<CriterionKey | ''> value={x.criterion ?? ''} options={CRITERION_OPTIONS} onChange={(v) => setItem(x.id, { criterion: v || undefined })} />
          <button className={x.confirmed === true ? 'primary' : ''} onClick={() => setItem(x.id, { confirmed: true })}>
            Confirm
          </button>
          <button className={x.confirmed === false ? 'danger' : ''} onClick={() => setItem(x.id, { confirmed: false })}>
            Discard
          </button>
        </div>
      ))}
      <div className="actions">
        <button
          className="link"
          onClick={() => props.onChange({ ...e, extracted: [...e.extracted, { id: newId('x'), kind: 'concern', text: '', confirmed: true }] })}
        >
          Add an item by hand
        </button>
      </div>
    </Section>
  )
}
