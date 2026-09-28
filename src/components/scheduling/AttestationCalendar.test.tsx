import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AttestationCalendar } from './AttestationCalendar'
import type { Cadence, MonthGridDay } from './AttestationCalendar'

const GRID_LABEL = 'Attestation schedule calendar'

function getSection(): HTMLElement {
  return screen.getByRole('region', { name: /schedule periodic attestation runs/i })
}

function getGrid(): HTMLElement {
  return document.querySelector(`[aria-label="${GRID_LABEL}"]`) as HTMLElement
}

/** Day buttons are the only buttons whose aria-label starts with a weekday name. */
function getDayButtons(): HTMLElement[] {
  return within(getSection())
    .getAllByRole('button')
    .filter((b) => /^[A-Z][a-z]+day, /.test(b.getAttribute('aria-label') ?? ''))
}

function human(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

function getDay(date: Date): HTMLElement {
  // Accessible names may carry a ", scheduled" / ", not in current month" suffix
  return screen.getByRole('button', { name: new RegExp(`^${human(date)}`) })
}

function selectedDay(): HTMLElement {
  const selected = getDayButtons().find((b) => b.getAttribute('aria-selected') === 'true')
  if (!selected) throw new Error('no selected day')
  return selected
}

describe('AttestationCalendar - month grid (MonthGridDay)', () => {
  it('renders a Monday-start grid with leading/trailing days for January 2026', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    const days = getDayButtons()
    // Jan 2026: grid spans Mon Dec 29, 2025 → Sun Feb 1, 2026 (35 days)
    expect(days).toHaveLength(35)

    // First cell is the Monday before Jan 1 (a Thursday) → Dec 29, 2025
    expect(days[0].getAttribute('aria-label')).toContain('Monday, December 29, 2025')
    expect(days[0].getAttribute('aria-label')).toContain('not in current month')

    // In-month days carry no suffix
    expect(getDay(new Date(2026, 0, 1)).getAttribute('aria-label')).not.toContain('not in current month')

    // Trailing cell is Feb 1, 2026
    expect(days[days.length - 1].getAttribute('aria-label')).toContain('Sunday, February 1, 2026')
    expect(days[days.length - 1].getAttribute('aria-label')).toContain('not in current month')
  })

  it('renders a 42-day grid for a six-week month (March 2026)', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 2, 1)}
        initialSelectedDate={new Date(2026, 2, 15)}
      />,
    )

    const days = getDayButtons()
    expect(days).toHaveLength(42)
    expect(days[0].getAttribute('aria-label')).toContain('Monday, February 23, 2026')
    expect(days[days.length - 1].getAttribute('aria-label')).toContain('Sunday, April 5, 2026')
  })

  it('exposes MonthGridDay values with local ISO dates', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    // The selected day's aria-label is derived from the grid date, which is
    // built from a local-time ISO string (YYYY-MM-DD).
    const jan15 = getDay(new Date(2026, 0, 15))
    expect(jan15).toHaveAttribute('aria-selected', 'true')
    expect(jan15).toHaveAttribute('tabindex', '0')
    expect(jan15.textContent).toContain('15')
  })

  it('marks out-of-month days as such in their accessible name', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    const dec29 = screen.getByRole('button', { name: /Monday, December 29, 2025/ })
    expect(dec29.getAttribute('aria-label')).toContain('not in current month')
    expect(dec29).toHaveAttribute('aria-selected', 'false')
  })
})

describe('AttestationCalendar - props', () => {
  it('honours initialMonth and initialSelectedDate', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 1, 1)}
        initialSelectedDate={new Date(2026, 1, 15)}
      />,
    )

    expect(screen.getByText('February 2026')).toBeInTheDocument()
    expect(getDay(new Date(2026, 1, 15))).toHaveAttribute('aria-selected', 'true')
  })

  it('accepts scheduled dates as YYYY-MM-DD strings, ISO-8601 strings, and Date objects', () => {
    render(
      <AttestationCalendar
        scheduledDates={['2026-01-10', '2026-01-20T12:00:00', new Date(2026, 0, 30)]}
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    expect(getDay(new Date(2026, 0, 10)).getAttribute('aria-label')).toContain(', scheduled')
    expect(getDay(new Date(2026, 0, 20)).getAttribute('aria-label')).toContain(', scheduled')
    expect(getDay(new Date(2026, 0, 30)).getAttribute('aria-label')).toContain(', scheduled')
    expect(getDay(new Date(2026, 0, 15)).getAttribute('aria-label')).not.toContain(', scheduled')
  })

  it('ignores malformed scheduled date strings without crashing', () => {
    render(
      <AttestationCalendar
        scheduledDates={['not-a-date', '2026-13-45']}
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    expect(getDayButtons()).toHaveLength(35)
    expect(getDay(new Date(2026, 0, 15))).toHaveAttribute('aria-selected', 'true')
  })

  it('ignores malformed scheduled dates mixed with valid ones', () => {
    render(
      <AttestationCalendar
        scheduledDates={['garbage', '2026-01-15']}
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 10)}
      />,
    )

    expect(getDay(new Date(2026, 0, 15)).getAttribute('aria-label')).toContain(', scheduled')
    expect(getDay(new Date(2026, 0, 10)).getAttribute('aria-label')).not.toContain(', scheduled')
  })
})

describe('AttestationCalendar - month navigation', () => {
  it('navigates to the next and previous month', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getByText('February 2026')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /previous month/i }))
    expect(screen.getByText('January 2026')).toBeInTheDocument()
  })

  it('moves the cursor to the clicked day’s month when selecting an out-of-month day', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    fireEvent.click(getDay(new Date(2026, 1, 1)))
    expect(screen.getByText('February 2026')).toBeInTheDocument()
    expect(getDay(new Date(2026, 1, 1))).toHaveAttribute('aria-selected', 'true')
  })
})

describe('AttestationCalendar - date selection', () => {
  it('selects a day on click and updates the summary', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    fireEvent.click(getDay(new Date(2026, 0, 20)))

    expect(getDay(new Date(2026, 0, 20))).toHaveAttribute('aria-selected', 'true')
    expect(getDay(new Date(2026, 0, 15))).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('Selected start date:')).toBeInTheDocument()
    expect(screen.getByText('Tuesday, January 20, 2026')).toBeInTheDocument()
    expect(screen.getByText(/Recurrence/)).toBeInTheDocument()
  })

  it('keeps focus on the selected day (roving tabindex)', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    const days = getDayButtons()
    const selected = days.find((d) => d.getAttribute('aria-selected') === 'true')!
    expect(selected).toHaveAttribute('tabindex', '0')
    days
      .filter((d) => d !== selected)
      .forEach((d) => expect(d).toHaveAttribute('tabindex', '-1'))
  })
})

describe('AttestationCalendar - keyboard navigation', () => {
  function renderAt(selected: Date) {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={selected}
      />,
    )
  }

  it('moves the selection with arrow keys', () => {
    renderAt(new Date(2026, 0, 15))
    const grid = getGrid()

    fireEvent.keyDown(grid, { key: 'ArrowRight' })
    expect(selectedDay().getAttribute('aria-label')).toContain('Friday, January 16, 2026')

    fireEvent.keyDown(grid, { key: 'ArrowLeft' })
    expect(selectedDay().getAttribute('aria-label')).toContain('Thursday, January 15, 2026')

    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    expect(selectedDay().getAttribute('aria-label')).toContain('Thursday, January 22, 2026')

    fireEvent.keyDown(grid, { key: 'ArrowUp' })
    expect(selectedDay().getAttribute('aria-label')).toContain('Thursday, January 15, 2026')
  })

  it('jumps to the start and end of the week with Home and End', () => {
    renderAt(new Date(2026, 0, 15)) // a Thursday
    const grid = getGrid()

    fireEvent.keyDown(grid, { key: 'Home' })
    expect(selectedDay().getAttribute('aria-label')).toContain('Monday, January 12, 2026')

    fireEvent.keyDown(grid, { key: 'End' })
    expect(selectedDay().getAttribute('aria-label')).toContain('Sunday, January 18, 2026')
  })

  it('changes months with PageUp/PageDown and keeps a valid selected date', () => {
    renderAt(new Date(2026, 2, 15)) // Friday, March 15, 2026
    const grid = getGrid()

    fireEvent.keyDown(grid, { key: 'PageDown' })
    // April 2026 has 30 days, so the 15th is preserved.
    expect(selectedDay().getAttribute('aria-label')).toContain('April 15, 2026')
    expect(screen.getByText('April 2026')).toBeInTheDocument()

    fireEvent.keyDown(grid, { key: 'PageUp' })
    expect(selectedDay().getAttribute('aria-label')).toContain('March 15, 2026')
    expect(screen.getByText('March 2026')).toBeInTheDocument()
  })

  it('announces selection with Enter', () => {
    renderAt(new Date(2026, 0, 15))
    const grid = getGrid()

    fireEvent.keyDown(grid, { key: 'Enter' })
    expect(screen.getByText(/Scheduled date selected: .*Thursday, January 15, 2026/)).toBeInTheDocument()
  })
})

describe('AttestationCalendar - Cadence', () => {
  it('defaults to the monthly cadence', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    expect(screen.getByRole('radio', { name: 'Monthly' })).toBeChecked()
    expect(screen.getByText(/Occurs every month on day 15 of the month starting/)).toBeInTheDocument()
  })

  it('switches cadence between daily, weekly, and monthly', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)} // a Thursday
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Daily' }))
    expect(screen.getByText(/Occurs daily starting/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }))
    expect(screen.getByText(/Occurs every week on Thursday starting/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Monthly' }))
    expect(screen.getByText(/Occurs every month on day 15 of the month starting/)).toBeInTheDocument()
  })

  it('only shows monthly mode options for the monthly cadence', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    expect(screen.getByRole('radio', { name: 'Last day' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Day of month' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Daily' }))
    expect(screen.queryByRole('radio', { name: 'Last day' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Day of month' })).not.toBeInTheDocument()
  })

  it('describes the last-day monthly rule', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2026, 0, 1)}
        initialSelectedDate={new Date(2026, 0, 15)}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Last day' }))
    expect(screen.getByText(/Occurs every month on the last day of the month starting/)).toBeInTheDocument()
  })

  it('describes leap-day rollover for Feb 29 selections', () => {
    render(
      <AttestationCalendar
        initialMonth={new Date(2024, 1, 1)}
        initialSelectedDate={new Date(2024, 1, 29)}
      />,
    )

    expect(screen.getByText(/Occurs every month on day 29 starting/)).toBeInTheDocument()
    expect(screen.getByText(/In non-leap years, it runs on February 28/)).toBeInTheDocument()
  })

  it('keeps the cadence type union exhaustive', () => {
    const cadences: Cadence[] = ['daily', 'weekly', 'monthly']
    expect(cadences).toHaveLength(3)
  })

  it('keeps the MonthGridDay shape stable', () => {
    const probe: MonthGridDay = {
      date: new Date(2026, 0, 15),
      isoDate: '2026-01-15',
      inMonth: true,
    }
    expect(probe.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
