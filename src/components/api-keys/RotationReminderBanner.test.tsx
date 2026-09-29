/**
 * Dedicated test suite for shouldShowRotationReminder & RotationReminderBanner (#618)
 *
 * Covers:
 *  shouldShowRotationReminder (pure logic):
 *    - Returns true when rotationDue is within 14-day lead-time window
 *    - Returns true on the exact 14-day boundary
 *    - Returns false when rotationDue is > 14 days away
 *    - Returns false when rotationDue is in the past
 *    - Returns false for non-active key statuses (expired, revoked)
 *    - Returns false when rotationDue is absent
 *    - Returns false when snooze is active (<24 h ago)
 *    - Returns true when snooze has expired (>24 h ago)
 *    - Snooze is capped to the rotationDue deadline
 *
 *  RotationReminderBanner (component):
 *    - Renders nothing when banner should not show
 *    - Renders a status landmark when banner should show
 *    - Accessible aria-label describes days + key label
 *    - Shows key label in message text
 *    - "Rotate now" CTA with accessible label
 *    - "Snooze" CTA with accessible label
 *    - Days=0 edge case handled (renders without crash)
 *    - onRotate callback receives correct key id
 *    - onSnooze callback receives correct key id
 *    - Decorative icon is aria-hidden
 *    - Due date is wrapped in a <time> element with dateTime attribute
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RotationReminderBanner, {
  shouldShowRotationReminder,
} from './RotationReminderBanner'
import type { ApiKey } from './apiKeyTypes'

// ─── helpers ─────────────────────────────────────────────────────────────────

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function subtractDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

const baseKey: ApiKey = {
  id: 'key_test_001',
  label: 'Production Key',
  status: 'active',
  createdAt: subtractDays(60),
  expiresAt: addDays(120),
  scopes: ['read:attestations'],
  maskedKey: 'vtsr_live_xxxx',
}

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return { ...baseKey, ...overrides }
}

// ─── shouldShowRotationReminder ──────────────────────────────────────────────

describe('shouldShowRotationReminder – visibility logic', () => {
  it('returns true when rotationDue is 7 days away (within window)', () => {
    expect(shouldShowRotationReminder(makeKey({ rotationDue: addDays(7) }))).toBe(true)
  })

  it('returns true exactly on the 14-day boundary', () => {
    expect(shouldShowRotationReminder(makeKey({ rotationDue: addDays(14) }))).toBe(true)
  })

  it('returns true when rotationDue is 1 day away', () => {
    expect(shouldShowRotationReminder(makeKey({ rotationDue: addDays(1) }))).toBe(true)
  })

  it('returns false when rotationDue is 15 days away (outside window)', () => {
    expect(shouldShowRotationReminder(makeKey({ rotationDue: addDays(15) }))).toBe(false)
  })

  it('returns false when rotationDue is 30 days away', () => {
    expect(shouldShowRotationReminder(makeKey({ rotationDue: addDays(30) }))).toBe(false)
  })

  it('returns false when rotationDue is in the past (1 day ago)', () => {
    expect(shouldShowRotationReminder(makeKey({ rotationDue: subtractDays(1) }))).toBe(false)
  })

  it('returns false when rotationDue is in the past (30 days ago)', () => {
    expect(shouldShowRotationReminder(makeKey({ rotationDue: subtractDays(30) }))).toBe(false)
  })

  it('returns false when rotationDue is absent (undefined)', () => {
    expect(shouldShowRotationReminder(makeKey())).toBe(false)
  })

  it('returns false when key status is "expired"', () => {
    expect(
      shouldShowRotationReminder(makeKey({ status: 'expired', rotationDue: addDays(5) })),
    ).toBe(false)
  })

  it('returns false when key status is "revoked"', () => {
    expect(
      shouldShowRotationReminder(makeKey({ status: 'revoked', rotationDue: addDays(5) })),
    ).toBe(false)
  })
})

describe('shouldShowRotationReminder – snooze logic', () => {
  it('returns false when key was snoozed 30 minutes ago (snooze active)', () => {
    const snoozedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    expect(
      shouldShowRotationReminder(makeKey({ rotationDue: addDays(5), snoozedAt })),
    ).toBe(false)
  })

  it('returns false when key was snoozed 1 hour ago', () => {
    const snoozedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(
      shouldShowRotationReminder(makeKey({ rotationDue: addDays(5), snoozedAt })),
    ).toBe(false)
  })

  it('returns true when snooze expired (25 hours ago)', () => {
    const snoozedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    expect(
      shouldShowRotationReminder(makeKey({ rotationDue: addDays(5), snoozedAt })),
    ).toBe(true)
  })

  it('returns false when snooze was applied and rotationDue is before snooze expiry (cap)', () => {
    // Snoozed 12 hours ago; rotationDue is 6 hours from now — cap kicks in
    const snoozedAt = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const rotationDue = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
    // Date.now() < Math.min(snoozeExpiry=12h, cap=rotationDue=6h) → 6h > 0 → false
    expect(
      shouldShowRotationReminder(makeKey({ rotationDue, snoozedAt })),
    ).toBe(false)
  })
})

// ─── RotationReminderBanner – rendering ─────────────────────────────────────

describe('RotationReminderBanner – does not render', () => {
  it('renders nothing when rotationDue is absent', () => {
    const { container } = render(
      <RotationReminderBanner keyItem={baseKey} onRotate={() => {}} onSnooze={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when rotationDue is outside the 14-day window', () => {
    const { container } = render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(20) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for an expired key', () => {
    const { container } = render(
      <RotationReminderBanner
        keyItem={makeKey({ status: 'expired', rotationDue: addDays(5) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for a revoked key', () => {
    const { container } = render(
      <RotationReminderBanner
        keyItem={makeKey({ status: 'revoked', rotationDue: addDays(5) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when snooze is active', () => {
    const snoozedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { container } = render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(5), snoozedAt })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})

describe('RotationReminderBanner – renders banner', () => {
  it('renders a status landmark when rotation is due in 8 days', () => {
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(8) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('has an accessible label mentioning the key label and days until rotation', () => {
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(8) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(screen.getByRole('status')).toHaveAccessibleName(
      /rotation reminder.*production key.*8 day/i,
    )
  })

  it('shows the key label in the message body', () => {
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(5) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(screen.getByText('Production Key')).toBeInTheDocument()
  })

  it('shows "Rotation due soon" headline text', () => {
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(5) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(screen.getByText(/rotation due soon/i)).toBeInTheDocument()
  })

  it('renders the "Rotate now" button with an accessible label', () => {
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(5) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: /rotate key production key now/i }),
    ).toBeInTheDocument()
  })

  it('renders the "Snooze" button with an accessible label', () => {
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(5) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: /snooze rotation reminder.*24 hour/i }),
    ).toBeInTheDocument()
  })

  it('renders without crash when rotationDue is today (0 days, urgent)', () => {
    const nearFuture = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: nearFuture })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders the banner when snooze expired (25 h ago)', () => {
    const snoozedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(5), snoozedAt })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

// ─── RotationReminderBanner – interactions ───────────────────────────────────

describe('RotationReminderBanner – interactions', () => {
  it('calls onRotate with the correct key id when "Rotate now" is clicked', () => {
    const onRotate = vi.fn()
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(5) })}
        onRotate={onRotate}
        onSnooze={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /rotate key/i }))
    expect(onRotate).toHaveBeenCalledOnce()
    expect(onRotate).toHaveBeenCalledWith('key_test_001')
  })

  it('calls onSnooze with the correct key id when "Snooze" is clicked', () => {
    const onSnooze = vi.fn()
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(5) })}
        onRotate={() => {}}
        onSnooze={onSnooze}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /snooze/i }))
    expect(onSnooze).toHaveBeenCalledOnce()
    expect(onSnooze).toHaveBeenCalledWith('key_test_001')
  })
})

// ─── RotationReminderBanner – accessibility ──────────────────────────────────

describe('RotationReminderBanner – accessibility', () => {
  it('the decorative key icon is aria-hidden', () => {
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(5) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    // At least one aria-hidden element should be present (the decorative icon)
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('the "Rotate now" button has an aria-label attribute', () => {
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(5) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    const btn = screen.getByRole('button', { name: /rotate key/i })
    expect(btn).toHaveAttribute('aria-label')
  })

  it('the rotation due date is wrapped in a <time> element with a dateTime attribute', () => {
    render(
      <RotationReminderBanner
        keyItem={makeKey({ rotationDue: addDays(8) })}
        onRotate={() => {}}
        onSnooze={() => {}}
      />,
    )
    const timeEl = document.querySelector('time')
    expect(timeEl).toBeInTheDocument()
    expect(timeEl).toHaveAttribute('dateTime')
  })
})
