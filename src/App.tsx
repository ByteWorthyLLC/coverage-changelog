import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import './App.css'
import type { CoverageDataset, CoverageEntry, ImpactLevel } from './lib/types'
import {
  formatDateLabel,
  formatImpactLabel,
  formatRelativeWindow,
  formatSourceLabel,
  formatStamp,
} from './lib/presentation'

function App() {
  const [dataset, setDataset] = useState<CoverageDataset | null>(null)
  const [search, setSearch] = useState('')
  const [impact, setImpact] = useState<'all' | ImpactLevel>('all')
  const [docType, setDocType] = useState<'all' | CoverageEntry['docType']>('all')
  const [error, setError] = useState('')
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/latest.json`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Unable to load dataset (${response.status})`)
        }

        const json = (await response.json()) as CoverageDataset
        setDataset(json)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        const message =
          loadError instanceof Error ? loadError.message : 'Unable to load coverage data.'
        setError(message)
      }
    }

    void load()

    return () => controller.abort()
  }, [])

  const normalizedSearch = deferredSearch.trim().toLowerCase()
  const entries = dataset?.entries ?? []
  const filteredEntries = entries.filter((entry) => {
    const matchesImpact = impact === 'all' || entry.impact === impact
    const matchesDocType = docType === 'all' || entry.docType === docType
    const haystack = [
      entry.displayId,
      entry.title,
      entry.contractorName,
      entry.summary,
      entry.narrative,
      entry.reasons.join(' '),
      entry.tags.join(' '),
    ]
      .join(' ')
      .toLowerCase()

    const matchesSearch = normalizedSearch.length === 0 || haystack.includes(normalizedSearch)
    return matchesImpact && matchesDocType && matchesSearch
  })

  const highlights = dataset?.highlights ?? []
  const mondayChecks = dataset?.brief.sections.find((section) => section.heading === 'Monday checks')

  if (error) {
    return (
      <main className="shell">
        <section className="error-state">
          <p className="eyebrow">Coverage Changelog</p>
          <h1>The wall did not load.</h1>
          <p>{error}</p>
          <a className="ghost-link" href={`${import.meta.env.BASE_URL}data/latest.json`}>
            Open raw dataset
          </a>
        </section>
      </main>
    )
  }

  if (!dataset) {
    return (
      <main className="shell">
        <section className="loading-state">
          <p className="eyebrow">Coverage Changelog</p>
          <h1>Loading the latest CMS update window.</h1>
          <p>Pulling the changelog, brief, and policy wall.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Coverage Changelog</p>
          <h1>This is not a policy database. It is a changelog for coverage rules.</h1>
          <p className="lede">
            CMS local and national updates, diffed into a Monday brief and a live policy wall.
            No patient data. No login. Just the updates worth forwarding.
          </p>
        </div>

        <div className="hero-aside">
          <div className="status-card">
            <span className="status-label">Current window</span>
            <strong>{formatRelativeWindow(dataset.updatePeriod.beginDate, dataset.updatePeriod.endDate)}</strong>
            <p>{dataset.updatePeriod.label}</p>
          </div>
          <div className="status-card">
            <span className="status-label">Generated</span>
            <strong>{formatStamp(dataset.generatedAt)}</strong>
            <p>API {dataset.cmsApiVersion}</p>
          </div>
        </div>
      </section>

      <section className="stats-strip">
        <article className="stat-card">
          <span>Tracked changes</span>
          <strong>{dataset.stats.total}</strong>
          <p>Local and national CMS policy updates in one window.</p>
        </article>
        <article className="stat-card">
          <span>High impact</span>
          <strong>{dataset.stats.highImpact}</strong>
          <p>Changes likely to touch coding, coverage criteria, or operational rules.</p>
        </article>
        <article className="stat-card">
          <span>Local vs national</span>
          <strong>
            {dataset.stats.local} / {dataset.stats.national}
          </strong>
          <p>Local coverage articles and LCDs alongside national signals.</p>
        </article>
        <article className="stat-card">
          <span>Contractors</span>
          <strong>{dataset.stats.contractors}</strong>
          <p>Distinct MAC footprints represented in this release window.</p>
        </article>
      </section>

      <section className="feature-grid">
        <article className="feature-card feature-card-brief">
          <div className="feature-header">
            <p className="eyebrow">Monday brief</p>
            <h2>Forwardable in under a minute.</h2>
          </div>
          <p>
            The changelog generates a short markdown and HTML brief from the same official CMS
            revision notes powering the wall.
          </p>
          <div className="brief-actions">
            <a href={`${import.meta.env.BASE_URL}briefs/latest.md`} target="_blank" rel="noreferrer">
              Open markdown brief
            </a>
            <a href={`${import.meta.env.BASE_URL}briefs/latest.html`} target="_blank" rel="noreferrer">
              Open HTML brief
            </a>
          </div>
          <ul className="brief-list">
            {dataset.brief.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </article>

        <article className="feature-card feature-card-sources">
          <div className="feature-header">
            <p className="eyebrow">Open inputs</p>
            <h2>Built on free CMS APIs.</h2>
          </div>
          <p>
            Local and national report endpoints, update-period metadata, and document-level
            revision history. No scraping required for v1.
          </p>
          <div className="brief-actions">
            <a href="https://api.coverage.cms.gov/docs/" target="_blank" rel="noreferrer">
              Coverage API docs
            </a>
            <a href={`${import.meta.env.BASE_URL}data/feed.json`} target="_blank" rel="noreferrer">
              Open JSON feed
            </a>
          </div>
        </article>
      </section>

      <section className="highlights-panel">
        <div className="section-heading">
          <p className="eyebrow">Whoa moments</p>
          <h2>The updates most likely to change Monday morning work.</h2>
        </div>
        <div className="highlight-grid">
          {highlights.map((highlight) => (
            <article key={highlight.recordId} className={`highlight-card impact-${highlight.impact}`}>
              <div className="pill-row">
                <span className={`impact-pill impact-${highlight.impact}`}>
                  {formatImpactLabel(highlight.impact)}
                </span>
                <span className="quiet-pill">{formatDateLabel(highlight.updatedOn)}</span>
              </div>
              <h3>{highlight.title}</h3>
              <p>{highlight.quote}</p>
              <a href={highlight.detailUrl} target="_blank" rel="noreferrer">
                Open source document
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="wall-panel">
        <div className="wall-toolbar">
          <div className="section-heading">
            <p className="eyebrow">Policy wall</p>
            <h2>Every tracked change, ranked by likely operational impact.</h2>
          </div>
          <div className="toolbar-actions">
            <label>
              <span>Search</span>
              <input
                type="search"
                placeholder="Try CPT, Palmetto, L39036, coverage..."
                value={search}
                onChange={(event) => {
                  const nextValue = event.target.value
                  startTransition(() => setSearch(nextValue))
                }}
              />
            </label>
            <label>
              <span>Impact</span>
              <select value={impact} onChange={(event) => setImpact(event.target.value as 'all' | ImpactLevel)}>
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              <span>Document</span>
              <select
                value={docType}
                onChange={(event) =>
                  setDocType(event.target.value as 'all' | CoverageEntry['docType'])
                }
              >
                <option value="all">All</option>
                <option value="LCD">LCD</option>
                <option value="Article">Article</option>
                <option value="NCD">NCD</option>
              </select>
            </label>
          </div>
        </div>

        {mondayChecks ? (
          <aside className="monday-checks">
            <h3>{mondayChecks.heading}</h3>
            <ul>
              {mondayChecks.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </aside>
        ) : null}

        <div className="wall-grid">
          {filteredEntries.map((entry) => (
            <article key={entry.recordId} className={`wall-card impact-${entry.impact}`}>
              <div className="wall-card-top">
                <div className="pill-row">
                  <span className={`impact-pill impact-${entry.impact}`}>
                    {formatImpactLabel(entry.impact)}
                  </span>
                  <span className="quiet-pill">{entry.docType}</span>
                  <span className="quiet-pill">{formatSourceLabel(entry.source)}</span>
                </div>
                <span className="stamp">{entry.displayId}</span>
              </div>

              <h3>{entry.title}</h3>
              <p className="meta-line">
                {entry.contractorName ? `${entry.contractorName} · ` : ''}
                Updated {formatDateLabel(entry.updatedOn)}
                {entry.effectiveDate ? ` · Effective ${formatDateLabel(entry.effectiveDate)}` : ''}
              </p>

              <p className="summary">{entry.summary}</p>
              <p className="narrative">{entry.narrative}</p>

              <ul className="tag-row">
                {entry.tags.map((tag) => (
                  <li key={`${entry.recordId}-${tag}`}>{tag}</li>
                ))}
              </ul>

              {entry.reasons.length > 0 ? (
                <blockquote>{entry.reasons[0]}</blockquote>
              ) : (
                <blockquote>{entry.highlight}</blockquote>
              )}

              <div className="wall-footer">
                <a href={entry.detailUrl} target="_blank" rel="noreferrer">
                  Open CMS detail
                </a>
                <span>{formatStamp(entry.updatedSort)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
