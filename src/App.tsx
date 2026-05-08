import {
  ArrowUpRight,
  Bell,
  Braces,
  CalendarClock,
  Clipboard,
  Download,
  ExternalLink,
  FileJson,
  Filter,
  GitPullRequest,
  ListChecks,
  Radio,
  Rss,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import './App.css'
import type { CoverageDataset, CoverageEntry, ImpactLevel } from './lib/types'
import {
  formatDateLabel,
  formatImpactLabel,
  formatRelativeWindow,
  formatSourceLabel,
  getDateSortValue,
} from './lib/presentation'

type ViewMode = 'radar' | 'changes' | 'queue' | 'brief' | 'feed'
type QuickFilter = 'all' | 'high' | 'coding' | 'effective' | 'local' | 'national' | 'admin'
type SortMode = 'impact' | 'updated' | 'effective' | 'title'

const viewTabs: Array<{ id: ViewMode; label: string }> = [
  { id: 'radar', label: 'Radar' },
  { id: 'changes', label: 'Changes' },
  { id: 'queue', label: 'Queue' },
  { id: 'brief', label: 'Brief' },
  { id: 'feed', label: 'Feed' },
]

const quickFilters: Array<{ id: QuickFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'high', label: 'High impact' },
  { id: 'coding', label: 'Coding' },
  { id: 'effective', label: 'Effective date' },
  { id: 'local', label: 'Local' },
  { id: 'national', label: 'National' },
  { id: 'admin', label: 'Admin' },
]

const queueDefinitions = [
  {
    id: 'coding-review',
    title: 'Coding review',
    description: 'Code-set, modifier, HCPCS, CPT, ICD-10, and charge capture changes.',
    matcher: (entry: CoverageEntry) => entry.tags.includes('coding'),
  },
  {
    id: 'criteria-review',
    title: 'Coverage criteria',
    description: 'Medical-necessity or coverage-language changes that can alter intake rules.',
    matcher: (entry: CoverageEntry) => entry.tags.includes('coverage criteria'),
  },
  {
    id: 'effective-watch',
    title: 'Effective date watch',
    description: 'Items with explicit effective-date language or an effective date to verify.',
    matcher: (entry: CoverageEntry) => entry.tags.includes('effective date') || Boolean(entry.effectiveDate),
  },
  {
    id: 'national-monitor',
    title: 'National monitor',
    description: 'NCD-level updates worth separating from MAC-local workflow noise.',
    matcher: (entry: CoverageEntry) => entry.source === 'national',
  },
  {
    id: 'retirement-watch',
    title: 'Retirement watch',
    description: 'Retirement, withdrawal, or future-retire signals that can break old references.',
    matcher: (entry: CoverageEntry) => entry.tags.includes('retirement') || Boolean(entry.retirementDate),
  },
]

function countBy<T extends string>(values: T[]): Array<{ label: T; count: number }> {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})

  return Object.entries(counts)
    .map(([label, count]) => ({ label: label as T, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

function getBriefSection(dataset: CoverageDataset, heading: string): string[] {
  return dataset.brief.sections.find((section) => section.heading === heading)?.items ?? []
}

function getEntryText(entry: CoverageEntry): string {
  return [
    entry.displayId,
    entry.title,
    entry.contractorName,
    entry.summary,
    entry.narrative,
    entry.reasons.join(' '),
    entry.changedText.join(' '),
    entry.tags.join(' '),
  ]
    .join(' ')
    .toLowerCase()
}

function matchesQuickFilter(entry: CoverageEntry, quickFilter: QuickFilter): boolean {
  if (quickFilter === 'all') {
    return true
  }

  if (quickFilter === 'high') {
    return entry.impact === 'high'
  }

  if (quickFilter === 'coding') {
    return entry.tags.includes('coding')
  }

  if (quickFilter === 'effective') {
    return entry.tags.includes('effective date') || Boolean(entry.effectiveDate)
  }

  if (quickFilter === 'local' || quickFilter === 'national') {
    return entry.source === quickFilter
  }

  return entry.tags.includes('administrative correction') || entry.impact === 'low'
}

function App() {
  const [dataset, setDataset] = useState<CoverageDataset | null>(null)
  const [search, setSearch] = useState('')
  const [impact, setImpact] = useState<'all' | ImpactLevel>('all')
  const [docType, setDocType] = useState<'all' | CoverageEntry['docType']>('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [contractor, setContractor] = useState('all')
  const [tag, setTag] = useState('all')
  const [sortMode, setSortMode] = useState<SortMode>('impact')
  const [viewMode, setViewMode] = useState<ViewMode>('radar')
  const [selectedEntryId, setSelectedEntryId] = useState<string>('')
  const [copied, setCopied] = useState('')
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
        setSelectedEntryId(json.entries[0]?.recordId ?? '')
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

  const entries = useMemo(() => dataset?.entries ?? [], [dataset])
  const normalizedSearch = deferredSearch.trim().toLowerCase()
  const filteredEntries = useMemo(
    () => {
      const visible = entries.filter((entry) => {
        const matchesImpact = impact === 'all' || entry.impact === impact
        const matchesDocType = docType === 'all' || entry.docType === docType
        const matchesContractor = contractor === 'all' || entry.contractorName === contractor
        const matchesTag = tag === 'all' || entry.tags.includes(tag)
        const matchesSearch = normalizedSearch.length === 0 || getEntryText(entry).includes(normalizedSearch)
        return (
          matchesImpact &&
          matchesDocType &&
          matchesContractor &&
          matchesTag &&
          matchesSearch &&
          matchesQuickFilter(entry, quickFilter)
        )
      })

      return [...visible].sort((left, right) => {
        if (sortMode === 'updated') {
          return right.updatedSort.localeCompare(left.updatedSort)
        }

        if (sortMode === 'effective') {
          return getDateSortValue(right.effectiveDate) - getDateSortValue(left.effectiveDate)
        }

        if (sortMode === 'title') {
          return left.title.localeCompare(right.title)
        }

        return right.impactScore - left.impactScore || right.updatedSort.localeCompare(left.updatedSort)
      })
    },
    [contractor, docType, entries, impact, normalizedSearch, quickFilter, sortMode, tag],
  )

  const selectedEntry =
    entries.find((entry) => entry.recordId === selectedEntryId) ?? filteredEntries[0] ?? entries[0]
  const highlights = dataset?.highlights ?? []
  const mondayChecks = dataset ? getBriefSection(dataset, 'Monday checks') : []
  const highImpactMoves = dataset ? getBriefSection(dataset, 'High-impact moves') : []
  const quietCorrections = dataset ? getBriefSection(dataset, 'Quiet corrections') : []

  const breakdowns = useMemo(() => {
    const byDocType = countBy(entries.map((entry) => entry.docType))
    const byImpact = countBy(entries.map((entry) => entry.impact))
    const topContractors = countBy(entries.map((entry) => entry.contractorName).filter(Boolean) as string[]).slice(0, 6)
    const topTags = countBy(entries.flatMap((entry) => entry.tags)).slice(0, 6)
    const contractors = countBy(entries.map((entry) => entry.contractorName).filter(Boolean) as string[])
    const tags = countBy(entries.flatMap((entry) => entry.tags))

    return { byDocType, byImpact, contractors, tags, topContractors, topTags }
  }, [entries])

  const queueItems = useMemo(
    () =>
      queueDefinitions.map((definition) => {
        const matches = entries.filter(definition.matcher).slice(0, 8)
        return {
          ...definition,
          entries: matches,
          count: entries.filter(definition.matcher).length,
          highImpact: entries.filter((entry) => definition.matcher(entry) && entry.impact === 'high').length,
        }
      }),
    [entries],
  )

  const queueBrief = queueItems
    .map((item) => {
      const leads = item.entries.slice(0, 3).map((entry) => `${entry.displayId}: ${entry.title}`).join('\n')
      return `${item.title} (${item.count})\n${leads || 'No current items.'}`
    })
    .join('\n\n')

  const copyText = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    window.setTimeout(() => setCopied(''), 1600)
  }

  if (error) {
    return (
      <main className="app-frame">
        <section className="state-panel">
          <ShieldCheck aria-hidden="true" />
          <h1>The wall did not load.</h1>
          <p>{error}</p>
          <a className="text-link" href={`${import.meta.env.BASE_URL}data/latest.json`}>
            Open raw dataset
          </a>
        </section>
      </main>
    )
  }

  if (!dataset) {
    return (
      <main className="app-frame">
        <section className="state-panel">
          <Radio aria-hidden="true" />
          <h1>Loading the latest CMS update window.</h1>
          <p>Pulling the changelog, brief, and policy wall.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="app-frame">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Coverage Changelog</p>
          <h1>CMS coverage changes, ranked for Monday morning.</h1>
        </div>
        <nav className="top-actions" aria-label="Primary resources">
          <a href="https://github.com/ByteWorthyLLC/coverage-changelog" target="_blank" rel="noreferrer">
            <GitPullRequest aria-hidden="true" />
            GitHub
          </a>
          <a href={`${import.meta.env.BASE_URL}briefs/latest.md`} target="_blank" rel="noreferrer">
            <ListChecks aria-hidden="true" />
            Brief
          </a>
          <a href={`${import.meta.env.BASE_URL}rss.xml`} target="_blank" rel="noreferrer">
            <Rss aria-hidden="true" />
            RSS
          </a>
        </nav>
      </header>

      <section className="command-center" aria-label="Coverage update summary">
        <div className="signal-panel">
          <div className="signal-header">
            <div>
              <p className="eyebrow">Live window</p>
              <h2>{formatRelativeWindow(dataset.updatePeriod.beginDate, dataset.updatePeriod.endDate)}</h2>
            </div>
            <span className="live-badge">
              <Radio aria-hidden="true" />
              API {dataset.cmsApiVersion}
            </span>
          </div>
          <p className="signal-copy">
            Official CMS updates are pulled into static artifacts, sorted by likely work impact,
            and published with no login, backend, patient data, or paid API dependency.
          </p>
          <div className="signal-grid">
            <div>
              <strong>{dataset.stats.total}</strong>
              <span>changes</span>
            </div>
            <div>
              <strong>{dataset.stats.highImpact}</strong>
              <span>high impact</span>
            </div>
            <div>
              <strong>{dataset.stats.codingChanges}</strong>
              <span>coding flags</span>
            </div>
            <div>
              <strong>{dataset.stats.contractors}</strong>
              <span>MAC footprints</span>
            </div>
          </div>
        </div>

        <div className="brief-panel">
          <div className="panel-title">
            <Bell aria-hidden="true" />
            <h2>Monday checks</h2>
          </div>
          <ol className="brief-checks">
            {mondayChecks.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className="toolbar" aria-label="Coverage changelog controls">
        <div className="tab-list" role="tablist" aria-label="View mode">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={viewMode === tab.id ? 'active' : ''}
              onClick={() => setViewMode(tab.id)}
              role="tab"
              aria-selected={viewMode === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="search-box">
          <Search aria-hidden="true" />
          <input
            type="search"
            placeholder="Search code, contractor, document, policy language"
            value={search}
            onChange={(event) => {
              const nextValue = event.target.value
              startTransition(() => setSearch(nextValue))
            }}
          />
        </div>
      </section>

      <section className="filter-row" aria-label="Quick filters">
        <div className="quick-filters">
          {quickFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={quickFilter === filter.id ? 'active' : ''}
              onClick={() => setQuickFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="select-filters">
          <label>
            <Filter aria-hidden="true" />
            <select value={impact} onChange={(event) => setImpact(event.target.value as 'all' | ImpactLevel)}>
              <option value="all">All impact</option>
              <option value="high">High impact</option>
              <option value="medium">Medium impact</option>
              <option value="low">Low impact</option>
            </select>
          </label>
          <label>
            <FileJson aria-hidden="true" />
            <select
              value={docType}
              onChange={(event) => setDocType(event.target.value as 'all' | CoverageEntry['docType'])}
            >
              <option value="all">All documents</option>
              <option value="LCD">LCD</option>
              <option value="Article">Article</option>
              <option value="NCD">NCD</option>
            </select>
          </label>
          <label>
            <Radio aria-hidden="true" />
            <select value={contractor} onChange={(event) => setContractor(event.target.value)}>
              <option value="all">All contractors</option>
              {breakdowns.contractors.map((item) => (
                <option key={item.label} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <SlidersHorizontal aria-hidden="true" />
            <select value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="all">All themes</option>
              {breakdowns.tags.map((item) => (
                <option key={item.label} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <SlidersHorizontal aria-hidden="true" />
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="impact">Sort by impact</option>
              <option value="updated">Sort by updated</option>
              <option value="effective">Sort by effective date</option>
              <option value="title">Sort by title</option>
            </select>
          </label>
        </div>
      </section>

      {viewMode === 'radar' ? (
        <section className="radar-grid">
          <div className="analysis-panel span-2">
            <div className="panel-title">
              <Sparkles aria-hidden="true" />
              <h2>Highest signal updates</h2>
            </div>
            <div className="highlight-strip">
              {highlights.map((highlight) => (
                <button
                  key={highlight.recordId}
                  type="button"
                  className={`highlight-tile impact-${highlight.impact}`}
                  onClick={() => {
                    setSelectedEntryId(highlight.recordId)
                    setViewMode('changes')
                  }}
                >
                  <span>{formatImpactLabel(highlight.impact)}</span>
                  <strong>{highlight.title}</strong>
                  <p>{highlight.quote}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="analysis-panel">
            <div className="panel-title">
              <Braces aria-hidden="true" />
              <h2>Document mix</h2>
            </div>
            <MetricBars items={breakdowns.byDocType} total={entries.length} />
          </div>

          <div className="analysis-panel">
            <div className="panel-title">
              <ShieldCheck aria-hidden="true" />
              <h2>Impact mix</h2>
            </div>
            <MetricBars items={breakdowns.byImpact} total={entries.length} />
          </div>

          <div className="analysis-panel">
            <div className="panel-title">
              <Radio aria-hidden="true" />
              <h2>Contractor coverage</h2>
            </div>
            <MetricBars items={breakdowns.topContractors} total={dataset.stats.local} />
          </div>

          <div className="analysis-panel">
            <div className="panel-title">
              <Filter aria-hidden="true" />
              <h2>Detected themes</h2>
            </div>
            <MetricBars items={breakdowns.topTags} total={entries.length} />
          </div>
        </section>
      ) : null}

      {viewMode === 'changes' ? (
        <section className="workbench">
          <div className="change-list" aria-label="Coverage changes">
            <div className="list-header">
              <span>{filteredEntries.length} visible</span>
              <span>{entries.length} total</span>
            </div>
            {filteredEntries.map((entry) => (
              <button
                key={entry.recordId}
                type="button"
                className={`change-row impact-${entry.impact} ${
                  selectedEntry?.recordId === entry.recordId ? 'selected' : ''
                }`}
                onClick={() => setSelectedEntryId(entry.recordId)}
              >
                <span className="change-id">{entry.displayId}</span>
                <span className="change-body">
                  <strong>{entry.title}</strong>
                  <span>{entry.highlight}</span>
                </span>
                <span className="change-meta">{formatImpactLabel(entry.impact)}</span>
              </button>
            ))}
            {filteredEntries.length === 0 ? (
              <div className="empty-list">
                <Search aria-hidden="true" />
                <strong>No matching coverage changes.</strong>
                <p>Try clearing one filter, switching contractor, or searching a document ID.</p>
              </div>
            ) : null}
          </div>

          {selectedEntry ? (
            <aside className={`detail-panel impact-${selectedEntry.impact}`} aria-label="Selected change detail">
              <div className="detail-top">
                <div>
                  <p className="eyebrow">{selectedEntry.displayId}</p>
                  <h2>{selectedEntry.title}</h2>
                </div>
                <button type="button" className="icon-button" onClick={() => setSelectedEntryId('')}>
                  <X aria-hidden="true" />
                  <span className="sr-only">Clear selected change</span>
                </button>
              </div>
              <div className="pill-row">
                <span className={`impact-pill impact-${selectedEntry.impact}`}>
                  {formatImpactLabel(selectedEntry.impact)}
                </span>
                <span className="quiet-pill">{selectedEntry.docType}</span>
                <span className="quiet-pill">{formatSourceLabel(selectedEntry.source)}</span>
              </div>
              <dl className="detail-facts">
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDateLabel(selectedEntry.updatedOn)}</dd>
                </div>
                <div>
                  <dt>Effective</dt>
                  <dd>{formatDateLabel(selectedEntry.effectiveDate)}</dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>{selectedEntry.version}</dd>
                </div>
              </dl>
              {selectedEntry.contractorName ? <p className="contractor-line">{selectedEntry.contractorName}</p> : null}
              <p className="detail-summary">{selectedEntry.summary}</p>
              <p>{selectedEntry.narrative}</p>
              <div className="tag-row">
                {selectedEntry.tags.map((tag) => (
                  <span key={`${selectedEntry.recordId}-${tag}`}>{tag}</span>
                ))}
              </div>
              <div className="source-note">
                <strong>Official revision text</strong>
                <p>{selectedEntry.changedText[0] ?? selectedEntry.reasons[0] ?? selectedEntry.highlight}</p>
              </div>
              <div className="detail-actions">
                <a href={selectedEntry.detailUrl} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" />
                  Open CMS
                </a>
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      selectedEntry.recordId,
                      `${selectedEntry.displayId}: ${selectedEntry.title}\n${selectedEntry.summary}\n${selectedEntry.detailUrl}`,
                    )
                  }
                >
                  <Clipboard aria-hidden="true" />
                  {copied === selectedEntry.recordId ? 'Copied' : 'Copy'}
                </button>
              </div>
            </aside>
          ) : null}
        </section>
      ) : null}

      {viewMode === 'queue' ? (
        <section className="queue-view">
          <article className="queue-hero">
            <div className="panel-title">
              <CalendarClock aria-hidden="true" />
              <h2>Operator review queue</h2>
            </div>
            <p>
              A no-login triage layer that turns public CMS updates into practical review lanes
              for coding, criteria, effective dates, national policy, and retirements.
            </p>
            <button type="button" onClick={() => void copyText('queue-brief', queueBrief)}>
              <Clipboard aria-hidden="true" />
              {copied === 'queue-brief' ? 'Copied queue brief' : 'Copy queue brief'}
            </button>
          </article>
          {queueItems.map((item) => (
            <article key={item.id} className="queue-card">
              <div className="queue-card-top">
                <div>
                  <p className="eyebrow">{item.highImpact} high impact</p>
                  <h2>{item.title}</h2>
                </div>
                <strong>{item.count}</strong>
              </div>
              <p>{item.description}</p>
              <div className="queue-list">
                {item.entries.length > 0 ? (
                  item.entries.slice(0, 5).map((entry) => (
                    <button
                      key={`${item.id}-${entry.recordId}`}
                      type="button"
                      className={`queue-entry impact-${entry.impact}`}
                      onClick={() => {
                        setSelectedEntryId(entry.recordId)
                        setViewMode('changes')
                      }}
                    >
                      <span>{entry.displayId}</span>
                      <strong>{entry.title}</strong>
                    </button>
                  ))
                ) : (
                  <span className="quiet-note">No current items in this lane.</span>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {viewMode === 'brief' ? (
        <section className="brief-view">
          <article>
            <div className="panel-title">
              <ListChecks aria-hidden="true" />
              <h2>Forwardable brief</h2>
            </div>
            <p>{dataset.brief.subtitle}</p>
            <div className="brief-actions">
              <a href={`${import.meta.env.BASE_URL}briefs/latest.md`} target="_blank" rel="noreferrer">
                <Download aria-hidden="true" />
                Markdown
              </a>
              <a href={`${import.meta.env.BASE_URL}briefs/latest.html`} target="_blank" rel="noreferrer">
                <ArrowUpRight aria-hidden="true" />
                HTML
              </a>
            </div>
          </article>
          <article>
            <h3>High-impact moves</h3>
            <ul className="dense-list">
              {highImpactMoves.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article>
            <h3>Quiet corrections</h3>
            <ul className="dense-list">
              {quietCorrections.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}

      {viewMode === 'feed' ? (
        <section className="feed-view">
          <article className="feed-card">
            <FileJson aria-hidden="true" />
            <h2>JSON dataset</h2>
            <p>Full static dataset with highlights, stats, brief sections, and entries.</p>
            <a href={`${import.meta.env.BASE_URL}data/latest.json`} target="_blank" rel="noreferrer">
              Open latest.json
            </a>
          </article>
          <article className="feed-card">
            <Braces aria-hidden="true" />
            <h2>Flat feed</h2>
            <p>Smaller array for downstream scripts and lightweight integrations.</p>
            <a href={`${import.meta.env.BASE_URL}data/feed.json`} target="_blank" rel="noreferrer">
              Open feed.json
            </a>
          </article>
          <article className="feed-card">
            <Download aria-hidden="true" />
            <h2>CSV export</h2>
            <p>Spreadsheet-friendly export for review queues and contractor slices.</p>
            <a href={`${import.meta.env.BASE_URL}data/feed.csv`} target="_blank" rel="noreferrer">
              Download CSV
            </a>
          </article>
          <article className="feed-card">
            <Sparkles aria-hidden="true" />
            <h2>High-impact feed</h2>
            <p>A smaller JSON feed focused only on changes scored as high impact.</p>
            <a href={`${import.meta.env.BASE_URL}data/high-impact.json`} target="_blank" rel="noreferrer">
              Open high-impact.json
            </a>
          </article>
          <article className="feed-card">
            <Radio aria-hidden="true" />
            <h2>Contractor slices</h2>
            <p>Grouped counts and entries by contractor for local coverage review.</p>
            <a href={`${import.meta.env.BASE_URL}data/contractors.json`} target="_blank" rel="noreferrer">
              Open contractors.json
            </a>
          </article>
          <article className="feed-card">
            <ShieldCheck aria-hidden="true" />
            <h2>Manifest</h2>
            <p>Machine-readable metadata for the current generated release.</p>
            <a href={`${import.meta.env.BASE_URL}data/manifest.json`} target="_blank" rel="noreferrer">
              Open manifest.json
            </a>
          </article>
          <article className="feed-card">
            <CalendarClock aria-hidden="true" />
            <h2>Review queues</h2>
            <p>Pre-grouped operator lanes for coding, criteria, effective dates, and retirements.</p>
            <a href={`${import.meta.env.BASE_URL}data/queues.json`} target="_blank" rel="noreferrer">
              Open queues.json
            </a>
          </article>
          <article className="feed-card">
            <Rss aria-hidden="true" />
            <h2>RSS</h2>
            <p>Subscribe to generated policy updates without a paid service.</p>
            <a href={`${import.meta.env.BASE_URL}rss.xml`} target="_blank" rel="noreferrer">
              Open RSS
            </a>
          </article>
        </section>
      ) : null}
    </main>
  )
}

function MetricBars({ items, total }: { items: Array<{ label: string; count: number }>; total: number }) {
  return (
    <div className="metric-bars">
      {items.map((item) => (
        <div key={item.label} className="metric-row">
          <div>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </div>
          <progress value={item.count} max={Math.max(total, 1)} />
        </div>
      ))}
    </div>
  )
}

export default App
