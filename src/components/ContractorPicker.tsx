import { Radio } from 'lucide-react'
import type { ContractorIndex, ContractorIndexEntry } from '../lib/types'

interface ContractorPickerProps {
  index: ContractorIndex | null
  selectedSlug: string
  onSelect: (slug: string) => void
}

export function ContractorPicker({ index, selectedSlug, onSelect }: ContractorPickerProps) {
  const contractors = index?.contractors ?? []

  if (contractors.length === 0) {
    return (
      <p className="quiet-note">
        Contractor index is generating. Refresh after the next build.
      </p>
    )
  }

  return (
    <div className="contractor-picker" role="radiogroup" aria-label="Contractor">
      <label className="contractor-picker-select">
        <Radio aria-hidden="true" />
        <select
          value={selectedSlug}
          onChange={(event) => onSelect(event.target.value)}
          aria-label="Select contractor"
        >
          <option value="">All contractors</option>
          {contractors.map((contractor) => (
            <option key={contractor.slug} value={contractor.slug}>
              {contractor.shortName} · {contractor.count}
            </option>
          ))}
        </select>
      </label>
      <div className="contractor-picker-chips">
        {contractors.map((contractor) => (
          <ContractorChip
            key={contractor.slug}
            contractor={contractor}
            active={contractor.slug === selectedSlug}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

interface ContractorChipProps {
  contractor: ContractorIndexEntry
  active: boolean
  onSelect: (slug: string) => void
}

function ContractorChip({ contractor, active, onSelect }: ContractorChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={`contractor-chip ${active ? 'active' : ''}`.trim()}
      onClick={() => onSelect(contractor.slug)}
    >
      <span className="contractor-chip-name">{contractor.shortName}</span>
      <span className="contractor-chip-count">
        {contractor.count}
        {contractor.highImpact > 0 ? <em>· {contractor.highImpact} high</em> : null}
      </span>
    </button>
  )
}
