/**
 * Tests for RevokeKeyDialog
 *
 * Covers:
 *  - role="dialog" with aria-modal and aria-labelledby
 *  - Focus management: focus moves into the dialog on open and returns to the
 *    trigger on close
 *  - Dependent-usage list rendering (has usage, no usage, unknown)
 *  - Typed confirmation input (must match key label exactly)
 *  - Destructive-red confirm button (disabled until input matches)
 *  - Dismissal via backdrop click, ESC, close (X) and Cancel — each gated by
 *    `isLoading`
 *  - Relative "last seen" formatting branches
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import RevokeKeyDialog from '../components/api-keys/RevokeKeyDialog'
import type { ApiKey, DependentUsage } from '../components/api-keys/apiKeyTypes'

const baseKey: ApiKey = {
  id: 'key_001',
  label: 'Admin key',
  status: 'active',
  createdAt: '2026-06-01T14:00:00Z',
  expiresAt: '2026-12-01T00:00:00Z',
  scopes: ['read:attestations'],
  maskedKey: 'vtsr_live_xxxx',
}

const usageList: DependentUsage[] = [
  { name: 'Stripe webhook', lastSeenAt: new Date().toISOString() },
  { name: 'Internal cron', lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
]

const HOUR = 1000 * 60 * 60
const DAY = 24 * HOUR

describe('RevokeKeyDialog — rendering', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <RevokeKeyDialog
        open={false}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a modal dialog when open=true', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('dialog has aria-modal=true', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('dialog title is "Revoke API key?"', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('heading', { name: /revoke api key/i })).toBeInTheDocument()
  })

  it('shows the key label in the description', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    // "Admin key" appears both in the description and in the typed-confirmation
    // label, so target the dialog's accessible description explicitly.
    const dialog = screen.getByRole('dialog')
    const describedBy = dialog.getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)).toHaveTextContent('Admin key')
  })
})

describe('RevokeKeyDialog — dependent usage list', () => {
  it('shows "Usage data unavailable" when dependentUsages=null', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('note')).toHaveTextContent(/usage data unavailable/i)
  })

  it('shows "No integrations detected" when dependentUsages=[]', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={[]}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByText(/no integrations detected/i)).toBeInTheDocument()
  })

  it('renders the usage list when dependentUsages has items', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={usageList}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByText('Stripe webhook')).toBeInTheDocument()
    expect(screen.getByText('Internal cron')).toBeInTheDocument()
  })

  it('list has an accessible label with count', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={usageList}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('list', { name: /2 dependent integration/i })).toBeInTheDocument()
  })

  it('uses the singular noun in the list label for a single integration', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={[{ name: 'Only one', lastSeenAt: new Date().toISOString() }]}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('list', { name: '1 dependent integration' })).toBeInTheDocument()
  })

  it('each usage item displays "Last seen" with a <time> element', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={usageList}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const timeElements = document.querySelectorAll('time')
    expect(timeElements.length).toBeGreaterThanOrEqual(2)
  })

  it('renders relative "last seen" labels for today, yesterday, recent and old dates', () => {
    const now = Date.now()
    const cases: Array<{ lastSeenAt: string; expected: string }> = [
      { lastSeenAt: new Date(now).toISOString(), expected: 'Today' },
      { lastSeenAt: new Date(now - 25 * HOUR).toISOString(), expected: 'Yesterday' },
      { lastSeenAt: new Date(now - 5.5 * DAY).toISOString(), expected: '5 days ago' },
    ]

    for (const c of cases) {
      const { unmount } = render(
        <RevokeKeyDialog
          open={true}
          keyItem={baseKey}
          dependentUsages={[{ name: 'Integration', lastSeenAt: c.lastSeenAt }]}
          onClose={() => {}}
          onConfirm={() => {}}
        />,
      )
      expect(document.querySelector('time')!.textContent).toBe(c.expected)
      unmount()
    }
  })

  it('falls back to an absolute date for usages older than 30 days', () => {
    const old = new Date(Date.now() - 40 * DAY)
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={[{ name: 'Ancient integration', lastSeenAt: old.toISOString() }]}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const time = document.querySelector('time')!
    // Older than the relative window: the raw calendar date is rendered, not a
    // "N days ago" string, and it is machine-readable via dateTime.
    expect(time.textContent).not.toMatch(/ago|Today|Yesterday/)
    expect(time.textContent).toBe(
      old.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }),
    )
    expect(time).toHaveAttribute('dateTime', old.toISOString())
  })
})

describe('RevokeKeyDialog — typed confirmation', () => {
  it('renders an input field with placeholder matching the key label', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i) as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.placeholder).toBe('Admin key')
  })

  it('confirm button is disabled when input is empty', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /revoke key/i })).toBeDisabled()
  })

  it('confirm button is disabled when input does not match the key label', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: 'Wrong' } })
    expect(screen.getByRole('button', { name: /revoke key/i })).toBeDisabled()
  })

  it('confirm button is enabled when input matches the key label exactly', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: 'Admin key' } })
    expect(screen.getByRole('button', { name: /revoke key/i })).not.toBeDisabled()
  })

  it('trims whitespace when checking the match', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: '  Admin key  ' } })
    expect(screen.getByRole('button', { name: /revoke key/i })).not.toBeDisabled()
  })

  it('treats a whitespace-only confirmation as invalid', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: /revoke key/i })).toBeDisabled()
    // A non-empty but wrong value is reported as a mismatch.
    expect(screen.getByText(/key name does not match/i)).toBeInTheDocument()
  })

  it('rejects an input that only differs by internal whitespace', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: 'Admin  key' } })
    expect(screen.getByRole('button', { name: /revoke key/i })).toBeDisabled()
  })

  it('is case-sensitive: "admin key" does not confirm "Admin key"', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: 'admin key' } })
    expect(screen.getByRole('button', { name: /revoke key/i })).toBeDisabled()
  })

  it('marks a non-empty mismatch as aria-invalid and clears it once corrected', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    expect(input).toHaveAttribute('aria-invalid', 'false')

    fireEvent.change(input, { target: { value: 'Nope' } })
    expect(input).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(input, { target: { value: 'Admin key' } })
    expect(input).toHaveAttribute('aria-invalid', 'false')
  })

  it('clears the validation message when the input is emptied again', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: 'Nope' } })
    expect(screen.getByText(/key name does not match/i)).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '' } })
    expect(screen.queryByText(/key name does not match/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/✓ confirmed/i)).not.toBeInTheDocument()
  })

  it('shows aria-live validation error when input is incorrect', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: 'Wrong' } })
    expect(screen.getByText(/key name does not match/i)).toBeInTheDocument()
  })

  it('shows "✓ Confirmed" when input is correct', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: 'Admin key' } })
    expect(screen.getByText(/✓ confirmed/i)).toBeInTheDocument()
  })

  it('matches a label that itself carries surrounding whitespace', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={{ ...baseKey, label: '  Padded key  ' }}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/padded key.*to confirm/i)
    fireEvent.change(input, { target: { value: 'Padded key' } })
    expect(screen.getByRole('button', { name: /revoke key/i })).not.toBeDisabled()
  })
})

describe('RevokeKeyDialog — interactions', () => {
  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn()
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when Revoke button is clicked (after confirming input)', () => {
    const onConfirm = vi.fn()
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: 'Admin key' } })
    fireEvent.click(screen.getByRole('button', { name: /revoke key/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('does not call onConfirm while the input is still invalid', () => {
    const onConfirm = vi.fn()
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /revoke key/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    )
    const backdrop = container.querySelector('.modal-backdrop')
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when close (X) button is clicked', () => {
    const onClose = vi.fn()
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not close when the dialog body itself is clicked', () => {
    const onClose = vi.fn()
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose on the Escape key', () => {
    const onClose = vi.fn()
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('ignores non-Escape keys on the document', () => {
    const onClose = vi.fn()
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    )
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('RevokeKeyDialog — loading state', () => {
  it('confirm button has aria-busy when isLoading=true', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        isLoading={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /revoking/i })).toHaveAttribute('aria-busy', 'true')
  })

  it('keeps the confirm button disabled during an in-flight revoke even when the input matches', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        isLoading={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: 'Admin key' } })
    expect(screen.getByRole('button', { name: /revoking/i })).toBeDisabled()
  })

  it('disables Cancel, close (X) and backdrop dismissal while loading and ignores Escape', () => {
    const onClose = vi.fn()
    const { container } = render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        isLoading={true}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /close dialog/i })).toBeDisabled()

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(container.querySelector('.modal-backdrop')!)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }))

    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('RevokeKeyDialog — focus management', () => {
  it('moves focus into the dialog when it opens', async () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('dialog')))
  })

  it('traps Tab on the last focusable element and Shift+Tab on the first', async () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('dialog')))

    const focusable = Array.from(
      screen.getByRole('dialog').querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])',
      ),
    )
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    expect(focusable.length).toBeGreaterThan(1)

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('returns focus to the trigger and resets the confirmation input once closed', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open revoke dialog
          </button>
          <RevokeKeyDialog
            open={open}
            keyItem={baseKey}
            dependentUsages={null}
            onClose={() => setOpen(false)}
            onConfirm={() => setOpen(false)}
          />
        </div>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open revoke dialog' })
    trigger.focus()
    fireEvent.click(trigger)

    const input = await screen.findByLabelText(/type.*admin key.*to confirm/i)
    fireEvent.change(input, { target: { value: 'Admin key' } })
    expect(screen.getByRole('button', { name: /revoke key/i })).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(document.activeElement).toBe(trigger)

    // Re-opening starts from a clean confirmation state.
    fireEvent.click(trigger)
    const reopened = await screen.findByLabelText(/type.*admin key.*to confirm/i)
    expect((reopened as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('button', { name: /revoke key/i })).toBeDisabled()
  })
})

describe('RevokeKeyDialog — accessibility', () => {
  it('dialog is labelled by the title id', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const dialog = screen.getByRole('dialog')
    const titleId = dialog.getAttribute('aria-labelledby')
    expect(titleId).toBeTruthy()
    expect(document.getElementById(titleId!)).toHaveTextContent(/revoke api key/i)
  })

  it('dialog is described by the description id', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const dialog = screen.getByRole('dialog')
    const descId = dialog.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    expect(document.getElementById(descId!)).toBeInTheDocument()
  })

  it('input has aria-describedby for live feedback', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key/i)
    expect(input).toHaveAttribute('aria-describedby')
  })

  it('exposes the live validation region as a polite status', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const input = screen.getByLabelText(/type.*admin key.*to confirm/i)
    const describedBy = input.getAttribute('aria-describedby')!
    const region = document.getElementById(describedBy)!
    expect(region).toHaveAttribute('role', 'status')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('mirrors the disabled confirm state on aria-disabled', () => {
    render(
      <RevokeKeyDialog
        open={true}
        keyItem={baseKey}
        dependentUsages={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /revoke key/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
