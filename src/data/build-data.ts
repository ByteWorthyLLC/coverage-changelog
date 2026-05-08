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

async function loadExistingDataset(): Promise<CoverageDataset | null> {
  try {
    const raw = await readFile(latestDatasetPath, 'utf8')
    return JSON.parse(raw) as CoverageDataset
  } catch {
    return null
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
      body { margin: 0; font-family: 'IBM Plex Sans', system-ui, sans-serif; background: #f7f2e8; color: #173741; }
      main { max-width: 880px; margin: 0 auto; padding: 40px 20px 72px; }
      h1, h2 { font-family: 'Georgia', serif; }
      .eyebrow { font-family: 'IBM Plex Mono', ui-monospace, monospace; letter-spacing: 0.16em; text-transform: uppercase; color: #35555e; font-size: 12px; }
      .hero, section { background: rgba(255,255,255,0.72); border: 1px solid rgba(20,55,64,0.14); border-radius: 22px; padding: 24px; box-shadow: 0 14px 36px rgba(54,44,31,0.08); margin-top: 16px; }
      ul { padding-left: 18px; }
      li { margin-top: 10px; line-height: 1.6; }
      a { color: #8b461c; }
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

  await writeFile(latestDatasetPath, `${JSON.stringify(dataset, null, 2)}\n`)
  await writeFile(path.join(dataDir, 'feed.json'), `${JSON.stringify(feed, null, 2)}\n`)
  await writeFile(path.join(briefDir, 'latest.md'), markdown)
  await writeFile(path.join(briefDir, 'latest.html'), html)
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
                (await getLcdRevisionHistory(report.document_id, report.document_version, token)).data ?? [],
              ),
              reasonChanges: filterRevisionVersion(
                (await getLcdReasonChange(report.document_id, report.document_version, token)).data ?? [],
              ),
              synopsisChanges: filterRevisionVersion(
                (await getLcdSynopsisChanges(report.document_id, report.document_version, token)).data ?? [],
              ),
            }
          : {
              revisionHistory: filterRevisionVersion(
                (await getArticleRevisionHistory(report.document_id, report.document_version, token)).data ?? [],
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
