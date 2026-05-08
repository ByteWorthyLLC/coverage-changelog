import he from 'he'
import type {
  CmsLocalReportRecord,
  CmsNationalWhatsNewRecord,
  CmsReasonChangeRecord,
  CmsRevisionHistoryRecord,
} from './cms-api'
import type {
  CoverageDataset,
  CoverageEntry,
  CoverageHighlight,
  CoverageUpdatePeriod,
  ImpactLevel,
  MondayBriefSection,
} from '../lib/types'

export interface LocalDetailBundle {
  revisionHistory: CmsRevisionHistoryRecord[]
  reasonChanges: CmsReasonChangeRecord[]
  synopsisChanges: CmsRevisionHistoryRecord[]
}

export interface BuildDatasetInput {
  generatedAt: string
  cmsApiVersion: string
  updatePeriod: CoverageUpdatePeriod
  localRecords: Array<{
    report: CmsLocalReportRecord
    detail: LocalDetailBundle
  }>
  nationalRecords: CmsNationalWhatsNewRecord[]
}

interface ImpactAnalysis {
  impact: ImpactLevel
  score: number
  tags: string[]
}

const HIGH_PATTERNS = [
  /cpt/i,
  /hcpcs/i,
  /icd-?10/i,
  /revenue code/i,
  /modifier/i,
  /coverage indications?/i,
  /medically reasonable/i,
  /noncovered/i,
  /repeat esi/i,
  /retroactive/i,
]

const MEDIUM_PATTERNS = [
  /effective date/i,
  /change request/i,
  /transmittal/i,
  /coding/i,
  /added/i,
  /deleted/i,
  /revised/i,
  /updated/i,
]

const LOW_PATTERNS = [/bibliography/i, /link/i, /typo/i, /format/i, /corrected/i, /spelling/i]

function cleanCmsText(value?: string | null): string {
  if (!value) {
    return ''
  }

  const decoded = he.decode(he.decode(value))
  return decoded
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&#160;/g, ' ')
    .trim()
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])]
}

function summarizeText(text: string): string {
  if (text.length <= 220) {
    return text
  }

  const trimmed = text.slice(0, 217).trimEnd()
  return `${trimmed}...`
}

function analyzeImpact(textBlocks: string[]): ImpactAnalysis {
  const joined = textBlocks.join(' ').trim()
  const tags = new Set<string>()
  let score = 24

  if (HIGH_PATTERNS.some((pattern) => pattern.test(joined))) {
    score += 58
  }

  if (MEDIUM_PATTERNS.some((pattern) => pattern.test(joined))) {
    score += 24
  }

  if (/(cpt|hcpcs|icd-?10|revenue code|modifier|code update)/i.test(joined)) {
    tags.add('coding')
  }

  if (/(coverage indications?|medically reasonable|noncovered|reasonable and necessary|adl)/i.test(joined)) {
    tags.add('coverage criteria')
  }

  if (/(retroactive|effective date|dates of service)/i.test(joined)) {
    tags.add('effective date')
  }

  if (/(change request|transmittal|operational)/i.test(joined)) {
    tags.add('operations')
  }

  if (/(retire|retirement|future retire|withdraw)/i.test(joined)) {
    tags.add('retirement')
    score += 12
  }

  if (LOW_PATTERNS.some((pattern) => pattern.test(joined)) && score < 60) {
    tags.add('administrative correction')
    score = Math.min(score, 28)
  }

  if (/no policy changes/i.test(joined) && !tags.has('coverage criteria')) {
    tags.add('coding notice')
    score = Math.min(Math.max(score, 44), 56)
  }

  if (tags.size === 0) {
    tags.add('general update')
  }

  if (score >= 78) {
    return {
      impact: 'high',
      score,
      tags: [...tags],
    }
  }

  if (score >= 45) {
    return {
      impact: 'medium',
      score,
      tags: [...tags],
    }
  }

  return {
    impact: 'low',
    score,
    tags: [...tags],
  }
}

function buildNarrative(entry: Pick<CoverageEntry, 'impact' | 'tags' | 'docType' | 'displayId'>): string {
  if (entry.impact === 'high' && entry.tags.includes('coding')) {
    return `${entry.displayId} looks likely to affect coding tables or claim edit logic. Start by checking code sets, charge capture, and any payer-specific routing around this document.`
  }

  if (entry.impact === 'high' && entry.tags.includes('coverage criteria')) {
    return `${entry.displayId} appears to change the rule itself, not just the packaging. Confirm intake language, medical-necessity guidance, and prior authorization playbooks against this revision.`
  }

  if (entry.impact === 'medium') {
    return `${entry.displayId} looks operationally relevant but not obviously catastrophic. It is worth a Monday pass for SOP updates, coding references, and any templates linked to this ${entry.docType}.`
  }

  return `${entry.displayId} reads like a lower-urgency documentation or reference change. Good to log, but probably not the first issue to escalate unless local workflows depend on the corrected text.`
}

function buildLocalEntry(report: CmsLocalReportRecord, detail: LocalDetailBundle): CoverageEntry {
  const revisionNotes = detail.revisionHistory.map((item) => cleanCmsText(item.rev_hist_exp))
  const synopsisNotes = detail.synopsisChanges.map((item) => cleanCmsText(item.rev_hist_exp))
  const reasonNotes = detail.reasonChanges.map((item) => cleanCmsText(item.description))
  const changedText = uniqueStrings([...revisionNotes, ...synopsisNotes].filter(Boolean))
  const reasons = uniqueStrings(reasonNotes.filter(Boolean))
  const combinedText = changedText.length > 0 ? changedText : reasons
  const impactAnalysis = analyzeImpact([...combinedText, report.note].filter(Boolean))
  const highlight = summarizeText(combinedText[0] ?? reasons[0] ?? report.title)
  const summary =
    impactAnalysis.impact === 'high'
      ? `High-signal revision from CMS notes: ${highlight}`
      : impactAnalysis.impact === 'medium'
        ? `Meaningful policy or coding update detected: ${highlight}`
        : `Lower-urgency correction or cleanup: ${highlight}`

  const contractorName = report.contractor_name_type.replace(/\s+/g, ' ').trim()
  const entry: CoverageEntry = {
    recordId: `${report.document_display_id}-v${report.document_version}`,
    source: 'local',
    docType: report.document_type,
    displayId: report.document_display_id,
    version: report.document_version,
    title: report.title,
    contractorName,
    updatedOn: report.updated_on,
    updatedSort: report.updated_on_sort,
    effectiveDate: report.effective_date === 'N/A' ? undefined : report.effective_date,
    retirementDate: report.retirement_date === 'N/A' ? undefined : report.retirement_date,
    detailUrl: report.url,
    summary,
    narrative: '',
    reasons,
    changedText,
    tags: impactAnalysis.tags,
    impact: impactAnalysis.impact,
    impactScore: impactAnalysis.score,
    highlight,
  }

  return {
    ...entry,
    narrative: buildNarrative(entry),
  }
}

function buildNationalEntry(report: CmsNationalWhatsNewRecord): CoverageEntry {
  const changedText = uniqueStrings([cleanCmsText(report.whats_new_description)])
  const impactAnalysis = analyzeImpact(changedText)
  const summary =
    changedText[0] ?? `National coverage update published for ${report.document_display_id}.`

  const entry: CoverageEntry = {
    recordId: `${report.document_display_id}-v${report.document_version}`,
    source: 'national',
    docType: report.document_type,
    displayId: report.document_display_id,
    version: report.document_version,
    title: report.title,
    updatedOn: report.last_updated,
    updatedSort: report.last_updated_sort,
    detailUrl: `https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=${report.document_id}&ncdver=${report.document_version}`,
    summary,
    narrative: '',
    reasons: [],
    changedText,
    tags: impactAnalysis.tags,
    impact: impactAnalysis.impact,
    impactScore: impactAnalysis.score,
    highlight: summarizeText(summary),
  }

  return {
    ...entry,
    narrative: buildNarrative(entry),
  }
}

function buildHighlights(entries: CoverageEntry[]): CoverageHighlight[] {
  return entries.slice(0, 3).map((entry) => ({
    recordId: entry.recordId,
    title: `${entry.displayId} · ${entry.title}`,
    quote: entry.highlight,
    impact: entry.impact,
    detailUrl: entry.detailUrl,
    updatedOn: entry.updatedOn,
  }))
}

function buildBriefSections(entries: CoverageEntry[]): MondayBriefSection[] {
  const highImpact = entries.filter((entry) => entry.impact === 'high').slice(0, 4)
  const mondayChecks = entries.slice(0, 4).map((entry) => {
    const tagSummary = entry.tags.slice(0, 2).join(', ')
    return `${entry.displayId}: ${entry.highlight}${tagSummary ? ` (${tagSummary})` : ''}`
  })
  const quietFixes = entries
    .filter((entry) => entry.impact === 'low')
    .slice(0, 3)
    .map((entry) => `${entry.displayId}: ${entry.highlight}`)

  return [
    {
      heading: 'Monday checks',
      items: mondayChecks,
    },
    {
      heading: 'High-impact moves',
      items: highImpact.map((entry) => `${entry.displayId}: ${entry.summary}`),
    },
    {
      heading: 'Quiet corrections',
      items: quietFixes.length > 0 ? quietFixes : ['No obvious low-impact administrative corrections this window.'],
    },
  ]
}

export function buildCoverageDataset(input: BuildDatasetInput): CoverageDataset {
  const localEntries = input.localRecords.map(({ report, detail }) => buildLocalEntry(report, detail))
  const nationalEntries = input.nationalRecords.map((report) => buildNationalEntry(report))
  const entries = [...localEntries, ...nationalEntries].sort((left, right) => {
    if (right.impactScore !== left.impactScore) {
      return right.impactScore - left.impactScore
    }

    return right.updatedSort.localeCompare(left.updatedSort)
  })

  const contractorCount = new Set(entries.map((entry) => entry.contractorName).filter(Boolean)).size
  const sections = buildBriefSections(entries)
  const bullets = sections[0]?.items.slice(0, 3) ?? []

  return {
    project: 'Coverage Changelog',
    generatedAt: input.generatedAt,
    cmsApiVersion: input.cmsApiVersion,
    updatePeriod: input.updatePeriod,
    stats: {
      total: entries.length,
      local: localEntries.length,
      national: nationalEntries.length,
      highImpact: entries.filter((entry) => entry.impact === 'high').length,
      codingChanges: entries.filter((entry) => entry.tags.includes('coding')).length,
      coverageChanges: entries.filter((entry) => entry.tags.includes('coverage criteria')).length,
      contractors: contractorCount,
    },
    highlights: buildHighlights(entries),
    entries,
    brief: {
      title: 'Coverage Changelog Monday Brief',
      subtitle: `${input.updatePeriod.label} · ${entries.length} tracked updates`,
      generatedAt: input.generatedAt,
      markdownPath: '/briefs/latest.md',
      htmlPath: '/briefs/latest.html',
      bullets,
      sections,
    },
  }
}
