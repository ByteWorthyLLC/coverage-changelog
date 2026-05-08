import { describe, expect, it } from 'vitest'
import { buildCoverageDataset } from './intelligence'

describe('buildCoverageDataset', () => {
  it('marks coding-heavy revisions as high impact', () => {
    const dataset = buildCoverageDataset({
      generatedAt: '2026-05-07T12:00:00.000Z',
      cmsApiVersion: '1.6',
      updatePeriod: {
        periodId: 1,
        beginDate: '20260427',
        endDate: '20260504',
        label: 'Apr 27, 2026 to May 4, 2026',
      },
      localRecords: [
        {
          report: {
            document_id: 58559,
            document_version: 35,
            document_display_id: 'A58559',
            document_type: 'Article',
            note: '',
            title: 'Billing and Coding: Independent Diagnostic Testing Facilities (IDTF)',
            contractor_name_type: 'Palmetto GBA',
            updated_on: '05/01/2026',
            updated_on_sort: '20260501085504',
            effective_date: '01/01/2026',
            retirement_date: 'N/A',
            url: 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid=58559&ver=35',
          },
          detail: {
            revisionHistory: [
              {
                rev_hist_exp:
                  '<p>Under Article Text - Table: CPT/HCPCS Codes added 70471. This revision is due to the 2026 Annual/Q1 CPT/HCPCS Code Update and is retroactive effective for dates of service on or after 1/1/26.</p>',
              },
            ],
            reasonChanges: [],
            synopsisChanges: [],
          },
        },
      ],
      nationalRecords: [],
    })

    expect(dataset.entries[0]?.impact).toBe('high')
    expect(dataset.entries[0]?.tags).toContain('coding')
  })

  it('downgrades bibliography corrections to low impact', () => {
    const dataset = buildCoverageDataset({
      generatedAt: '2026-05-07T12:00:00.000Z',
      cmsApiVersion: '1.6',
      updatePeriod: {
        periodId: 1,
        beginDate: '20260427',
        endDate: '20260504',
        label: 'Apr 27, 2026 to May 4, 2026',
      },
      localRecords: [
        {
          report: {
            document_id: 39036,
            document_version: 23,
            document_display_id: 'L39036',
            document_type: 'LCD',
            note: '',
            title: 'Epidural Steroid Injections for Pain Management',
            contractor_name_type: 'National Government Services, Inc.',
            updated_on: '05/01/2026',
            updated_on_sort: '20260501150329',
            effective_date: '05/07/2026',
            retirement_date: 'N/A',
            url: 'https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=39036&ver=23',
          },
          detail: {
            revisionHistory: [
              {
                rev_hist_exp: '&lt;p&gt;Corrected link for #31 in the bibliography.&lt;/p&gt;',
              },
            ],
            reasonChanges: [
              {
                description: 'Other (Corrected link in Bibliography)',
              },
            ],
            synopsisChanges: [],
          },
        },
      ],
      nationalRecords: [],
    })

    expect(dataset.entries[0]?.impact).toBe('low')
    expect(dataset.entries[0]?.tags).toContain('administrative correction')
  })
})
