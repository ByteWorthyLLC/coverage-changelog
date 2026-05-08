import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getArticleRevisionHistory,
  getDocsSpecVersion,
  getLcdReasonChange,
  getLcdRevisionHistory,
  getLcdSynopsisChanges,
  getLicenseToken,
  getLocalWhatsNew,
  getNationalWhatsNew,
  getUpdatePeriod,
} from './cms-api'
import { buildCoverageDataset, type LocalDetailBundle } from './intelligence'
import type { CoverageDataset, CoverageUpdatePeriod } from '../lib/types'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const publicDir = path.join(projectRoot, 'public')
const dataDir = path.join(publicDir, 'data')
const briefDir = path.join(publicDir, 'briefs')
const latestDatasetPath = path.join(dataDir, 'latest.json')
const publicSiteUrl = 'https://byteworthyllc.github.io/coverage-changelog/'

function parseCmsYmd(value: string): Date {
  return new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)))
}

function formatWindowLabel(beginDate: string, endDate: string): string {
  const begin = parseCmsYmd(beginDate)
  const end = parseCmsYmd(endDate)
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return `${formatter.format(begin)} to ${formatter.format(end)}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '')
  if (!/[",\n\r]/.test(text)) {
    return text
  }

  return `"${text.replaceAll('"', '""')}"`
}

function toRfc822(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toUTCString()
  }

  return parsed.toUTCString()
}

async function loadExistingDataset(): Promise<CoverageDataset | null> {
  try {
    const raw = await readFile(latestDatasetPath, 'utf8')
    return JSON.parse(raw) as CoverageDataset
  } catch {
    return null
  }
}

async function safeData<T>(label: string, operation: Promise<{ data?: T[] }>): Promise<T[]> {
  try {
    return (await operation).data ?? []
  } catch (error) {
    console.warn(`Skipped optional CMS enrichment: ${label}`)
    console.warn(error)
    return []
  }
}

async function writeArtifacts(dataset: CoverageDataset): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  await mkdir(briefDir, { recursive: true })

  const feed = dataset.entries.map((entry) => ({
    recordId: entry.recordId,
    displayId: entry.displayId,
    docType: entry.docType,
    source: entry.source,
    title: entry.title,
    updatedOn: entry.updatedOn,
    effectiveDate: entry.effectiveDate,
    impact: entry.impact,
    tags: entry.tags,
    summary: entry.summary,
    detailUrl: entry.detailUrl,
  }))
  const highImpactFeed = feed.filter((entry) => entry.impact === 'high')
  const contractors = dataset.entries.reduce<Record<string, typeof feed>>((acc, entry) => {
    const key = entry.contractorName ?? 'National coverage'
    acc[key] = acc[key] ?? []
    acc[key].push({
      recordId: entry.recordId,
      displayId: entry.displayId,
      docType: entry.docType,
      source: entry.source,
      title: entry.title,
      updatedOn: entry.updatedOn,
      effectiveDate: entry.effectiveDate,
      impact: entry.impact,
      tags: entry.tags,
      summary: entry.summary,
      detailUrl: entry.detailUrl,
    })
    return acc
  }, {})
  const contractorFeed = Object.entries(contractors)
    .map(([name, entries]) => ({
      name,
      count: entries.length,
      highImpact: entries.filter((entry) => entry.impact === 'high').length,
      entries,
    }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
  const queueDefinitions = [
    {
      id: 'coding-review',
      title: 'Coding review',
      description: 'Code-set, modifier, HCPCS, CPT, ICD-10, and charge capture changes.',
      matcher: (entry: CoverageDataset['entries'][number]) => entry.tags.includes('coding'),
    },
    {
      id: 'criteria-review',
      title: 'Coverage criteria',
      description: 'Medical-necessity or coverage-language changes that can alter intake rules.',
      matcher: (entry: CoverageDataset['entries'][number]) => entry.tags.includes('coverage criteria'),
    },
    {
      id: 'effective-watch',
      title: 'Effective date watch',
      description: 'Items with explicit effective-date language or an effective date to verify.',
      matcher: (entry: CoverageDataset['entries'][number]) => entry.tags.includes('effective date') || Boolean(entry.effectiveDate),
    },
    {
      id: 'national-monitor',
      title: 'National monitor',
      description: 'NCD-level updates worth separating from MAC-local workflow noise.',
      matcher: (entry: CoverageDataset['entries'][number]) => entry.source === 'national',
    },
    {
      id: 'retirement-watch',
      title: 'Retirement watch',
      description: 'Retirement, withdrawal, or future-retire signals that can break old references.',
      matcher: (entry: CoverageDataset['entries'][number]) => entry.tags.includes('retirement') || Boolean(entry.retirementDate),
    },
  ]
  const queues = queueDefinitions.map((definition) => {
    const entries = dataset.entries.filter(definition.matcher)
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      count: entries.length,
      highImpact: entries.filter((entry) => entry.impact === 'high').length,
      entries: entries.map((entry) => ({
        recordId: entry.recordId,
        displayId: entry.displayId,
        impact: entry.impact,
        title: entry.title,
        updatedOn: entry.updatedOn,
        effectiveDate: entry.effectiveDate,
        summary: entry.summary,
        detailUrl: entry.detailUrl,
      })),
    }
  })
  const manifest = {
    project: dataset.project,
    generatedAt: dataset.generatedAt,
    cmsApiVersion: dataset.cmsApiVersion,
    updatePeriod: dataset.updatePeriod,
    stats: dataset.stats,
    artifacts: {
      latest: 'data/latest.json',
      feed: 'data/feed.json',
      highImpact: 'data/high-impact.json',
      contractors: 'data/contractors.json',
      queues: 'data/queues.json',
      csv: 'data/feed.csv',
      ndjson: 'data/feed.ndjson',
      markdownBrief: 'briefs/latest.md',
      htmlBrief: 'briefs/latest.html',
      rss: 'rss.xml',
    },
  }

  const csvRows = [
    [
      'record_id',
      'display_id',
      'document_type',
      'source',
      'impact',
      'impact_score',
      'updated_on',
      'effective_date',
      'contractor',
      'tags',
      'title',
      'summary',
      'cms_url',
    ],
    ...dataset.entries.map((entry) => [
      entry.recordId,
      entry.displayId,
      entry.docType,
      entry.source,
      entry.impact,
      entry.impactScore,
      entry.updatedOn,
      entry.effectiveDate ?? '',
      entry.contractorName ?? '',
      entry.tags.join('; '),
      entry.title,
      entry.summary,
      entry.detailUrl,
    ]),
  ]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')

  const ndjson = dataset.entries.map((entry) => JSON.stringify(entry)).join('\n')

  const markdown = [
    `# ${dataset.brief.title}`,
    '',
    dataset.brief.subtitle,
    '',
    `Generated: ${dataset.generatedAt}`,
    '',
    '## Snapshot',
    ...dataset.brief.bullets.map((bullet) => `- ${bullet}`),
    '',
    ...dataset.brief.sections.flatMap((section) => [
      `## ${section.heading}`,
      ...section.items.map((item) => `- ${item}`),
      '',
    ]),
  ].join('\n')

  const htmlSections = dataset.brief.sections
    .map(
      (section) => `
        <section>
          <h2>${escapeHtml(section.heading)}</h2>
          <ul>
            ${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </section>
      `,
    )
    .join('\n')

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(dataset.brief.title)}</title>
    <style>
      body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #fafafa; color: #0f172a; }
      main { max-width: 880px; margin: 0 auto; padding: 40px 20px 72px; }
      h1, h2 { letter-spacing: -0.02em; }
      .eyebrow { font-family: 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; font-size: 12px; }
      .hero, section { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; box-shadow: 0 24px 48px rgba(15, 23, 42, 0.06); margin-top: 16px; }
      ul { padding-left: 18px; }
      li { margin-top: 10px; line-height: 1.6; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">Coverage Changelog</p>
        <h1>${escapeHtml(dataset.brief.title)}</h1>
        <p>${escapeHtml(dataset.brief.subtitle)}</p>
        <p>Generated: ${escapeHtml(dataset.generatedAt)}</p>
      </section>
      ${htmlSections}
    </main>
  </body>
</html>`

  const rssItems = dataset.entries
    .slice(0, 25)
    .map(
      (entry) => `
    <item>
      <title>${escapeHtml(`${entry.displayId}: ${entry.title}`)}</title>
      <link>${escapeHtml(entry.detailUrl)}</link>
      <guid isPermaLink="false">${escapeHtml(entry.recordId)}</guid>
      <pubDate>${escapeHtml(toRfc822(dataset.generatedAt))}</pubDate>
      <category>${escapeHtml(entry.impact)}</category>
      <description>${escapeHtml(entry.summary)}</description>
    </item>`,
    )
    .join('')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Coverage Changelog</title>
    <link>${publicSiteUrl}</link>
    <description>Free CMS coverage policy updates ranked by likely operational impact.</description>
    <lastBuildDate>${escapeHtml(toRfc822(dataset.generatedAt))}</lastBuildDate>
    <language>en-us</language>${rssItems}
  </channel>
</rss>`

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${publicSiteUrl}</loc>
    <lastmod>${dataset.generatedAt.slice(0, 10)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`

  await writeFile(latestDatasetPath, `${JSON.stringify(dataset, null, 2)}\n`)
  await writeFile(path.join(dataDir, 'feed.json'), `${JSON.stringify(feed, null, 2)}\n`)
  await writeFile(path.join(dataDir, 'high-impact.json'), `${JSON.stringify(highImpactFeed, null, 2)}\n`)
  await writeFile(path.join(dataDir, 'contractors.json'), `${JSON.stringify(contractorFeed, null, 2)}\n`)
  await writeFile(path.join(dataDir, 'queues.json'), `${JSON.stringify(queues, null, 2)}\n`)
  await writeFile(path.join(dataDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(path.join(dataDir, 'feed.csv'), `${csvRows}\n`)
  await writeFile(path.join(dataDir, 'feed.ndjson'), `${ndjson}\n`)
  await writeFile(path.join(briefDir, 'latest.md'), markdown)
  await writeFile(path.join(briefDir, 'latest.html'), html)
  await writeFile(path.join(publicDir, 'rss.xml'), rss)
  await writeFile(path.join(publicDir, 'sitemap.xml'), sitemap)
  await writeFile(path.join(publicDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${publicSiteUrl}sitemap.xml\n`)
  await writeFile(path.join(publicDir, '.nojekyll'), '')
}

async function buildLiveDataset(): Promise<CoverageDataset> {
  const generatedAt = new Date().toISOString()
  const token = await getLicenseToken()
  const [docsSpecVersion, updatePeriodResponse, localResponse, nationalResponse] = await Promise.all([
    getDocsSpecVersion(),
    getUpdatePeriod(token),
    getLocalWhatsNew(),
    getNationalWhatsNew(token),
  ])

  const updatePeriodRecord = updatePeriodResponse.data?.[0]
  if (!updatePeriodRecord) {
    throw new Error('CMS Coverage API did not return an update period.')
  }

  const localReports = localResponse.data ?? []
  const nationalReports = nationalResponse.data ?? []

  const localRecords = await Promise.all(
    localReports.map(async (report) => {
      const filterRevisionVersion = <T extends { lcd_version?: number; article_version?: number }>(
        records: T[],
      ): T[] => {
        const current = records.filter(
          (record) =>
            record.lcd_version === report.document_version ||
            record.article_version === report.document_version,
        )

        return current.length > 0 ? current : records
      }

      const detail: LocalDetailBundle =
        report.document_type === 'LCD'
          ? {
              revisionHistory: filterRevisionVersion(
                await safeData(
                  `${report.document_display_id} LCD revision history`,
                  getLcdRevisionHistory(report.document_id, report.document_version, token),
                ),
              ),
              reasonChanges: filterRevisionVersion(
                await safeData(
                  `${report.document_display_id} LCD reason change`,
                  getLcdReasonChange(report.document_id, report.document_version, token),
                ),
              ),
              synopsisChanges: filterRevisionVersion(
                await safeData(
                  `${report.document_display_id} LCD synopsis changes`,
                  getLcdSynopsisChanges(report.document_id, report.document_version, token),
                ),
              ),
            }
          : {
              revisionHistory: filterRevisionVersion(
                await safeData(
                  `${report.document_display_id} article revision history`,
                  getArticleRevisionHistory(report.document_id, report.document_version, token),
                ),
              ),
              reasonChanges: [],
              synopsisChanges: [],
            }

      return {
        report,
        detail,
      }
    }),
  )

  const updatePeriod: CoverageUpdatePeriod = {
    periodId: updatePeriodRecord.period_id,
    beginDate: updatePeriodRecord.begin_date,
    endDate: updatePeriodRecord.end_date,
    label: formatWindowLabel(updatePeriodRecord.begin_date, updatePeriodRecord.end_date),
  }

  return buildCoverageDataset({
    generatedAt,
    cmsApiVersion: docsSpecVersion ?? updatePeriodResponse.meta?.version ?? 'unknown',
    updatePeriod,
    localRecords,
    nationalRecords: nationalReports,
  })
}

async function main(): Promise<void> {
  try {
    const dataset = await buildLiveDataset()
    await writeArtifacts(dataset)
    console.log(`Coverage Changelog dataset written with ${dataset.entries.length} entries.`)
  } catch (error) {
    const existing = await loadExistingDataset()
    if (!existing) {
      throw error
    }

    await writeArtifacts(existing)
    console.warn('Live CMS refresh failed, reused existing dataset instead.')
    console.warn(error)
  }
}

void main()
