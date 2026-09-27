import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach } from 'vitest'
import { IntlProvider } from 'react-intl'
import enMessages from '../../i18n/messages/en.json'
import SavedFiltersDropdown from './SavedFiltersDropdown'
import type { SavedFilter } from '../../utils/auditLogFilters'

afterEach(cleanup)

const sample: SavedFilter[] = [
  {
    id: 'f1',
    name: 'Failed',
    searchParams: '?status=failed',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'f2',
    name: 'Verified',
    searchParams: '?status=verified',
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
]

function wrap(node: React.ReactNode) {
  // LocaleProvider relies on Vite's import.meta.glob to load messages;
  // vitest's jsdom environment does not resolve that glob. Pass the
  // en.json messages explicitly so formatMessage can interpolate ICU
  // placeholders for the aria-live announcements under test.
  return (
    <IntlProvider locale="en" messages={enMessages}>
      {node}
    </IntlProvider>
  )
}

describe('SavedFiltersDropdown', () => {
  function renderDropdown(
    overrides: Partial<React.ComponentProps<typeof SavedFiltersDropdown>> = {},
  ) {
    const onApply = vi.fn()
    const onRename = vi.fn().mockReturnValue({ ok: true })
    const onDelete = vi.fn()
    const result = render(
      wrap(
        <SavedFiltersDropdown
          filters={[]}
          isHydrated
          maxFilters={50}
          isFull={false}
          onApply={onApply}
          onRename={onRename}
          onDelete={onDelete}
          {...overrides}
        />,
      ),
    )
    return { onApply, onRename, onDelete, unmount: result.unmount }
  }

  it('renders the trigger button with the right aria attributes', () => {
    renderDropdown({ filters: sample })
    const trigger = screen.getByTestId('saved-filters-trigger')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls')
  })

  it('shows the count badge on the trigger when there are filters', () => {
    renderDropdown({ filters: sample })
    expect(screen.getByTestId('saved-filters-trigger').textContent).toMatch(/2/)
  })

  it('opens and closes on trigger click', async () => {
    renderDropdown({ filters: sample })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    expect(screen.getByTestId('saved-filters-menu')).toBeInTheDocument()
    expect(screen.getByTestId('saved-filters-trigger')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    expect(screen.queryByTestId('saved-filters-menu')).not.toBeInTheDocument()
  })

  it('resets per-row state when the menu is closed via trigger', async () => {
    renderDropdown({ filters: sample })
    const trigger = screen.getByTestId('saved-filters-trigger')
    fireEvent.click(trigger)
    // Click delete once to put it into "confirm delete" mode.
    fireEvent.click(screen.getByTestId('saved-filter-delete-f1'))
    expect(
      screen.getByTestId('saved-filter-delete-f1').textContent,
    ).toMatch(/confirm/i)
    // Close and reopen — confirm state should be gone.
    fireEvent.click(trigger)
    fireEvent.click(trigger)
    expect(
      screen.getByTestId('saved-filter-delete-f1').textContent,
    ).not.toMatch(/confirm/i)
  })

  it('closes on Escape', async () => {
    renderDropdown({ filters: sample })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByTestId('saved-filters-menu')).not.toBeInTheDocument(),
    )
  })

  it('closes when clicking outside the menu', async () => {
    renderDropdown({ filters: sample })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    // Click somewhere outside the trigger + menu
    fireEvent.mouseDown(document.body)
    await waitFor(() =>
      expect(screen.queryByTestId('saved-filters-menu')).not.toBeInTheDocument(),
    )
  })

  it('renders an empty state message when there are no filters', () => {
    renderDropdown({ filters: [] })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    expect(screen.getByText(/no saved filters yet/i)).toBeInTheDocument()
  })

  it('renders a loading state when not yet hydrated', () => {
    renderDropdown({ filters: sample, isHydrated: false })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    expect(screen.getByText(/loading saved filters/i)).toBeInTheDocument()
  })

  it('applies a filter and announces success', async () => {
    const { onApply } = renderDropdown({ filters: sample })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    fireEvent.click(screen.getByTestId('saved-filter-apply-f1'))
    expect(onApply).toHaveBeenCalledWith('?status=failed', 'Failed')
    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toMatch(
        /failed.*applied/i,
      ),
    )
  })

  it('enters rename mode and saves on Enter', () => {
    const { onRename } = renderDropdown({ filters: sample })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    fireEvent.click(screen.getByTestId('saved-filter-rename-f1'))
    const input = document.querySelector(
      '[data-testid="saved-filter-row-f1"] input',
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Failed (last 7d)' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith('f1', 'Failed (last 7d)')
  })

  it('shows inline rename error when local validation fails (duplicate)', () => {
    const { onRename } = renderDropdown({ filters: sample })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    fireEvent.click(screen.getByTestId('saved-filter-rename-f1'))
    const input = document.querySelector(
      '[data-testid="saved-filter-row-f1"] input',
    ) as HTMLInputElement
    // "Verified" already exists.
    fireEvent.change(input, { target: { value: 'Verified' } })
    fireEvent.click(screen.getByTestId('saved-filter-save-rename-f1'))
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i)
  })

  it('exits rename mode on Escape without saving', () => {
    const { onRename } = renderDropdown({ filters: sample })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    fireEvent.click(screen.getByTestId('saved-filter-rename-f1'))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.queryByTestId('saved-filter-save-rename-f1')).toBeNull()
    expect(onRename).not.toHaveBeenCalled()
  })

  it('delete requires a second click to confirm', () => {
    const { onDelete } = renderDropdown({ filters: sample })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    fireEvent.click(screen.getByTestId('saved-filter-delete-f1'))
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('saved-filter-delete-f1'))
    expect(onDelete).toHaveBeenCalledWith('f1', 'Failed')
  })

  it('shows limit reached text when isFull is true', () => {
    renderDropdown({ filters: sample, isFull: true, maxFilters: 2 })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    expect(screen.getByText(/limit reached/i)).toBeInTheDocument()
  })

  it('uses unique menuitem aria-labels per row that include the filter name', () => {
    renderDropdown({ filters: sample })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    expect(screen.getByLabelText(/Saved filter: Failed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Saved filter: Verified/i)).toBeInTheDocument()
  })

  it('renders the singular count when there is exactly one filter', () => {
    renderDropdown({ filters: [sample[0]] })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    expect(screen.getByText(/1 filter saved/i)).toBeInTheDocument()
  })

  it('renders the plural count when there are zero or many filters', () => {
    const { unmount } = renderDropdown({ filters: [] })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    expect(screen.getByText(/no filters saved/i)).toBeInTheDocument()
    unmount()
    renderDropdown({ filters: sample })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    expect(screen.getByText(/2 filters saved/i)).toBeInTheDocument()
  })

  it('respects the maxNameLength override', () => {
    renderDropdown({ filters: sample, maxNameLength: 10 })
    fireEvent.click(screen.getByTestId('saved-filters-trigger'))
    fireEvent.click(screen.getByTestId('saved-filter-rename-f1'))
    const input = document.querySelector(
      '[data-testid="saved-filter-row-f1"] input',
    ) as HTMLInputElement
    expect(input).toHaveAttribute('maxLength', '10')
  })
})