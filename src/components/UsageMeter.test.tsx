import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import UsageMeter, { getUsageTier } from './UsageMeter'
import type { UsageTier } from './UsageMeter'

describe('getUsageTier', () => {
  it('returns "normal" below the warning threshold', () => {
    expect(getUsageTier(0)).toBe('normal')
    expect(getUsageTier(50)).toBe('normal')
    expect(getUsageTier(74)).toBe('normal')
    expect(getUsageTier(74.9)).toBe('normal')
  })

  it('returns "warning" at and above 75 but below 90', () => {
    expect(getUsageTier(75)).toBe('warning')
    expect(getUsageTier(80)).toBe('warning')
    expect(getUsageTier(89)).toBe('warning')
    expect(getUsageTier(89.9)).toBe('warning')
  })

  it('returns "critical" at and above 90', () => {
    expect(getUsageTier(90)).toBe('critical')
    expect(getUsageTier(95)).toBe('critical')
    expect(getUsageTier(100)).toBe('critical')
    expect(getUsageTier(150)).toBe('critical')
  })

  it('handles boundary values exactly at the thresholds', () => {
    const tiers: UsageTier[] = [74, 75, 89, 90].map(getUsageTier)
    expect(tiers).toEqual(['normal', 'warning', 'warning', 'critical'])
  })

  it('treats negative percentages as "normal"', () => {
    expect(getUsageTier(-1)).toBe('normal')
    expect(getUsageTier(-100)).toBe('normal')
  })

  it('treats NaN as "normal" (all comparisons false)', () => {
    expect(getUsageTier(NaN)).toBe('normal')
  })

  it('treats Infinity as "critical" and -Infinity as "normal"', () => {
    expect(getUsageTier(Infinity)).toBe('critical')
    expect(getUsageTier(-Infinity)).toBe('normal')
  })
})

describe('UsageMeter', () => {
  it('renders the label, usage numbers, and unit', () => {
    render(<UsageMeter label="Attestations" used={250} limit={1000} unit="attestations" />)

    expect(screen.getByText('Attestations')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getAllByText(/1,000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/attestations/).length).toBeGreaterThan(0)
  })

  it('defaults the unit to "uses" when not provided', () => {
    render(<UsageMeter label="API calls" used={10} limit={100} />)
    expect(screen.getAllByText(/uses/).length).toBeGreaterThan(0)
  })

  it('renders the period when provided and omits it otherwise', () => {
    const { rerender } = render(
      <UsageMeter label="Attestations" used={10} limit={100} period="July 2026" />,
    )
    expect(screen.getByText('July 2026')).toBeInTheDocument()

    rerender(<UsageMeter label="Attestations" used={10} limit={100} />)
    expect(screen.queryByText('July 2026')).not.toBeInTheDocument()
  })

  it('exposes an accessible progressbar with correct ARIA values', () => {
    render(<UsageMeter label="Attestations" used={250} limit={1000} />)

    const bar = screen.getByRole('progressbar', { name: 'Attestations' })
    expect(bar).toHaveAttribute('aria-valuenow', '25')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute(
      'aria-valuetext',
      '250 of 1,000 uses used (25%)',
    )
  })

  it('shows the "On track" tier badge and no alert message in the normal tier', () => {
    render(<UsageMeter label="Attestations" used={100} limit={1000} />)

    expect(screen.getByText('On track')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/you have used 75 % or more/i),
    ).not.toBeInTheDocument()
  })

  it('shows the "Warning" tier badge and message between 75% and 90%', () => {
    render(<UsageMeter label="Attestations" used={800} limit={1000} />)

    expect(screen.getByText('Warning')).toBeInTheDocument()
    const alert = screen.getByRole('status')
    expect(alert).toHaveTextContent(
      'You have used 75 % or more of your monthly limit. Consider upgrading before you hit the cap.',
    )
    expect(alert).toHaveAttribute('aria-live', 'polite')
  })

  it('shows the "Critical" tier badge and message at 90% or above', () => {
    render(<UsageMeter label="Attestations" used={950} limit={1000} />)

    expect(screen.getByText('Critical')).toBeInTheDocument()
    const alert = screen.getByRole('status')
    expect(alert).toHaveTextContent(
      'You have used 90 % or more of your monthly limit. Upgrade your plan to avoid service interruption.',
    )
  })

  it('transitions tier badge and message as usage crosses thresholds', () => {
    const { rerender } = render(
      <UsageMeter label="Attestations" used={700} limit={1000} />,
    )
    expect(screen.getByText('On track')).toBeInTheDocument()

    rerender(<UsageMeter label="Attestations" used={750} limit={1000} />)
    expect(screen.getByText('Warning')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()

    rerender(<UsageMeter label="Attestations" used={900} limit={1000} />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('clamps used above the limit to the limit', () => {
    render(<UsageMeter label="Attestations" used={1500} limit={1000} />)

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    expect(bar).toHaveAttribute(
      'aria-valuetext',
      '1,000 of 1,000 uses used (100%)',
    )
    expect(screen.getByText('0 remaining · 100% used')).toBeInTheDocument()
  })

  it('clamps negative used to zero', () => {
    render(<UsageMeter label="Attestations" used={-50} limit={1000} />)

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(bar).toHaveAttribute('aria-valuetext', '0 of 1,000 uses used (0%)')
    expect(screen.getByText('1,000 remaining · 0% used')).toBeInTheDocument()
  })

  it('renders safely with a zero limit (no division by zero)', () => {
    render(<UsageMeter label="Attestations" used={10} limit={0} />)

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(bar).toHaveAttribute('aria-valuetext', '0 of 0 uses used (0%)')
    expect(screen.getByText('On track')).toBeInTheDocument()
  })

  it('renders threshold tick marks at 75% and 90%', () => {
    render(<UsageMeter label="Attestations" used={10} limit={100} />)

    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('derives a stable id from the label for the track and alert', () => {
    render(<UsageMeter label="API Calls" used={950} limit={1000} />)

    expect(document.getElementById('usage-meter-track-api-calls')).toBeInTheDocument()
    expect(document.getElementById('usage-meter-alert-api-calls')).toBeInTheDocument()
  })

  it('formats large numbers with locale separators', () => {
    render(<UsageMeter label="Attestations" used={1234567} limit={10000000} />)

    expect(screen.getByText('1,234,567')).toBeInTheDocument()
    expect(screen.getAllByText(/10,000,000/).length).toBeGreaterThan(0)
  })
})
