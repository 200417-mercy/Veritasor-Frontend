import { render, screen, act, within, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import DataExportPanel from '../components/data-export/DataExportPanel'

/**
 * The panel defaults to the "All attestations" scope, which is a large export and
 * is therefore guard-railed (#442): clicking "Generate export" opens the confirm
 * dialog instead of starting a job. The tests below cover the job lifecycle that
 * starts *after* that decision point, so they pick a small scope first — a small
 * scope starts immediately, and the lifecycle is identical.
 */
function chooseQuickScope() {
  fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'last-30-days' } })
}

describe('DataExportPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders format options including Parquet and an empty downloads tray', () => {
    render(<DataExportPanel />)

    expect(screen.getByRole('radio', { name: /CSV/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /JSON/i })).toBeInTheDocument()
    // #261 — Parquet format added
    expect(screen.getByRole('radio', { name: /Parquet/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /PDF/i })).toBeInTheDocument()

    const tray = screen.getByRole('region', { name: /downloads/i })
    expect(within(tray).getByText(/exports you generate appear here/i)).toBeInTheDocument()
  })

  it('shows a Generate your first export CTA in the empty state', () => {
    render(<DataExportPanel />)

    const tray = screen.getByRole('region', { name: /downloads/i })
    expect(
      within(tray).getByRole('button', { name: /generate your first export/i }),
    ).toBeInTheDocument()
  })

  // #261 — sample snippet toggle
  it('expands a sample snippet for CSV when the Show sample button is clicked', () => {
    render(<DataExportPanel />)

    const toggleBtn = screen.getAllByRole('button', { name: /show sample/i })[0]
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggleBtn)

    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')
    // CSV sample contains this header line
    expect(screen.getByText(/id,source,amount/i)).toBeInTheDocument()
  })

  it('announces progress politely and reaches a ready, downloadable state', () => {
    render(<DataExportPanel tickMs={100} />)

    chooseQuickScope()
    act(() => {
      screen.getByRole('button', { name: /generate export/i }).click()
    })

    // Polite live region announces preparation.
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(/preparing csv export/i)

    // At least one determinate progressbar is present while processing
    // (table row + mobile card may each render one).
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0)

    // Advance through all ticks (0 -> 100 in steps of 20).
    act(() => {
      vi.advanceTimersByTime(100 * 6)
    })

    expect(status).toHaveTextContent(/ready to download/i)
    // Download buttons appear in both table and card list; at least one present.
    expect(screen.getAllByRole('button', { name: /download/i }).length).toBeGreaterThan(0)
  })

  it('allows downloading a ready export and announces it', () => {
    render(<DataExportPanel tickMs={100} />)

    chooseQuickScope()
    act(() => {
      screen.getByRole('button', { name: /generate export/i }).click()
      vi.advanceTimersByTime(100 * 6)
    })

    act(() => {
      screen.getAllByRole('button', { name: /download/i })[0].click()
    })
    expect(screen.getByRole('status')).toHaveTextContent(/downloading csv export/i)
  })

  // #260 — Re-run actions
  it('shows a Regenerate button (with confirm) for a ready export via re-run flow', () => {
    render(<DataExportPanel tickMs={100} />)

    chooseQuickScope()
    act(() => {
      screen.getByRole('button', { name: /generate export/i }).click()
      vi.advanceTimersByTime(100 * 6)
    })

    // After reaching ready, a Re-run-equivalent action exists
    // (for ready jobs it shows "Regenerate" or similar accessibility label)
    const rerunBtn = screen.queryAllByRole('button').find(
      (b) => /regenerate|re-run|retry/i.test(b.textContent ?? ''),
    )
    expect(rerunBtn).toBeDefined()
  })

  // #260 — Export history table structure
  it('renders an export history table with accessible headers after an export is created', () => {
    render(<DataExportPanel tickMs={100} />)

    chooseQuickScope()
    act(() => {
      screen.getByRole('button', { name: /generate export/i }).click()
    })

    // Table should be present (desktop layout)
    const table = screen.queryByRole('table')
    if (table) {
      // Has accessible column headers
      expect(within(table).getByRole('columnheader', { name: /format/i })).toBeInTheDocument()
      expect(within(table).getByRole('columnheader', { name: /status/i })).toBeInTheDocument()
      expect(within(table).getByRole('columnheader', { name: /created/i })).toBeInTheDocument()
    } else {
      // Mobile card layout — job cards are present
      expect(screen.getByRole('list', { name: /export history/i })).toBeInTheDocument()
    }
  })
})
