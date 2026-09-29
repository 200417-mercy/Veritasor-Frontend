/**
 * @file SearchFilter.test.tsx
 * @issue #591 — Add focused behavior coverage for ChipDef
 *
 * Covers:
 *  - ChipDef type contract (id, label, color variants)
 *  - FilterState type contract (all four fields; defaults; URL encoding)
 *  - SearchFilterProps type contract (all props; required vs optional)
 *  - parseFilterState — pure URL → FilterState parsing (success + boundary paths)
 *  - SearchFilter component — rendering, interactions, ARIA, state transitions
 *  - Representative invalid / boundary inputs
 *  - Primary state transitions: search, chip toggle, date range, clear-all,
 *    save-view clipboard, and countdown feedback
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import SearchFilter, {
  parseFilterState,
  type ChipDef,
  type FilterState,
  type SearchFilterProps,
} from './SearchFilter'

afterEach(() => cleanup())

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Renders current URL params into the DOM so tests can assert on them. */
function ParamsDisplay() {
  const [params] = useSearchParams()
  return <div data-testid="params">{params.toString()}</div>
}

const DEFAULT_CHIPS: ChipDef[] = [
  { id: 'verified', label: 'Verified', color: 'success' },
  { id: 'pending',  label: 'Pending',  color: 'warning' },
  { id: 'failed',   label: 'Failed',   color: 'danger'  },
]

function renderFilter(
  props: Partial<SearchFilterProps> = {},
  initialSearch = '',
) {
  return render(
    <MemoryRouter initialEntries={[`/${initialSearch ? `?${initialSearch}` : ''}`]}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <SearchFilter
                resultCount={props.resultCount ?? 6}
                totalCount={props.totalCount ?? 6}
                chips={props.chips ?? DEFAULT_CHIPS}
                placeholder={props.placeholder ?? 'Search…'}
                showDateRange={props.showDateRange ?? false}
                entityLabel={props.entityLabel ?? 'attestation'}
              />
              <ParamsDisplay />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

function currentParams() {
  return screen.getByTestId('params').textContent ?? ''
}

// ─── ChipDef type contract ────────────────────────────────────────────────────

describe('ChipDef — type contract', () => {
  it('renders a chip with only id and label (no color)', () => {
    const chips: ChipDef[] = [{ id: 'minimal', label: 'Minimal' }]
    renderFilter({ chips })
    expect(screen.getByRole('button', { name: 'Minimal' })).toBeInTheDocument()
  })

  it('applies sf-chip-success class for color="success"', () => {
    const chips: ChipDef[] = [{ id: 'ok', label: 'OK', color: 'success' }]
    const { container } = renderFilter({ chips })
    expect(container.querySelector('.sf-chip-success')).toBeInTheDocument()
  })

  it('applies sf-chip-warning class for color="warning"', () => {
    const chips: ChipDef[] = [{ id: 'warn', label: 'Warn', color: 'warning' }]
    const { container } = renderFilter({ chips })
    expect(container.querySelector('.sf-chip-warning')).toBeInTheDocument()
  })

  it('applies sf-chip-danger class for color="danger"', () => {
    const chips: ChipDef[] = [{ id: 'err', label: 'Error', color: 'danger' }]
    const { container } = renderFilter({ chips })
    expect(container.querySelector('.sf-chip-danger')).toBeInTheDocument()
  })

  it('does not apply any color class when color is omitted', () => {
    const chips: ChipDef[] = [{ id: 'plain', label: 'Plain' }]
    const { container } = renderFilter({ chips })
    const chip = container.querySelector('[class*="sf-chip"]')
    expect(chip?.className).not.toMatch(/sf-chip-(success|warning|danger)/)
  })

  it('renders all three color variants simultaneously without conflict', () => {
    const { container } = renderFilter({ chips: DEFAULT_CHIPS })
    expect(container.querySelector('.sf-chip-success')).toBeInTheDocument()
    expect(container.querySelector('.sf-chip-warning')).toBeInTheDocument()
    expect(container.querySelector('.sf-chip-danger')).toBeInTheDocument()
  })

  it('renders many chips without throwing', () => {
    const many: ChipDef[] = Array.from({ length: 20 }, (_, i) => ({
      id: `chip-${i}`,
      label: `Chip ${i}`,
    }))
    expect(() => renderFilter({ chips: many })).not.toThrow()
    expect(screen.getByRole('button', { name: 'Chip 0' })).toBeInTheDocument()
  })

  it('renders an empty chips array showing only the "All" chip', () => {
    renderFilter({ chips: [] })
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verified' })).not.toBeInTheDocument()
  })
})

// ─── FilterState type contract ────────────────────────────────────────────────

describe('FilterState — type contract', () => {
  it('has all four fields: query, activeChips, dateFrom, dateTo', () => {
    const state: FilterState = parseFilterState(new URLSearchParams())
    expect(state).toHaveProperty('query')
    expect(state).toHaveProperty('activeChips')
    expect(state).toHaveProperty('dateFrom')
    expect(state).toHaveProperty('dateTo')
  })

  it('defaults to empty strings and empty array when no params are set', () => {
    const state = parseFilterState(new URLSearchParams())
    expect(state).toEqual<FilterState>({
      query: '',
      activeChips: [],
      dateFrom: '',
      dateTo: '',
    })
  })

  it('activeChips is always an array type (never null/undefined)', () => {
    const state = parseFilterState(new URLSearchParams())
    expect(Array.isArray(state.activeChips)).toBe(true)
  })

  it('activeChips is empty array when status param is an empty string', () => {
    const state = parseFilterState(new URLSearchParams('status='))
    expect(state.activeChips).toEqual([])
  })

  it('parses multiple chip ids from comma-separated status param', () => {
    const state = parseFilterState(new URLSearchParams('status=verified,pending,failed'))
    expect(state.activeChips).toEqual(['verified', 'pending', 'failed'])
  })

  it('parses a single chip id correctly', () => {
    const state = parseFilterState(new URLSearchParams('status=verified'))
    expect(state.activeChips).toEqual(['verified'])
  })

  it('parses dateFrom and dateTo as ISO date strings', () => {
    const state = parseFilterState(new URLSearchParams('from=2026-01-01&to=2026-12-31'))
    expect(state.dateFrom).toBe('2026-01-01')
    expect(state.dateTo).toBe('2026-12-31')
  })
})

// ─── parseFilterState — pure function ────────────────────────────────────────

describe('parseFilterState — URL parsing', () => {
  it('returns empty defaults for new URLSearchParams()', () => {
    expect(parseFilterState(new URLSearchParams())).toEqual({
      query: '',
      activeChips: [],
      dateFrom: '',
      dateTo: '',
    })
  })

  it('parses ?q param into query field', () => {
    expect(parseFilterState(new URLSearchParams('q=hello')).query).toBe('hello')
  })

  it('returns empty query when q is absent', () => {
    expect(parseFilterState(new URLSearchParams('status=verified')).query).toBe('')
  })

  it('filters out empty segments from comma-separated status', () => {
    const state = parseFilterState(new URLSearchParams('status=,verified,,'))
    expect(state.activeChips).not.toContain('')
    expect(state.activeChips).toContain('verified')
  })

  it('handles URL-encoded characters in query value', () => {
    const state = parseFilterState(new URLSearchParams('q=hello%20world'))
    expect(state.query).toBe('hello world')
  })

  it('returns empty dateFrom/dateTo when from/to are absent', () => {
    const state = parseFilterState(new URLSearchParams('q=test'))
    expect(state.dateFrom).toBe('')
    expect(state.dateTo).toBe('')
  })

  it('is a pure function — does not mutate the input URLSearchParams', () => {
    const params = new URLSearchParams('q=test')
    parseFilterState(params)
    expect(params.get('q')).toBe('test')
  })
})

// ─── SearchFilterProps type contract ─────────────────────────────────────────

describe('SearchFilterProps — type contract', () => {
  it('requires resultCount and totalCount; renders without optional props', () => {
    expect(() =>
      render(
        <MemoryRouter>
          <Routes>
            <Route
              path="/"
              element={<SearchFilter resultCount={3} totalCount={10} />}
            />
          </Routes>
        </MemoryRouter>,
      ),
    ).not.toThrow()
  })

  it('uses placeholder prop for the search input label', () => {
    renderFilter({ placeholder: 'Find by hash…' })
    expect(
      screen.getByRole('searchbox', { name: 'Find by hash…' }),
    ).toBeInTheDocument()
  })

  it('defaults placeholder to "Search…" when not provided', () => {
    renderFilter()
    expect(screen.getByRole('searchbox', { name: 'Search…' })).toBeInTheDocument()
  })

  it('uses entityLabel in the result count message', () => {
    renderFilter({ resultCount: 2, totalCount: 5, entityLabel: 'source' })
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 5 sources')
  })

  it('defaults entityLabel to "result" when not provided', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={<SearchFilter resultCount={1} totalCount={1} />}
          />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Showing all 1 results')
  })

  it('showDateRange=false hides the date-range toggle (default)', () => {
    renderFilter({ showDateRange: false })
    expect(
      screen.queryByRole('button', { name: /date range/i }),
    ).not.toBeInTheDocument()
  })

  it('showDateRange=true reveals the date-range toggle', () => {
    renderFilter({ showDateRange: true })
    expect(
      screen.getByRole('button', { name: /date range/i }),
    ).toBeInTheDocument()
  })
})

// ─── SearchFilter — initial render ───────────────────────────────────────────

describe('SearchFilter — initial render', () => {
  it('renders the search input', () => {
    renderFilter()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('renders the All chip', () => {
    renderFilter()
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
  })

  it('All chip is aria-pressed=true when no status filter is active', () => {
    renderFilter()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('status chips are aria-pressed=false on initial render', () => {
    renderFilter()
    for (const chip of DEFAULT_CHIPS) {
      expect(screen.getByRole('button', { name: chip.label })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    }
  })

  it('shows "Showing all N items" when resultCount equals totalCount', () => {
    renderFilter({ resultCount: 6, totalCount: 6 })
    expect(screen.getByRole('status')).toHaveTextContent('Showing all 6 attestations')
  })

  it('shows "Showing X of Y items" when resultCount < totalCount', () => {
    renderFilter({ resultCount: 2, totalCount: 6 })
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 6 attestations')
  })

  it('shows "No Xs" when totalCount is 0', () => {
    renderFilter({ resultCount: 0, totalCount: 0 })
    expect(screen.getByRole('status')).toHaveTextContent('No attestations')
  })

  it('does not show Clear all on initial empty state', () => {
    renderFilter()
    expect(
      screen.queryByRole('button', { name: /clear all/i }),
    ).not.toBeInTheDocument()
  })

  it('does not show the clear-search button when query is empty', () => {
    renderFilter()
    expect(
      screen.queryByRole('button', { name: /clear search/i }),
    ).not.toBeInTheDocument()
  })
})

// ─── SearchFilter — URL state restoration on mount ───────────────────────────

describe('SearchFilter — restores state from URL on mount', () => {
  it('populates search input from ?q param', () => {
    renderFilter({}, 'q=merkle123')
    expect(screen.getByRole('searchbox')).toHaveValue('merkle123')
  })

  it('marks matching chip as pressed when ?status is set', () => {
    renderFilter({}, 'status=verified')
    expect(screen.getByRole('button', { name: 'Verified' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('marks multiple chips as pressed when ?status has multiple values', () => {
    renderFilter({}, 'status=verified,pending')
    expect(screen.getByRole('button', { name: 'Verified' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Pending' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('shows Clear all button when any filter is pre-set in the URL', () => {
    renderFilter({}, 'q=test')
    expect(
      screen.getByRole('button', { name: /clear all/i }),
    ).toBeInTheDocument()
  })
})

// ─── State transition: search input ──────────────────────────────────────────

describe('SearchFilter — search input interactions', () => {
  it('updates ?q URL param as user types', () => {
    renderFilter()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '0x3a7b' } })
    expect(currentParams()).toContain('q=0x3a7b')
  })

  it('shows clear-search button when query is non-empty', () => {
    renderFilter()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'test' } })
    expect(
      screen.getByRole('button', { name: /clear search/i }),
    ).toBeInTheDocument()
  })

  it('clears ?q and input when clear-search button is clicked', () => {
    renderFilter({}, 'q=hello')
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }))
    expect(currentParams()).not.toContain('q=')
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('hides clear-search button after clearing the query', () => {
    renderFilter({}, 'q=hello')
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }))
    expect(
      screen.queryByRole('button', { name: /clear search/i }),
    ).not.toBeInTheDocument()
  })
})

// ─── State transition: chip toggle ───────────────────────────────────────────

describe('SearchFilter — chip toggle interactions', () => {
  it('sets ?status param when a chip is clicked', () => {
    renderFilter()
    fireEvent.click(screen.getByRole('button', { name: 'Verified' }))
    expect(currentParams()).toContain('status=verified')
  })

  it('marks clicked chip as aria-pressed=true', () => {
    renderFilter()
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }))
    expect(screen.getByRole('button', { name: 'Pending' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('accumulates multiple chips comma-separated in ?status', () => {
    renderFilter({}, 'status=verified')
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }))
    const p = currentParams()
    expect(p).toContain('verified')
    expect(p).toContain('pending')
  })

  it('removes a chip from ?status when clicked while active (toggle off)', () => {
    renderFilter({}, 'status=verified,pending')
    fireEvent.click(screen.getByRole('button', { name: 'Verified' }))
    expect(currentParams()).not.toContain('verified')
    expect(currentParams()).toContain('pending')
  })

  it('"All" chip click clears the ?status param', () => {
    renderFilter({}, 'status=verified')
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(currentParams()).not.toContain('status=')
  })

  it('"All" chip becomes aria-pressed=true after clicking it', () => {
    renderFilter({}, 'status=failed')
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('shows Clear all button once any chip is active', () => {
    renderFilter()
    fireEvent.click(screen.getByRole('button', { name: 'Failed' }))
    expect(
      screen.getByRole('button', { name: /clear all/i }),
    ).toBeInTheDocument()
  })
})

// ─── State transition: Clear all ─────────────────────────────────────────────

describe('SearchFilter — Clear all', () => {
  it('removes all URL params', () => {
    renderFilter({}, 'q=test&status=verified')
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(currentParams()).toBe('')
  })

  it('resets search input to empty', () => {
    renderFilter({}, 'q=hello')
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('hides the Clear all button itself after clicking', () => {
    renderFilter({}, 'q=test')
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(
      screen.queryByRole('button', { name: /clear all/i }),
    ).not.toBeInTheDocument()
  })

  it('resets All chip to aria-pressed=true', () => {
    renderFilter({}, 'status=pending')
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

// ─── State transition: date-range panel ──────────────────────────────────────

describe('SearchFilter — date-range panel', () => {
  it('panel is not mounted when showDateRange=false', () => {
    renderFilter({ showDateRange: false })
    expect(screen.queryByLabelText(/from/i)).not.toBeInTheDocument()
  })

  it('panel is collapsed by default when showDateRange=true', () => {
    renderFilter({ showDateRange: true })
    expect(screen.queryByLabelText(/^from$/i)).not.toBeInTheDocument()
  })

  it('panel is revealed after clicking the toggle', () => {
    renderFilter({ showDateRange: true })
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    expect(screen.getByLabelText('From')).toBeInTheDocument()
    expect(screen.getByLabelText('To')).toBeInTheDocument()
  })

  it('toggle has aria-expanded=false when closed', () => {
    renderFilter({ showDateRange: true })
    expect(
      screen.getByRole('button', { name: /date range/i }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggle has aria-expanded=true after opening', () => {
    renderFilter({ showDateRange: true })
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    expect(
      screen.getByRole('button', { name: /date range/i }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('toggle references panel via aria-controls', () => {
    renderFilter({ showDateRange: true })
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    const toggle = screen.getByRole('button', { name: /date range/i })
    const panelId = toggle.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    expect(document.getElementById(panelId!)).toBeInTheDocument()
  })

  it('sets ?from param when From date is changed', () => {
    renderFilter({ showDateRange: true })
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } })
    expect(currentParams()).toContain('from=2026-01-01')
  })

  it('sets ?to param when To date is changed', () => {
    renderFilter({ showDateRange: true })
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-06-30' } })
    expect(currentParams()).toContain('to=2026-06-30')
  })

  it('shows Clear all when a date filter is pre-set in URL', () => {
    renderFilter({ showDateRange: true }, 'from=2026-01-01')
    expect(
      screen.getByRole('button', { name: /clear all/i }),
    ).toBeInTheDocument()
  })

  it('Clear all closes the date-range panel', () => {
    renderFilter({ showDateRange: true }, 'from=2026-01-01')
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    expect(screen.getByLabelText('From')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument()
  })
})

// ─── State transition: Save view clipboard ───────────────────────────────────

describe('SearchFilter — Save view', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => vi.useRealTimers())

  it('copies the current URL to clipboard on click', async () => {
    renderFilter()
    fireEvent.click(screen.getByRole('button', { name: /save current view/i }))
    await act(async () => {})
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('http'),
    )
  })

  it('shows "Copied!" feedback immediately after click', async () => {
    renderFilter()
    fireEvent.click(screen.getByRole('button', { name: /save current view/i }))
    await act(async () => {})
    expect(
      screen.getByRole('button', { name: /link copied/i }),
    ).toBeInTheDocument()
  })

  it('reverts to "Save view" label after 2 seconds', async () => {
    vi.useFakeTimers()
    renderFilter()
    fireEvent.click(screen.getByRole('button', { name: /save current view/i }))
    await act(async () => {})
    expect(screen.getByRole('button', { name: /link copied/i })).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2100) })
    expect(
      screen.getByRole('button', { name: /save current view/i }),
    ).toBeInTheDocument()
  })

  it('handles clipboard failure silently (no uncaught error)', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    })
    renderFilter()
    fireEvent.click(screen.getByRole('button', { name: /save current view/i }))
    await act(async () => {})
    // Button should remain in its initial state — no crash
    expect(
      screen.getByRole('button', { name: /save current view/i }),
    ).toBeInTheDocument()
  })
})

// ─── Accessibility attributes ─────────────────────────────────────────────────

describe('SearchFilter — accessibility', () => {
  it('chips group has role=group with accessible label', () => {
    renderFilter()
    expect(
      screen.getByRole('group', { name: /filter by status/i }),
    ).toBeInTheDocument()
  })

  it('result count uses role=status with aria-live=polite and aria-atomic=true', () => {
    renderFilter()
    const el = screen.getByRole('status')
    expect(el).toHaveAttribute('aria-live', 'polite')
    expect(el).toHaveAttribute('aria-atomic', 'true')
  })

  it('search input has a non-empty accessible name', () => {
    renderFilter({ placeholder: 'Find…' })
    const input = screen.getByRole('searchbox')
    expect(input).toHaveAccessibleName('Find…')
  })

  it('clear-search button has accessible label', () => {
    renderFilter({}, 'q=test')
    expect(
      screen.getByRole('button', { name: /clear search/i }),
    ).toBeInTheDocument()
  })

  it('save-view button aria-label reflects copied state', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    renderFilter()
    const btn = screen.getByRole('button', { name: /save current view/i })
    fireEvent.click(btn)
    await act(async () => {})
    expect(
      screen.getByRole('button', { name: /link copied/i }),
    ).toBeInTheDocument()
  })
})

// ─── Invalid / boundary inputs ────────────────────────────────────────────────

describe('SearchFilter — invalid and boundary inputs', () => {
  it('renders with resultCount=0 and totalCount=0 without throwing', () => {
    expect(() => renderFilter({ resultCount: 0, totalCount: 0 })).not.toThrow()
  })

  it('handles resultCount > totalCount without throwing (defensive)', () => {
    expect(() =>
      renderFilter({ resultCount: 10, totalCount: 5 }),
    ).not.toThrow()
  })

  it('renders with an empty chips array without throwing', () => {
    expect(() => renderFilter({ chips: [] })).not.toThrow()
  })

  it('handles a chip id containing special URL characters', () => {
    const chips: ChipDef[] = [{ id: 'a&b=c', label: 'Special', color: 'success' }]
    expect(() => renderFilter({ chips })).not.toThrow()
    expect(screen.getByRole('button', { name: 'Special' })).toBeInTheDocument()
  })

  it('handles an extremely long placeholder without throwing', () => {
    const longPlaceholder = 'Search '.repeat(100)
    expect(() => renderFilter({ placeholder: longPlaceholder })).not.toThrow()
  })

  it('handles resultCount equal to totalCount at zero gracefully', () => {
    renderFilter({ resultCount: 0, totalCount: 0, entityLabel: 'item' })
    expect(screen.getByRole('status')).toHaveTextContent('No items')
  })
})
