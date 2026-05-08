import { slugify } from '../lib/slugify'

export interface ContractorMeta {
  slug: string
  shortName: string
  longName: string
  jurisdictions: string[]
}

const KNOWN_CONTRACTORS: ContractorMeta[] = [
  {
    slug: 'cgs-administrators',
    shortName: 'CGS Administrators',
    longName: 'CGS Administrators, LLC',
    jurisdictions: ['J15'],
  },
  {
    slug: 'noridian-healthcare-solutions',
    shortName: 'Noridian Healthcare Solutions',
    longName: 'Noridian Healthcare Solutions, LLC',
    jurisdictions: ['JE', 'JF'],
  },
  {
    slug: 'palmetto-gba',
    shortName: 'Palmetto GBA',
    longName: 'Palmetto GBA',
    jurisdictions: ['JJ', 'JM'],
  },
  {
    slug: 'wps-insurance-corporation',
    shortName: 'WPS',
    longName: 'WPS Insurance Corporation',
    jurisdictions: ['J5', 'J8'],
  },
  {
    slug: 'national-government-services',
    shortName: 'National Government Services',
    longName: 'National Government Services, Inc.',
    jurisdictions: ['JK', 'J6'],
  },
  {
    slug: 'first-coast-service-options',
    shortName: 'First Coast Service Options',
    longName: 'First Coast Service Options, Inc.',
    jurisdictions: ['JN'],
  },
  {
    slug: 'novitas-solutions',
    shortName: 'Novitas Solutions',
    longName: 'Novitas Solutions, Inc.',
    jurisdictions: ['JH', 'JL'],
  },
]

const NATIONAL_META: ContractorMeta = {
  slug: 'national-coverage',
  shortName: 'National coverage',
  longName: 'National coverage (CMS)',
  jurisdictions: ['NCD'],
}

export function resolveContractorMeta(rawName: string | undefined | null): ContractorMeta {
  if (!rawName || rawName === 'National coverage') {
    return NATIONAL_META
  }

  const lower = rawName.toLowerCase()
  const known = KNOWN_CONTRACTORS.find((meta) => lower.includes(meta.longName.toLowerCase()))
  if (known) {
    return known
  }

  return {
    slug: slugify(rawName),
    shortName: rawName.split(' (')[0] ?? rawName,
    longName: rawName,
    jurisdictions: [],
  }
}

export function getNationalContractorSlug(): string {
  return NATIONAL_META.slug
}
