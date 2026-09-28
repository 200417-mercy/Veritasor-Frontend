import { render, screen, within, act, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import DataExportPanel, { CsvColumnSelectorModal } from '../components/data-export/DataExportPanel'
import type { ExportScope } from '../components/data-export/exportTypes'

/**
 * Focused behaviour coverage for `src/components/data-export/DataExportPanel.tsx`
 * (issue #624).
 *
 * The module exports two public surfaces and the existing
 * `src/test/data-export.test.tsx` suite only reached the format cards, one
 * export lifecycle and the tray markup. What was never covered is the *decision*
 * side of the panel — the large-export gate, the CSV column/date-range draft that
 * the modal commits back into the panel, the retention contract of a finished
 * job — and the whole `CsvColumnSelectorModal`, which had no test at all.
 *
 * The suites below cover both exports:
 *
 *  * `DataExportPanel`
 *    - defaults: CSV format, "all attestations" scope, the async-delivery warning;
 *    - the large-export gate: generating for the large scope only opens the
 *      confirm dialog, and nothing is queued until it is accepted — dismissing it
 *      (Cancel button, Escape) leaves the tray untouched;
 *    - the confirmed lifecycle: announcement → progress → ready, with the file
 *      size from the scope, the 7-day retention chip and the notified address
 *      echoed back in the completion announcement;
 *    - multi-job behaviour: every export is prepended and settles independently;
 *    - integration with the modal: the committed column/date-range choice is the
 *      one re-seeded when the modal is reopened, and an invalid range can never
 *      reach the panel.
 *  * `CsvColumnSelectorModal`
 *    - it is a draft editor: toggling columns or dates must not push anything to
 *      the parent until **Apply & close** is pressed;
 *    - required columns are pinned: their checkboxes are disabled, cannot be
 *      deselected, and the modal can never reach a zero-column apply;
 *    - the group toggles are a tri-state control (checked / unchecked /
 *      indeterminate);
 *    - the date range is validated both ways — the error is announced through
 *      `role="alert"`, wired to the field with `aria-describedby`, and blocks
 *      Apply — while the live row-count preview falls back to the scope total;
 *    - the row-count preview is exact for a known range (the modal's model is
 *      linear over a 365-day window);
 *    - every dismissal path (Escape, the close button, Cancel, the backdrop) calls
 *      `onClose` exactly once without committing, and a click *inside* the dialog
 *      is not a dismissal.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const ALL_COLUMNS = [
  'id',
  'created_at',
  'provider',
  'gross_amount',
  'net_amount',
  'currency',
  'fee',
  'attestation_id',
  'merkle_root',
  'published_at',
  'status',
  'workspace_id',
  'actor',
  'source_ref',
]
const REQUIRED_COLUMNS = ['id', 'created_at']
const TOTAL_COLUMNS = ALL_COLUMNS.length
const REVENUE_COLUMNS = 5

const generateBtn = () => screen.getByRole('button', { name: 'Generate export' })
const openColumnSelector = () =>
  screen.getByRole('button', { name: 'Choose CSV columns and date range' })
const statusRegion = () => screen.getByRole('status')
const dialog = () => screen.getByRole('dialog')
const checkbox = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement
const applyBtn = () => screen.getByRole('button', { name: 'Apply & close' }) as HTMLButtonElement
const columnCheckboxes = () =>
  screen.getAllByRole('checkbox').filter((el) => !/^Toggle all /.test(el.getAttribute('aria-label') ?? ''))

/** The modal's footer is its own polite live region, so scope the lookup to it. */
const previewText = () => (within(dialog()).getByText(/matching rows?/i).textContent ?? '')

/** Drive the panel to the point where a job is running, without the confirm gate. */
function startQuickExport() {
  fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'last-30-days' } })
  fireEvent.click(generateBtn())
}

afterEach(cleanup)

// ---------------------------------------------------------------------------
// DataExportPanel
// ---------------------------------------------------------------------------

describe('DataExportPanel — defaults and the large-export gate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('starts on CSV with the all-attestations scope and the async-delivery warning', () => {
    render(<DataExportPanel />)

    expect((screen.getByRole('radio', { name: /CSV/i }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Scope') as HTMLSelectElement).value).toBe('all')

    // The large scope is announced up front, before anything is generated.
    const warning = screen.getByRole('alert')
    expect(warning).toHaveTextContent('Large dataset — async delivery')
    expect(warning).toHaveTextContent('50,000+ records')
    expect(warning).toHaveTextContent('5–15 minutes')

    // Empty tray, nothing announced.
    expect(screen.getByText('No exports yet')).toBeInTheDocument()
    expect(statusRegion()).toBeEmptyDOMElement()
  })

  it('offers the CSV column selector for CSV only', () => {
    render(<DataExportPanel />)

    expect(openColumnSelector()).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /JSON/i }))
    expect(screen.queryByRole('button', { name: 'Choose CSV columns and date range' })).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: /CSV/i }))
    expect(openColumnSelector()).toBeInTheDocument()
  })

  it('does not queue the large export until the confirm dialog is accepted', () => {
    render(<DataExportPanel tickMs={10} />)

    fireEvent.click(generateBtn())

    const confirm = dialog()
    expect(confirm).toHaveAccessibleName('Confirm large export')
    expect(confirm).toHaveTextContent('You are about to export')
    expect(confirm).toHaveTextContent('50,000+ records')
    expect(confirm).toHaveTextContent('Check back in the tray below.')

    // The gate is real: no job exists and no announcement was made yet.
    expect(screen.getByText('No exports yet')).toBeInTheDocument()
    expect(statusRegion()).toBeEmptyDOMElement()
  })

  it('leaves the tray untouched when the confirm dialog is cancelled', () => {
    render(<DataExportPanel tickMs={10} />)

    fireEvent.click(generateBtn())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('No exports yet')).toBeInTheDocument()
    expect(statusRegion()).toBeEmptyDOMElement()
  })

  it('leaves the tray untouched when the confirm dialog is dismissed with Escape', () => {
    render(<DataExportPanel tickMs={10} />)

    fireEvent.click(generateBtn())
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('No exports yet')).toBeInTheDocument()
  })

  it('starts a non-large scope immediately, without the confirm dialog', () => {
    render(<DataExportPanel tickMs={100} />)

    fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'last-30-days' } })
    // The async-delivery warning belongs to the large scope only.
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(/4,500 records/)).toBeInTheDocument()

    fireEvent.click(generateBtn())

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(statusRegion()).toHaveTextContent('Preparing CSV export.')

    act(() => {
      vi.advanceTimersByTime(100 * 6)
    })

    expect(screen.getAllByText('2.4 MB').length).toBeGreaterThan(0)
  })
})

describe('DataExportPanel — job lifecycle and retention', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('runs a confirmed large export to ready and surfaces size, retention and the notified address', () => {
    render(<DataExportPanel tickMs={100} />)

    fireEvent.change(screen.getByLabelText(/Email notification/), {
      target: { value: 'ops@example.com' },
    })
    fireEvent.click(generateBtn())

    // The confirmation echoes the address that will be notified.
    expect(dialog()).toHaveTextContent("We'll email ops@example.com when ready.")
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Start export' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(statusRegion()).toHaveTextContent("Preparing CSV export. We'll notify ops@example.com.")

    // Determinate progress, not an indeterminate spinner.
    const bars = screen.getAllByRole('progressbar')
    expect(bars.length).toBeGreaterThan(0)
    expect(bars[0]).toHaveAttribute('aria-valuemin', '0')
    expect(bars[0]).toHaveAttribute('aria-valuemax', '100')
    expect(bars[0]).toHaveAttribute('aria-valuenow', '0')

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute('aria-valuenow', '20')

    act(() => {
      vi.advanceTimersByTime(100 * 5)
    })

    // Ready: the large scope reports its own file size, and the completion
    // announcement repeats the delivery promise made when the job started.
    expect(statusRegion()).toHaveTextContent(
      "CSV export ready to download. We'll send a download link to ops@example.com.",
    )
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0)
    expect(screen.getAllByText('24 MB').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Expires in 7 days').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /^Download CSV export/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Re-run CSV export' }).length).toBeGreaterThan(0)
  })

  it('keeps each job in the tray and settles it independently', () => {
    render(<DataExportPanel tickMs={100} />)

    fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'current-filter' } })
    fireEvent.click(generateBtn())
    fireEvent.click(generateBtn())

    // Table + mobile card layouts each render a bar, so two jobs are visible.
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThanOrEqual(4)
    expect(screen.queryByText('No exports yet')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(100 * 6)
    })

    // Both jobs reached ready — a second export does not disturb the first.
    expect(screen.getAllByText('2.4 MB').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByRole('button', { name: /^Download CSV export/ }).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0)
  })

  it('announces a download of a ready export', () => {
    render(<DataExportPanel tickMs={100} />)

    startQuickExport()
    act(() => {
      vi.advanceTimersByTime(100 * 6)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /^Download CSV export/ })[0])

    expect(statusRegion()).toHaveTextContent('Downloading CSV export.')
  })

  it('moves focus back to the generate button from the empty-state call to action', () => {
    render(<DataExportPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Generate your first export' }))

    expect(generateBtn()).toHaveFocus()
  })
})

describe('DataExportPanel — integration with the CSV column selector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('re-seeds the modal from the choice the user committed', () => {
    render(<DataExportPanel />)

    fireEvent.click(openColumnSelector())
    fireEvent.click(checkbox('Provider'))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-11' } })

    // 10 days of the 365-day model window of 50,000 rows.
    expect(previewText()).toContain('1,370 matching rows')
    expect(previewText()).toContain(`${TOTAL_COLUMNS - 1} columns`)

    fireEvent.click(applyBtn())
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(openColumnSelector())
    expect(checkbox('Provider').checked).toBe(false)
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-01-01')
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('2026-01-11')
  })

  it('never commits an inverted date range back to the panel', () => {
    render(<DataExportPanel />)

    fireEvent.click(openColumnSelector())
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-02-01' } })

    expect(within(dialog()).getByRole('alert')).toHaveTextContent('"To" date must be on or after')
    expect(applyBtn()).toBeDisabled()

    fireEvent.click(applyBtn())
    // Still open — the invalid draft was not applied.
    expect(dialog()).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(openColumnSelector())
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('')
  })
})

// ---------------------------------------------------------------------------
// CsvColumnSelectorModal
// ---------------------------------------------------------------------------

function makeHarness() {
  return {
    onColumnsChange: vi.fn<(cols: string[]) => void>(),
    onDateFromChange: vi.fn<(value: string) => void>(),
    onDateToChange: vi.fn<(value: string) => void>(),
    onClose: vi.fn<() => void>(),
    onApply: vi.fn<(cols: string[], from: string, to: string) => void>(),
  }
}

type Harness = ReturnType<typeof makeHarness>

function renderModal(
  props: {
    scope?: ExportScope
    selectedColumns?: string[]
    dateFrom?: string
    dateTo?: string
  } = {}
): Harness {
  const harness = makeHarness()
  render(
    <CsvColumnSelectorModal
      scope={props.scope ?? 'all'}
      selectedColumns={props.selectedColumns ?? ALL_COLUMNS}
      dateFrom={props.dateFrom ?? ''}
      dateTo={props.dateTo ?? ''}
      {...harness}
    />,
  )
  return harness
}

describe('CsvColumnSelectorModal — rendering and seed state', () => {
  it('renders an accessible modal dialog titled CSV columns & date range', () => {
    renderModal()

    expect(dialog()).toHaveAttribute('aria-modal', 'true')
    expect(dialog()).toHaveAccessibleName('CSV columns & date range')
    expect(screen.getByRole('heading', { name: 'CSV columns & date range' })).toBeInTheDocument()
  })

  it('seeds every choice from its props', () => {
    renderModal({ selectedColumns: ['id', 'created_at', 'provider'], dateFrom: '2026-01-01', dateTo: '2026-02-01' })

    expect(checkbox('Record ID (required)').checked).toBe(true)
    expect(checkbox('Provider').checked).toBe(true)
    expect(checkbox('Currency').checked).toBe(false)
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-01-01')
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('2026-02-01')
    expect(previewText()).toContain('3 columns')
  })

  it('renders every column with the two required ones disabled', () => {
    renderModal()

    expect(columnCheckboxes()).toHaveLength(TOTAL_COLUMNS)
    for (const id of REQUIRED_COLUMNS) {
      const label = id === 'id' ? 'Record ID (required)' : 'Created at (required)'
      expect(checkbox(label)).toBeDisabled()
      expect(checkbox(label).checked).toBe(true)
    }
  })

  it('moves focus into the dialog on mount', () => {
    renderModal()

    expect(dialog()).toHaveFocus()
  })
})

describe('CsvColumnSelectorModal — draft editing versus commit', () => {
  it('stages column edits locally and does not notify the parent', () => {
    const h = renderModal()

    fireEvent.click(checkbox('Provider'))

    expect(checkbox('Provider').checked).toBe(false)
    expect(previewText()).toContain(`${TOTAL_COLUMNS - 1} columns`)
    expect(h.onColumnsChange).not.toHaveBeenCalled()
    expect(h.onApply).not.toHaveBeenCalled()
  })

  it('commits the staged columns and dates through onApply only', () => {
    const h = renderModal()

    fireEvent.click(checkbox('Provider'))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-03-01' } })
    fireEvent.click(applyBtn())

    expect(h.onApply).toHaveBeenCalledTimes(1)
    const [cols, from, to] = h.onApply.mock.calls[0]
    expect(cols).toHaveLength(TOTAL_COLUMNS - 1)
    expect(cols).not.toContain('provider')
    expect(cols).toContain('id')
    expect(from).toBe('2026-01-01')
    expect(to).toBe('2026-03-01')
    expect(h.onColumnsChange).not.toHaveBeenCalled()
  })

  it('commits nothing on a dismissal', () => {
    const h = renderModal()

    fireEvent.click(checkbox('Provider'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(h.onClose).toHaveBeenCalledTimes(1)
    expect(h.onApply).not.toHaveBeenCalled()
    expect(h.onColumnsChange).not.toHaveBeenCalled()
  })

  it('does not push date edits to the parent while drafting', () => {
    const h = renderModal()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } })

    expect(h.onDateFromChange).not.toHaveBeenCalled()
    expect(h.onDateToChange).not.toHaveBeenCalled()
  })
})

describe('CsvColumnSelectorModal — required columns and bulk selection', () => {
  it('refuses to deselect a required column', () => {
    renderModal()

    fireEvent.click(checkbox('Record ID (required)'))

    expect(checkbox('Record ID (required)').checked).toBe(true)
    expect(previewText()).toContain(`${TOTAL_COLUMNS} columns`)
  })

  it('cannot commit an empty column set', () => {
    const h = renderModal({ selectedColumns: [] })

    expect(checkbox('Record ID (required)').checked).toBe(false)
    expect(previewText()).toContain('0 columns')
    expect(applyBtn()).toBeDisabled()

    fireEvent.click(applyBtn())
    expect(h.onApply).not.toHaveBeenCalled()
  })

  it('Select all checks every column, Required only collapses to the pinned pair', () => {
    renderModal({ selectedColumns: [] })

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(columnCheckboxes().every((el) => (el as HTMLInputElement).checked)).toBe(true)
    expect(previewText()).toContain(`${TOTAL_COLUMNS} columns`)

    fireEvent.click(screen.getByRole('button', { name: 'Required only' }))
    expect(previewText()).toContain('2 columns')
    expect(checkbox('Record ID (required)').checked).toBe(true)
    expect(checkbox('Provider').checked).toBe(false)
    expect(applyBtn()).not.toBeDisabled()
  })
})

describe('CsvColumnSelectorModal — group toggles', () => {
  it('toggles only the optional columns of one group', () => {
    renderModal()

    const groupToggle = checkbox('Toggle all Revenue columns')
    expect(groupToggle.checked).toBe(true)

    fireEvent.click(groupToggle)

    expect(checkbox('Provider').checked).toBe(false)
    expect(checkbox('Currency').checked).toBe(false)
    expect(checkbox('Attestation ID').checked).toBe(true)
    expect(checkbox('Record ID (required)').checked).toBe(true)
    expect((groupToggle as HTMLInputElement).indeterminate).toBe(false)
    expect(previewText()).toContain(`${TOTAL_COLUMNS - REVENUE_COLUMNS} columns`)
  })

  it('re-selects the whole group on a second toggle', () => {
    renderModal({ selectedColumns: [] })

    const groupToggle = checkbox('Toggle all Revenue columns')
    fireEvent.click(groupToggle)

    expect(checkbox('Provider').checked).toBe(true)
    expect(checkbox('Processing fee').checked).toBe(true)
    expect(previewText()).toContain(`${REVENUE_COLUMNS} columns`)

    fireEvent.click(groupToggle)
    expect(previewText()).toContain('0 columns')
  })

  it('renders a partially selected group as indeterminate', () => {
    renderModal({ selectedColumns: ['id', 'created_at', 'provider'] })

    const groupToggle = checkbox('Toggle all Revenue columns') as HTMLInputElement
    expect(groupToggle.checked).toBe(false)
    expect(groupToggle.indeterminate).toBe(true)
  })

  it('never marks a group indeterminate when all of its columns are selected', () => {
    renderModal({ selectedColumns: ['id', 'created_at', 'provider'] })

    // Fill the Revenue group completely, then check it is a clean checked state.
    for (const label of ['Gross amount', 'Net amount', 'Currency', 'Processing fee']) {
      fireEvent.click(checkbox(label))
    }

    const groupToggle = checkbox('Toggle all Revenue columns') as HTMLInputElement
    expect(groupToggle.checked).toBe(true)
    expect(groupToggle.indeterminate).toBe(false)
  })
})

describe('CsvColumnSelectorModal — date range validation', () => {
  it('announces an inverted range and blocks Apply', () => {
    renderModal({ dateFrom: '2026-02-10', dateTo: '2026-02-01' })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('"To" date must be on or after the "From" date.')
    expect(screen.getByLabelText('To')).toHaveAttribute('aria-describedby', 'csv-date-error')
    expect(applyBtn()).toBeDisabled()
  })

  it('clears the error once the range is corrected', () => {
    const h = renderModal({ dateFrom: '2026-02-10', dateTo: '2026-02-01' })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-02-10' } })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(applyBtn()).not.toBeDisabled()
    fireEvent.click(applyBtn())
    expect(h.onApply).toHaveBeenCalledWith(
      ALL_COLUMNS,
      '2026-02-10',
      '2026-02-10',
    )
  })

  it('keeps the date fields mutually bounded', () => {
    renderModal({ dateFrom: '2026-01-01', dateTo: '2026-03-01' })

    expect(screen.getByLabelText('From')).toHaveAttribute('max', '2026-03-01')
    expect(screen.getByLabelText('To')).toHaveAttribute('min', '2026-01-01')
  })

  it('allows an open-ended range without an error', () => {
    renderModal({ dateFrom: '', dateTo: '2026-03-01' })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(applyBtn()).not.toBeDisabled()
  })
})

describe('CsvColumnSelectorModal — row count preview', () => {
  it('reports the scope total when no range is chosen', () => {
    renderModal({ scope: 'all' })
    expect(previewText()).toContain('50,000 matching rows')

    cleanup()
    renderModal({ scope: 'current-filter' })
    expect(previewText()).toContain('200 matching rows')
  })

  it('scales the estimate with the selected range', () => {
    // One day out of the 365-day model window: 50,000 * (1 / 365) = 136.99 -> 137.
    renderModal({ dateFrom: '2026-01-01', dateTo: '2026-01-02' })

    expect(previewText()).toContain(`${(137).toLocaleString()} matching rows`)
  })

  it('falls back to the scope total when the range is inverted', () => {
    renderModal({ dateFrom: '2026-02-10', dateTo: '2026-02-01' })

    expect(previewText()).toContain('50,000 matching rows')
  })
})

describe('CsvColumnSelectorModal — dismissal paths', () => {
  it('closes on Escape', () => {
    const h = renderModal()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(h.onClose).toHaveBeenCalledTimes(1)
  })

  it('closes from the header close button', () => {
    const h = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Close column selector' }))

    expect(h.onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the backdrop is clicked but not when the dialog is clicked', () => {
    const h = renderModal()
    const backdrop = dialog().parentElement as HTMLElement

    fireEvent.click(dialog())
    expect(h.onClose).not.toHaveBeenCalled()

    fireEvent.click(backdrop)
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })
})
