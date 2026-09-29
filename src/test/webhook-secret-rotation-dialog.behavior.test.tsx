/**
 * Behavioural coverage for `WebhookSecretRotationDialog`.
 *
 * The existing suite (`webhook-secret-rotation-dialog.test.tsx`) covers the
 * static markup, the ARIA wiring and "callback fires once" for each control.
 * What it does not cover is the part of the dialog that actually has state:
 *
 *  - the copy affordance's state machine (idle -> copied -> idle, idle -> error
 *    -> idle) and the fact that it copies the *full* secret, never the mask;
 *  - the keyboard focus trap at its two boundaries (last -> first on Tab,
 *    first -> last on Shift+Tab) and the fact that non-Tab keys are left alone;
 *  - focus restoration to whatever was focused before the dialog opened;
 *  - the grace-period countdown: it ticks, it clamps at zero, and an
 *    `expiresAt` of exactly "now" already counts as expired.
 */
import type { ComponentProps } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import WebhookSecretRotationDialog, {
  type RotatingSecret,
} from '../components/WebhookSecretRotationDialog'

const OLD_FULL = 'whsec_old_full_value_3f9a'
const NEW_FULL = 'whsec_new_full_value_b2c7'

const oldSecret: RotatingSecret = {
  masked: 'whsec_••••••••3f9a',
  full: OLD_FULL,
  lastUsedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 23).toISOString(),
}

const newSecret: RotatingSecret = {
  masked: 'whsec_••••••••b2c7',
  full: NEW_FULL,
  lastUsedAt: null,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
}

function makeProps(
  overrides: Partial<ComponentProps<typeof WebhookSecretRotationDialog>> = {},
) {
  return {
    open: true,
    endpointLabel: 'https://example.com/hooks',
    oldSecret,
    newSecret,
    onConfirm: vi.fn(),
    onCancelRotation: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

function installClipboard(impl: (text: string) => Promise<void>) {
  const writeText = vi.fn(impl)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return writeText
}

const copyNew = () => screen.getByRole('button', { name: /copy new secret to clipboard/i })
const copyOld = () => screen.getByRole('button', { name: /copy old secret to clipboard/i })

describe('WebhookSecretRotationDialog — copy affordance', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('copies the full secret value, never the masked one', async () => {
    const writeText = installClipboard(async () => {})
    render(<WebhookSecretRotationDialog {...makeProps()} />)

    await act(async () => {
      fireEvent.click(copyNew())
    })
    await act(async () => {
      fireEvent.click(copyOld())
    })

    expect(writeText).toHaveBeenNthCalledWith(1, NEW_FULL)
    expect(writeText).toHaveBeenNthCalledWith(2, OLD_FULL)
    expect(writeText).not.toHaveBeenCalledWith(newSecret.masked)
    expect(writeText).not.toHaveBeenCalledWith(oldSecret.masked)
  })

  it('announces success and returns to idle after two seconds', async () => {
    installClipboard(async () => {})
    render(<WebhookSecretRotationDialog {...makeProps()} />)

    expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(copyNew())
    })
    expect(screen.getByText('Copied to clipboard')).toBeInTheDocument()
    expect(copyNew()).toHaveTextContent('✓')

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument()
    expect(copyNew()).toHaveTextContent('⎘')
  })

  it('announces failure and returns to idle after two seconds', async () => {
    installClipboard(async () => {
      throw new Error('clipboard blocked')
    })
    render(<WebhookSecretRotationDialog {...makeProps()} />)

    await act(async () => {
      fireEvent.click(copyOld())
    })
    expect(screen.getByText('Copy failed')).toBeInTheDocument()
    expect(copyOld()).toHaveTextContent('✕')

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText('Copy failed')).not.toBeInTheDocument()
    expect(copyOld()).toHaveTextContent('⎘')
  })

  it('reports failure and clears the state when the clipboard API is missing', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    render(<WebhookSecretRotationDialog {...makeProps()} />)

    await act(async () => {
      fireEvent.click(copyNew())
    })
    expect(screen.getByText('Copy failed')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText('Copy failed')).not.toBeInTheDocument()
  })

  it('keeps the two copy buttons independent', async () => {
    installClipboard(async () => {})
    render(<WebhookSecretRotationDialog {...makeProps()} />)

    await act(async () => {
      fireEvent.click(copyNew())
    })

    expect(copyNew()).toHaveTextContent('✓')
    expect(copyOld()).toHaveTextContent('⎘')
    expect(screen.getAllByText('Copied to clipboard')).toHaveLength(1)
  })

  it('re-copies on a second click, and the earliest revert timer still wins', async () => {
    const writeText = installClipboard(async () => {})
    render(<WebhookSecretRotationDialog {...makeProps()} />)

    await act(async () => {
      fireEvent.click(copyNew())
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    await act(async () => {
      fireEvent.click(copyNew())
    })

    // Both clicks reach the clipboard.
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Copied to clipboard')).toBeInTheDocument()

    // The pre-existing revert timer is not cancelled by the second click, so the
    // badge clears two seconds after the *first* copy, not the second.
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument()
    expect(copyNew()).toHaveTextContent('⎘')
  })
})

describe('WebhookSecretRotationDialog — focus management', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('wraps from the last focusable back to the first on Tab', () => {
    render(<WebhookSecretRotationDialog {...makeProps()} />)
    const first = screen.getByRole('button', { name: /close dialog/i })
    const last = screen.getByRole('button', { name: /confirm rotation/i })

    last.focus()
    const notCancelled = fireEvent.keyDown(document, { key: 'Tab' })

    expect(notCancelled).toBe(false) // preventDefault was called
    expect(document.activeElement).toBe(first)
  })

  it('wraps from the first focusable back to the last on Shift+Tab', () => {
    render(<WebhookSecretRotationDialog {...makeProps()} />)
    const first = screen.getByRole('button', { name: /close dialog/i })
    const last = screen.getByRole('button', { name: /confirm rotation/i })

    first.focus()
    const notCancelled = fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(notCancelled).toBe(false)
    expect(document.activeElement).toBe(last)
  })

  it('lets the browser handle Tab when focus is not on a boundary element', () => {
    render(<WebhookSecretRotationDialog {...makeProps()} />)
    copyNew().focus()

    const notCancelled = fireEvent.keyDown(document, { key: 'Tab' })

    expect(notCancelled).toBe(true) // no preventDefault
    expect(document.activeElement).toBe(copyNew())
  })

  it('ignores non-Tab keys', () => {
    render(<WebhookSecretRotationDialog {...makeProps()} />)
    const last = screen.getByRole('button', { name: /confirm rotation/i })
    last.focus()

    const notCancelled = fireEvent.keyDown(document, { key: 'a' })

    expect(notCancelled).toBe(true)
    expect(document.activeElement).toBe(last)
  })

  it('restores focus to the previously focused element when it closes', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'open rotation'
    document.body.appendChild(trigger)

    try {
      trigger.focus()
      const props = makeProps()
      const { rerender } = render(<WebhookSecretRotationDialog {...props} />)
      act(() => {
        vi.advanceTimersByTime(10)
      })
      expect(document.activeElement).toBe(screen.getByRole('dialog'))

      rerender(<WebhookSecretRotationDialog {...props} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(document.activeElement).toBe(trigger)
    } finally {
      trigger.remove()
    }
  })

  it('does not register an Escape handler while closed', () => {
    const onClose = vi.fn()
    render(<WebhookSecretRotationDialog {...makeProps({ open: false, onClose })} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('WebhookSecretRotationDialog — grace-period countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('ticks down once per second', () => {
    render(<WebhookSecretRotationDialog {...makeProps()} />)
    const value = document.querySelector('.wsr-countdown-value')!
    const before = value.textContent

    expect(before).toMatch(/^\d{2}:\d{2}:\d{2}$/)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(value.textContent).not.toBe(before)
    expect(value.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it('clamps a past deadline to zero and reports expiry', () => {
    const expired = { ...oldSecret, expiresAt: new Date(Date.now() - 60_000).toISOString() }
    render(<WebhookSecretRotationDialog {...makeProps({ oldSecret: expired })} />)

    expect(screen.getByText('Old secret has expired')).toBeInTheDocument()
    expect(screen.queryByText(/^\d{2}:\d{2}:\d{2}$/)).not.toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', expect.stringMatching(/expired/i))

    // Advancing time must not resurrect a countdown.
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('Old secret has expired')).toBeInTheDocument()
  })

  it('treats a deadline of exactly "now" as already expired', () => {
    const exactlyNow = { ...oldSecret, expiresAt: new Date(Date.now()).toISOString() }
    render(<WebhookSecretRotationDialog {...makeProps({ oldSecret: exactlyNow })} />)

    expect(screen.getByText('Old secret has expired')).toBeInTheDocument()
  })

  it('shows "Not yet used" for an old secret that has never been used', () => {
    const unused = { ...oldSecret, lastUsedAt: null }
    render(<WebhookSecretRotationDialog {...makeProps({ oldSecret: unused })} />)

    expect(screen.getAllByText('Not yet used')).toHaveLength(2)
    expect(screen.queryByText(/last used/i)).not.toBeInTheDocument()
  })
})