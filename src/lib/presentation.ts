import type { CoverageSource, ImpactLevel } from './types'

const humanDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const stampDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function parseLocalDate(value: string): Date | null {
  if (/^\d{8}$/.test(value)) {
    return new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)))
  }

  const slashMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (slashMatch) {
    const [, month, day, year] = slashMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function formatDateLabel(value?: string): string {
  if (!value) {
    return 'Unknown'
  }

  const date = parseLocalDate(value)
  if (!date) {
    return value
  }

  return humanDate.format(date)
}

export function formatStamp(value: string): string {
  const date =
    /^\d{14}$/.test(value)
      ? new Date(
          Number(value.slice(0, 4)),
          Number(value.slice(4, 6)) - 1,
          Number(value.slice(6, 8)),
          Number(value.slice(8, 10)),
          Number(value.slice(10, 12)),
          Number(value.slice(12, 14)),
        )
      : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return stampDate.format(date)
}

export function formatRelativeWindow(beginDate: string, endDate: string): string {
  return `${formatDateLabel(beginDate)} to ${formatDateLabel(endDate)}`
}

export function formatImpactLabel(level: ImpactLevel): string {
  return `${level} impact`
}

export function formatSourceLabel(source: CoverageSource): string {
  return source === 'local' ? 'local coverage' : 'national coverage'
}
