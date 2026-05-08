import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import he from 'he'
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
import { resolveContractorMeta } from './contractors'
import type { CoverageDataset, CoverageEntry, CoverageUpdatePeriod } from '../lib/types'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const publicDir = path.join(projectRoot, 'public')
const dataDir = path.join(publicDir, 'data')
const contractorsDataDir = path.join(dataDir, 'contractors')
const briefDir = path.join(publicDir, 'briefs')
const feedsDir = path.join(publicDir, 'feeds')
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
  return he.encode(value, { useNamedReferences: false })
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

interface BriefRenderInput {
  title: string
  subtitle: string
  generatedAt: string
  windowLabel: string
  sections: Array<{ heading: string; items: string[] }>
  bullets: string[]
  publicUrl: string
}

function renderBriefHtml(input: BriefRenderInput): string {
  const { title, subtitle, generatedAt, windowLabel, sections, bullets, publicUrl } = input

  const sectionMarkup = sections
    .map(
      (section) => `
        <tr>
          <td style="padding:24px 24px 4px 24px;">
            <h2 style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;font-size:18px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">
              ${escapeHtml(section.heading)}
            </h2>
            <ul style="margin:0;padding:0 0 12px 18px;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;font-size:15px;line-height:1.6;">
              ${section.items
                .map((item) => `<li style="margin:0 0 8px 0;">${escapeHtml(item)}</li>`)
                .join('')}
            </ul>
          </td>
        </tr>`,
    )
    .join('\n')

  const bulletsMarkup = bullets.length
    ? `
        <tr>
          <td style="padding:0 24px 12px 24px;">
            <p style="margin:0 0 8px 0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Snapshot</p>
            <ul style="margin:0;padding:0 0 12px 18px;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;font-size:15px;line-height:1.6;">
              ${bullets.map((bullet) => `<li style="margin:0 0 6px 0;">${escapeHtml(bullet)}</li>`).join('')}
            </ul>
          </td>
        </tr>`
    : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#fafafa;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;">
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <p style="margin:0 0 8px 0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Coverage Changelog</p>
                <h1 style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;font-size:24px;font-weight:600;color:#0f172a;letter-spacing:-0.02em;">
                  ${escapeHtml(title)}
                </h1>
                <p style="margin:0 0 4px 0;color:#475569;font-size:15px;line-height:1.5;">${escapeHtml(subtitle)}</p>
                <p style="margin:0;color:#64748b;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;">
                  Window: ${escapeHtml(windowLabel)}
                </p>
              </td>
            </tr>
            ${bulletsMarkup}
            ${sectionMarkup}
            <tr>
              <td style="padding:16px 24px 24px 24px;border-top:1px solid #e5e7eb;">
                <p style="margin:0 0 8px 0;color:#475569;font-size:13px;line-height:1.5;">
                  Source: <a href="${escapeHtml(publicUrl)}" style="color:#2563eb;text-decoration:none;">byteworthyllc.github.io/coverage-changelog</a>
                </p>
                <p style="margin:0;color:#94a3b8;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;">
                  Generated ${escapeHtml(generatedAt)} &middot; Public CMS data only &middot; No PHI
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

interface RssRenderInput {
  title: string
  description: string
  link: string
  lastBuildDate: string
  entries: CoverageEntry[]
}

function renderRssFeed(input: RssRenderInput): string {
  const { title, description, link, lastBuildDate, entries } = input
  const items = entries
    .map(
      (entry) => `
    <item>
      <title>${escapeHtml(`${entry.displayId}: ${entry.title}`)}</title>
      <link>${escapeHtml(entry.detailUrl)}</link>
      <guid isPermaLink="false">${escapeHtml(entry.recordId)}</guid>
      <pubDate>${escapeHtml(toRfc822(lastBuildDate))}</pubDate>
      <category>${escapeHtml(entry.impact)}</category>
      <description>${escapeHtml(entry.summary)}</description>
    </item>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(title)}</title>
    <link>${escapeHtml(link)}</link>
    <description>${escapeHtml(description)}</description>
    <lastBuildDate>${escapeHtml(toRfc822(lastBuildDate))}</lastBuildDate>
    <language>en-us</language>${items}
  </channel>
</rss>`
}

interface OgRenderInput {
  total: number
  highImpact: number
  contractors: number
  windowLabel: string
}

function renderOgImage(input: OgRenderInput): string {
  const { total, highImpact, contractors, windowLabel } = input
  const dotMatrix = Array.from({ length: 26 }, (_, row) =>
    Array.from({ length: 50 }, (_, col) => `<circle cx="${24 + col * 24}" cy="${24 + row * 24}" r="1.2" fill="#E5E7EB" />`).join(''),
  ).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Coverage Changelog social card">
  <rect width="1200" height="630" fill="#FAFAFA" />
  <g aria-hidden="true">${dotMatrix}</g>
  <g transform="translate(72,80)">
    <text x="0" y="0" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="18" letter-spacing="2" fill="#64748B" font-weight="600">COVERAGE CHANGELOG</text>
    <text x="0" y="84" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="600" fill="#0F172A" letter-spacing="-1.5">CMS coverage changes,</text>
    <text x="0" y="156" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="600" fill="#0F172A" letter-spacing="-1.5">ranked for Monday.</text>
    <text x="0" y="220" font-family="Inter, system-ui, sans-serif" font-size="22" fill="#475569">${escapeHtml(windowLabel)}</text>
  </g>
  <g transform="translate(72,360)">
    <g>
      <rect width="320" height="170" rx="12" fill="#FFFFFF" stroke="#E5E7EB" />
      <text x="24" y="56" font-family="Inter, system-ui, sans-serif" font-size="56" font-weight="700" fill="#0F172A">${total}</text>
      <text x="24" y="92" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="14" letter-spacing="2" fill="#64748B" font-weight="600">UPDATES</text>
      <text x="24" y="138" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#475569">in current window</text>
    </g>
    <g transform="translate(360,0)">
      <rect width="320" height="170" rx="12" fill="#FFFFFF" stroke="#E5E7EB" />
      <text x="24" y="56" font-family="Inter, system-ui, sans-serif" font-size="56" font-weight="700" fill="#2563EB">${highImpact}</text>
      <text x="24" y="92" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="14" letter-spacing="2" fill="#64748B" font-weight="600">HIGH IMPACT</text>
      <text x="24" y="138" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#475569">priority review</text>
    </g>
    <g transform="translate(720,0)">
      <rect width="320" height="170" rx="12" fill="#FFFFFF" stroke="#E5E7EB" />
      <text x="24" y="56" font-family="Inter, system-ui, sans-serif" font-size="56" font-weight="700" fill="#0F172A">${contractors}</text>
      <text x="24" y="92" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="14" letter-spacing="2" fill="#64748B" font-weight="600">CONTRACTORS</text>
      <text x="24" y="138" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#475569">MAC footprints</text>
    </g>
  </g>
  <g transform="translate(72,580)">
    <text font-family="'JetBrains Mono', ui-monospace, monospace" font-size="13" letter-spacing="1.5" fill="#94A3B8">BYTEWORTHYLLC.GITHUB.IO/COVERAGE-CHANGELOG &middot; FREE &middot; OPEN SOURCE &middot; MIT</text>
  </g>
</svg>`
}

function renderEntriesCsv(entries: CoverageEntry[]): string {
  const header = [
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
  ]
  const rows = [
    header,
    ...entries.map((entry) => [
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
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
}

function feedEntryFor(entry: CoverageEntry) {
  return {
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
  }
}

async function writeArtifacts(dataset: CoverageDataset): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  await mkdir(contractorsDataDir, { recursive: true })
  await mkdir(briefDir, { recursive: true })
  await mkdir(feedsDir, { recursive: true })

  const feed = dataset.entries.map(feedEntryFor)
  const highImpactFeed = feed.filter((entry) => entry.impact === 'high')

  const entriesBySlug = dataset.entries.reduce<Record<string, { meta: ReturnType<typeof resolveContractorMeta>; rawNames: Set<string>; entries: CoverageEntry[] }>>((acc, entry) => {
    const rawName = entry.contractorName ?? 'National coverage'
    const meta = resolveContractorMeta(rawName)
    if (!acc[meta.slug]) {
      acc[meta.slug] = { meta, rawNames: new Set(), entries: [] }
    }
    acc[meta.slug].rawNames.add(rawName)
    acc[meta.slug].entries.push(entry)
    return acc
  }, {})

  const contractorSlices = Object.values(entriesBySlug)
    .map((bucket) => {
      const sortedEntries = [...bucket.entries].sort(
        (left, right) => right.impactScore - left.impactScore || right.updatedSort.localeCompare(left.updatedSort),
      )
      return {
        meta: bucket.meta,
        name: bucket.meta.longName,
        rawNames: Array.from(bucket.rawNames).sort(),
        count: sortedEntries.length,
        highImpact: sortedEntries.filter((entry) => entry.impact === 'high').length,
        coding: sortedEntries.filter((entry) => entry.tags.includes('coding')).length,
        criteria: sortedEntries.filter((entry) => entry.tags.includes('coverage criteria')).length,
        retirement: sortedEntries.filter((entry) => entry.tags.includes('retirement')).length,
        entries: sortedEntries,
      }
    })
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))

  const contractorFeed = contractorSlices.map((slice) => ({
    name: slice.name,
    slug: slice.meta.slug,
    shortName: slice.meta.shortName,
    jurisdictions: slice.meta.jurisdictions,
    count: slice.count,
    highImpact: slice.highImpact,
    coding: slice.coding,
    criteria: slice.criteria,
    retirement: slice.retirement,
    feeds: {
      json: `data/contractors/${slice.meta.slug}.json`,
      rss: `feeds/${slice.meta.slug}.rss.xml`,
      csv: `feeds/${slice.meta.slug}.csv`,
      brief: `briefs/${slice.meta.slug}.html`,
    },
    entries: slice.entries.map(feedEntryFor),
  }))

  const contractorIndex = {
    generatedAt: dataset.generatedAt,
    updatePeriod: dataset.updatePeriod,
    contractors: contractorSlices.map((slice) => ({
      slug: slice.meta.slug,
      name: slice.name,
      shortName: slice.meta.shortName,
      jurisdictions: slice.meta.jurisdictions,
      count: slice.count,
      highImpact: slice.highImpact,
    })),
  }
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
      contractorIndex: 'data/contractors/index.json',
      queues: 'data/queues.json',
      csv: 'data/feed.csv',
      ndjson: 'data/feed.ndjson',
      markdownBrief: 'briefs/latest.md',
      htmlBrief: 'briefs/latest.html',
      ogImage: 'og-image.svg',
      rss: 'rss.xml',
    },
    contractors: contractorSlices.map((slice) => ({
      slug: slice.meta.slug,
      shortName: slice.meta.shortName,
      count: slice.count,
      highImpact: slice.highImpact,
    })),
  }

  const csvRows = renderEntriesCsv(dataset.entries)

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

  const html = renderBriefHtml({
    title: dataset.brief.title,
    subtitle: dataset.brief.subtitle,
    generatedAt: dataset.generatedAt,
    windowLabel: dataset.updatePeriod.label,
    sections: dataset.brief.sections,
    bullets: dataset.brief.bullets,
    publicUrl: publicSiteUrl,
  })

  const rss = renderRssFeed({
    title: 'Coverage Changelog',
    description: 'Free CMS coverage policy updates ranked by likely operational impact.',
    link: publicSiteUrl,
    lastBuildDate: dataset.generatedAt,
    entries: dataset.entries.slice(0, 25),
  })

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
  await writeFile(path.join(contractorsDataDir, 'index.json'), `${JSON.stringify(contractorIndex, null, 2)}\n`)
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

  await Promise.all(
    contractorSlices.map(async (slice) => {
      const slug = slice.meta.slug
      const sliceJson = {
        generatedAt: dataset.generatedAt,
        cmsApiVersion: dataset.cmsApiVersion,
        updatePeriod: dataset.updatePeriod,
        contractor: {
          slug,
          name: slice.name,
          shortName: slice.meta.shortName,
          longName: slice.meta.longName,
          jurisdictions: slice.meta.jurisdictions,
        },
        stats: {
          total: slice.count,
          highImpact: slice.highImpact,
          coding: slice.coding,
          criteria: slice.criteria,
          retirement: slice.retirement,
        },
        entries: slice.entries.map(feedEntryFor),
      }

      const sliceRss = renderRssFeed({
        title: `Coverage Changelog · ${slice.meta.shortName}`,
        description: `CMS coverage updates for ${slice.meta.longName}.`,
        link: `${publicSiteUrl}?contractor=${slug}`,
        lastBuildDate: dataset.generatedAt,
        entries: slice.entries.slice(0, 25),
      })

      const sliceCsv = renderEntriesCsv(slice.entries)

      const briefSections = [
        {
          heading: 'High-impact updates',
          items: slice.entries
            .filter((entry) => entry.impact === 'high')
            .slice(0, 5)
            .map((entry) => `${entry.displayId}: ${entry.title} — ${entry.summary}`),
        },
        {
          heading: 'Coding flags',
          items: slice.entries
            .filter((entry) => entry.tags.includes('coding'))
            .slice(0, 5)
            .map((entry) => `${entry.displayId}: ${entry.title}`),
        },
        {
          heading: 'Effective-date watch',
          items: slice.entries
            .filter((entry) => entry.tags.includes('effective date') || Boolean(entry.effectiveDate))
            .slice(0, 5)
            .map((entry) => `${entry.displayId}: effective ${entry.effectiveDate ?? 'TBD'} — ${entry.title}`),
        },
      ].filter((section) => section.items.length > 0)

      const sliceBrief = renderBriefHtml({
        title: `${slice.meta.shortName} coverage update brief`,
        subtitle: `${slice.count} updates this window · ${slice.highImpact} high-impact.`,
        generatedAt: dataset.generatedAt,
        windowLabel: dataset.updatePeriod.label,
        bullets: [
          `${slice.count} updates in window`,
          `${slice.highImpact} high-impact`,
          `${slice.coding} coding-related`,
          `${slice.criteria} coverage-criteria`,
        ],
        sections: briefSections,
        publicUrl: `${publicSiteUrl}?contractor=${slug}`,
      })

      await Promise.all([
        writeFile(path.join(contractorsDataDir, `${slug}.json`), `${JSON.stringify(sliceJson, null, 2)}\n`),
        writeFile(path.join(feedsDir, `${slug}.rss.xml`), sliceRss),
        writeFile(path.join(feedsDir, `${slug}.csv`), `${sliceCsv}\n`),
        writeFile(path.join(briefDir, `${slug}.html`), sliceBrief),
      ])
    }),
  )

  const ogSvg = renderOgImage({
    total: dataset.stats.total,
    highImpact: dataset.stats.highImpact,
    contractors: dataset.stats.contractors,
    windowLabel: dataset.updatePeriod.label,
  })
  await writeFile(path.join(publicDir, 'og-image.svg'), ogSvg)
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
