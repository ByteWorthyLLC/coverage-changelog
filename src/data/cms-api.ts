const CMS_API_BASE_URL = 'https://api.coverage.cms.gov'
const CMS_API_DOCS_SPEC_URL = 'https://api.coverage.cms.gov/docs/v1/coverage-api.json'
const USER_AGENT = 'coverage-changelog/0.1'

export interface CmsLicenseAgreementResponse {
  data?: Array<{
    Token?: string
  }>
}

export interface CmsUpdatePeriodRecord {
  period_id: number
  begin_date: string
  end_date: string
}

export interface CmsUpdatePeriodResponse {
  meta?: {
    version?: string
  }
  data?: CmsUpdatePeriodRecord[]
}

export interface CmsLocalReportRecord {
  document_id: number
  document_version: number
  document_display_id: string
  document_type: 'LCD' | 'Article'
  note: string
  title: string
  contractor_name_type: string
  updated_on: string
  updated_on_sort: string
  effective_date: string
  retirement_date: string
  url: string
}

export interface CmsNationalWhatsNewRecord {
  document_id: number
  document_version: number
  document_display_id: string
  document_status: string
  last_updated: string
  last_updated_sort: string
  document_type: 'NCD'
  title: string
  whats_new_description: string
  url: string
}

export interface CmsRevisionHistoryRecord {
  lcd_version?: number
  article_version?: number
  rev_hist_exp?: string
  rev_hist_date?: string
  last_updated?: string
}

export interface CmsReasonChangeRecord {
  lcd_version?: number
  description?: string
  last_updated?: string
}

export interface CmsCollectionResponse<T> {
  meta?: {
    version?: string
  }
  data?: T[]
}

interface CmsApiSpecResponse {
  info?: {
    version?: string
  }
}

interface RequestOptions {
  token?: string
}

async function fetchJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${CMS_API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
  })

  if (!response.ok) {
    throw new Error(`CMS Coverage API request failed: ${response.status} ${path}`)
  }

  return (await response.json()) as T
}

export async function getLicenseToken(): Promise<string> {
  const response = await fetchJson<CmsLicenseAgreementResponse>('/v1/metadata/license-agreement/')
  const token = response.data?.[0]?.Token

  if (!token) {
    throw new Error('CMS Coverage API token response did not include a token.')
  }

  return token
}

export async function getUpdatePeriod(token: string): Promise<CmsCollectionResponse<CmsUpdatePeriodRecord>> {
  return fetchJson<CmsCollectionResponse<CmsUpdatePeriodRecord>>('/v1/metadata/update-period/', { token })
}

export async function getLocalWhatsNew(): Promise<CmsCollectionResponse<CmsLocalReportRecord>> {
  return fetchJson<CmsCollectionResponse<CmsLocalReportRecord>>('/v1/reports/whats-new/local/')
}

export async function getNationalWhatsNew(
  token: string,
): Promise<CmsCollectionResponse<CmsNationalWhatsNewRecord>> {
  return fetchJson<CmsCollectionResponse<CmsNationalWhatsNewRecord>>('/v1/reports/whats-new/national/', {
    token,
  })
}

export async function getLcdRevisionHistory(
  lcdId: number,
  version: number,
  token: string,
): Promise<CmsCollectionResponse<CmsRevisionHistoryRecord>> {
  return fetchJson<CmsCollectionResponse<CmsRevisionHistoryRecord>>(
    `/v1/data/lcd/revision-history?lcdid=${lcdId}&ver=${version}`,
    { token },
  )
}

export async function getLcdReasonChange(
  lcdId: number,
  version: number,
  token: string,
): Promise<CmsCollectionResponse<CmsReasonChangeRecord>> {
  return fetchJson<CmsCollectionResponse<CmsReasonChangeRecord>>(
    `/v1/data/lcd/reason-change?lcdid=${lcdId}&ver=${version}`,
    { token },
  )
}

export async function getLcdSynopsisChanges(
  lcdId: number,
  version: number,
  token: string,
): Promise<CmsCollectionResponse<CmsRevisionHistoryRecord>> {
  return fetchJson<CmsCollectionResponse<CmsRevisionHistoryRecord>>(
    `/v1/data/lcd/synopsis-changes?lcdid=${lcdId}&ver=${version}`,
    { token },
  )
}

export async function getArticleRevisionHistory(
  articleId: number,
  version: number,
  token: string,
): Promise<CmsCollectionResponse<CmsRevisionHistoryRecord>> {
  return fetchJson<CmsCollectionResponse<CmsRevisionHistoryRecord>>(
    `/v1/data/article/revision-history?articleid=${articleId}&ver=${version}`,
    { token },
  )
}

export async function getDocsSpecVersion(): Promise<string | undefined> {
  const response = await fetch(CMS_API_DOCS_SPEC_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  })

  if (!response.ok) {
    return undefined
  }

  const spec = (await response.json()) as CmsApiSpecResponse
  return spec.info?.version
}
