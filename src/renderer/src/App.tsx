import { useState } from 'react'
import { coverage } from '@shared/questionBank'
import { RECOMMENDATION_LABEL } from '@shared/recommend'
import { useData } from './data'
import { CompaniesView } from './views/CompaniesView'
import { ContextPackView } from './views/ContextPackView'
import { EngagementView } from './views/EngagementView'
import { ExpertsView } from './views/ExpertsView'
import { SettingsView } from './views/SettingsView'

export type Route = { view: 'pack' } | { view: 'experts' } | { view: 'companies' } | { view: 'settings' } | { view: 'engagement'; id: string }

export function App() {
  const { data, loaded } = useData()
  const [route, setRoute] = useState<Route>({ view: 'companies' })

  if (!loaded) return <div className="loading">Opening Scout…</div>

  const engagements = [...data.engagements].sort((a, b) => {
    const an = data.companies.find((c) => c.id === a.companyId)?.name ?? ''
    const bn = data.companies.find((c) => c.id === b.companyId)?.name ?? ''
    return an.localeCompare(bn) || a.round - b.round
  })

  const nav = (r: Route, label: string, extra?: string) => {
    const active = JSON.stringify(r) === JSON.stringify(route)
    return (
      <button className={`nav-item${active ? ' active' : ''}`} onClick={() => setRoute(r)}>
        <span>{label}</span>
        {extra && <span className="nav-extra">{extra}</span>}
      </button>
    )
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          Scout <span className="muted small">AI Platforms</span>
        </div>
        <div className="nav-group">
          {nav({ view: 'pack' }, 'Workplace Context Pack')}
          {nav({ view: 'experts' }, 'Expert inputs', String(data.experts.length || ''))}
          {nav({ view: 'companies' }, 'Companies', String(data.companies.length || ''))}
        </div>
        <div className="nav-label">Engagements</div>
        <div className="nav-group scroll">
          {engagements.map((e) => {
            const c = data.companies.find((x) => x.id === e.companyId)
            const cov = coverage(data.questions.filter((q) => q.engagementId === e.id))
            const status = e.status === 'active' ? (cov.mustTotal ? `${cov.mustCovered}/${cov.mustTotal}` : e.stage) : RECOMMENDATION_LABEL[e.status]
            return <div key={e.id}>{nav({ view: 'engagement', id: e.id }, `${c?.name ?? 'Unknown'}${e.round > 1 ? ` · R${e.round}` : ''}`, status)}</div>
          })}
        </div>
        <div className="nav-group bottom">{nav({ view: 'settings' }, 'Settings')}</div>
      </aside>
      <main className="main">
        {route.view === 'pack' && <ContextPackView />}
        {route.view === 'experts' && <ExpertsView />}
        {route.view === 'companies' && <CompaniesView open={(id) => setRoute({ view: 'engagement', id })} />}
        {route.view === 'settings' && <SettingsView />}
        {route.view === 'engagement' && (
          <EngagementView key={route.id} id={route.id} open={(id) => setRoute({ view: 'engagement', id })} back={() => setRoute({ view: 'companies' })} />
        )}
      </main>
    </div>
  )
}
