export type ImpactLevel = 'low' | 'medium' | 'high'
export type CoverageSource = 'local' | 'national'
export type CoverageDocumentType = 'LCD' | 'Article' | 'NCD'

export interface CoverageUpdatePeriod {
  periodId: number
  beginDate: string
  endDate: string
  label: string
}

export interface CoverageEntry {
  recordId: string
  source: CoverageSource
  docType: CoverageDocumentType
  displayId: string
  version: number
  title: string
  contractorName?: string
  updatedOn: string
  updatedSort: string
  effectiveDate?: string
  retirementDate?: string
  detailUrl: string
  summary: string
  narrative: string
  reasons: string[]
  changedText: string[]
  tags: string[]
  impact: ImpactLevel
  impactScore: number
  highlight: string
}

export interface CoverageHighlight {
  recordId: string
  title: string
  quote: string
  impact: ImpactLevel
  detailUrl: string
  updatedOn: string
}

export interface CoverageStats {
  total: number
  local: number
  national: number
  highImpact: number
  codingChanges: number
  coverageChanges: number
  contractors: number
}

export interface MondayBriefSection {
  heading: string
  items: string[]
}

export interface MondayBrief {
  title: string
  subtitle: string
  generatedAt: string
  markdownPath: string
  htmlPath: string
  bullets: string[]
  sections: MondayBriefSection[]
}

export interface CoverageDataset {
  project: string
  generatedAt: string
  cmsApiVersion: string
  updatePeriod: CoverageUpdatePeriod
  stats: CoverageStats
  highlights: CoverageHighlight[]
  entries: CoverageEntry[]
  brief: MondayBrief
}
