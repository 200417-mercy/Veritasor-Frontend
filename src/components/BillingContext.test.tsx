import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BillingProvider, useBilling } from './BillingContext'
import FailedPaymentBanner from './FailedPaymentBanner'
import type { FailedPaymentInfo } from './FailedPaymentBanner'

/**
 * The public surface `useBilling` guarantees, stated once so the assertions do
 * not depend on which of its two branches (provider value vs. inert fallback)
 * produced the object.
 */
type BillingApi = {
  failedPayment: FailedPaymentInfo | null
  setFailedPayment: (f: FailedPaymentInfo | null) => void
  dismissFailedPayment: () => void
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** The record BillingProvider seeds on mount. */
const SEED: FailedPaymentInfo = {
  id: 'fp_001',
  invoiceId: 'inv_005',
  invoicePeriod: 'March 2026',
  amount: 29.0,
  dueDate: '2026-03-15',
  failureReason: 'Card declined',
  lastAttemptAt: '2026-07-28T09:00:00Z',
}

/** A second well-formed record used to assert replacement/transition behaviour. */
const RETRY: FailedPaymentInfo = {
  id: 'fp_002',
  invoiceId: 'inv_006',
  invoicePeriod: 'April 2026',
  amount: 149.5,
  dueDate: '2026-04-15',
  failureReason: 'Insufficient funds',
  lastAttemptAt: '2026-08-02T11:30:00Z',
}

/** Last context object handed to a recorder component. */
const lastOf = (renders: BillingApi[]) => renders[renders.length - 1] as BillingApi

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Renders the observable shape of the context value as text. */
function Probe() {
  const { failedPayment } = useBilling()
  return (
    <div>
      <span data-testid="presence">{failedPayment ? 'present' : 'absent'}</span>
      <span data-testid="failure-id">{failedPayment?.id ?? 'none'}</span>
    </div>
  )
}

/** Records the context object for every committed render, and nothing else. */
function useRecorder(renders: BillingApi[]) {
  const api = useBilling()
  useEffect(() => {
    renders.push(api)
  })
}

/**
 * Mounts BillingProvider with a recorder so assertions can inspect the exact
 * context object of every committed render, and returns handles to it.
 */
function renderProvider(ui: ReactNode = <Probe />, options: { router?: boolean } = {}) {
  const renders: BillingApi[] = []

  function Capture() {
    useRecorder(renders)
    return null
  }

  const tree = (
    <BillingProvider>
      <Capture />
      {ui}
    </BillingProvider>
  )

  render(options.router ? <MemoryRouter>{tree}</MemoryRouter> : tree)

  return { latest: () => lastOf(renders), renders: () => renders }
}

/** Mounts useBilling with no provider in the tree and records the fallback value. */
function renderOrphaned() {
  const renders: BillingApi[] = []

  function Capture() {
    useRecorder(renders)
    return null
  }

  render(<Capture />)

  return { latest: () => lastOf(renders), renders: () => renders }
}

/**
 * Mirrors the `BillingBannerSlot` consumer in Layout.tsx and drives the real
 * FailedPaymentBanner, so context transitions are observed through the UI that
 * actually ships. The extra controls exercise the context API without tripping
 * the banner's own internal "dismissed" latch, which keeps re-publishing
 * observable after a dismissal.
 */
function BillingScreen() {
  const { failedPayment, setFailedPayment, dismissFailedPayment } = useBilling()
  return (
    <div>
      <FailedPaymentBanner failure={failedPayment} onDismiss={dismissFailedPayment} />
      <button type="button" onClick={dismissFailedPayment}>
        Dismiss notice
      </button>
      <button type="button" onClick={() => setFailedPayment(RETRY)}>
        Report new failure
      </button>
      <button type="button" onClick={() => setFailedPayment(null)}>
        Mark billing healthy
      </button>
    </div>
  )
}

// ─── Seeded state ─────────────────────────────────────────────────────────────

describe('BillingProvider — seeded state', () => {
  it('seeds a default failed payment record on mount', () => {
    const { latest } = renderProvider()

    expect(latest().failedPayment).toEqual(SEED)
  })

  it('exposes only the documented context surface', () => {
    const api = renderProvider().latest()

    expect(Object.keys(api).sort()).toEqual([
      'dismissFailedPayment',
      'failedPayment',
      'setFailedPayment',
    ])
    expect(typeof api.setFailedPayment).toBe('function')
    expect(typeof api.dismissFailedPayment).toBe('function')
  })

  it('renders every child and shares a single state between them', () => {
    function FirstConsumer() {
      const { setFailedPayment } = useBilling()
      return (
        <button type="button" onClick={() => setFailedPayment(RETRY)}>
          Publish
        </button>
      )
    }

    const { latest } = renderProvider(
      <>
        <FirstConsumer />
        <Probe />
        <Probe />
      </>,
    )

    expect(screen.getAllByTestId('failure-id')).toHaveLength(2)
    expect(screen.getAllByTestId('failure-id')[0]).toHaveTextContent('fp_001')

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))

    expect(latest().failedPayment).toBe(RETRY)
    for (const node of screen.getAllByTestId('failure-id')) {
      expect(node).toHaveTextContent('fp_002')
    }
  })

  it('renders without throwing when no children are supplied', () => {
    expect(() => render(<BillingProvider>{null}</BillingProvider>)).not.toThrow()
  })
})

// ─── Primary state transitions ────────────────────────────────────────────────

describe('BillingProvider — setFailedPayment', () => {
  it('replaces the seeded record with the supplied failure', () => {
    const { latest } = renderProvider()

    act(() => {
      latest().setFailedPayment(RETRY)
    })

    expect(latest().failedPayment).toBe(RETRY)
    expect(screen.getByTestId('failure-id')).toHaveTextContent('fp_002')
  })

  it('clears the record when called with null', () => {
    const { latest } = renderProvider()

    act(() => {
      latest().setFailedPayment(null)
    })

    expect(latest().failedPayment).toBeNull()
    expect(screen.getByTestId('presence')).toHaveTextContent('absent')
  })

  it('re-publishes a failure after it has been dismissed', () => {
    const { latest } = renderProvider()

    act(() => {
      latest().dismissFailedPayment()
    })
    expect(latest().failedPayment).toBeNull()

    act(() => {
      latest().setFailedPayment(RETRY)
    })

    expect(latest().failedPayment).toBe(RETRY)
    expect(screen.getByTestId('presence')).toHaveTextContent('present')
  })

  it('stores the record by reference without mutating it', () => {
    const frozen = Object.freeze({ ...RETRY }) as unknown as FailedPaymentInfo
    const { latest } = renderProvider()

    expect(() => {
      act(() => {
        latest().setFailedPayment(frozen)
      })
    }).not.toThrow()

    expect(latest().failedPayment).toBe(frozen)
    expect(latest().failedPayment).toEqual(RETRY)
  })
})

describe('BillingProvider — dismissFailedPayment', () => {
  it('clears the published record', () => {
    function DismissButton() {
      const { dismissFailedPayment } = useBilling()
      return (
        <button type="button" onClick={dismissFailedPayment}>
          Dismiss
        </button>
      )
    }

    const { latest } = renderProvider(<DismissButton />)
    expect(latest().failedPayment).toEqual(SEED)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(latest().failedPayment).toBeNull()
    expect(screen.getByTestId('failure-id')).toHaveTextContent('none')
  })

  it('is idempotent when nothing is published', () => {
    const { latest } = renderProvider()

    act(() => {
      latest().setFailedPayment(null)
    })

    expect(() => {
      act(() => {
        latest().dismissFailedPayment()
        latest().dismissFailedPayment()
      })
    }).not.toThrow()

    expect(latest().failedPayment).toBeNull()
  })

  it('leaves setFailedPayment usable after a dismissal', () => {
    const { latest } = renderProvider()

    act(() => {
      latest().dismissFailedPayment()
    })
    act(() => {
      latest().setFailedPayment(RETRY)
    })
    act(() => {
      latest().dismissFailedPayment()
    })

    expect(latest().failedPayment).toBeNull()
  })
})

describe('BillingProvider — referential stability', () => {
  it('keeps the mutators stable across re-renders', () => {
    const { latest, renders } = renderProvider()

    act(() => {
      latest().setFailedPayment(RETRY)
    })
    act(() => {
      latest().dismissFailedPayment()
    })

    const captured = renders()
    expect(captured.length).toBeGreaterThanOrEqual(3)
    for (const api of captured) {
      expect(api.setFailedPayment).toBe(captured[0].setFailedPayment)
      expect(api.dismissFailedPayment).toBe(captured[0].dismissFailedPayment)
    }
  })
})

// ─── useBilling outside a provider ────────────────────────────────────────────

// useBilling deliberately degrades to an inert, error-free fallback when no
// BillingProvider is mounted (Layout.tsx relies on this so a partially mounted
// shell cannot throw). The suite pins that down as a contract, not an accident.
describe('useBilling — outside BillingProvider', () => {
  it('does not throw when no provider is mounted', () => {
    expect(() => render(<Probe />)).not.toThrow()
  })

  it('reports no failed payment', () => {
    expect(renderOrphaned().latest().failedPayment).toBeNull()
  })

  it('still returns a fully callable API surface', () => {
    const api = renderOrphaned().latest()

    expect(Object.keys(api).sort()).toEqual([
      'dismissFailedPayment',
      'failedPayment',
      'setFailedPayment',
    ])
    expect(typeof api.setFailedPayment).toBe('function')
    expect(typeof api.dismissFailedPayment).toBe('function')
  })

  it('treats setFailedPayment as an inert no-op', () => {
    const { latest, renders } = renderOrphaned()
    const api = latest()

    expect(() => {
      api.setFailedPayment(RETRY)
    }).not.toThrow()

    expect(api.failedPayment).toBeNull()
    expect(renders()).toHaveLength(1)
  })

  it('treats dismissFailedPayment as an inert no-op', () => {
    const { latest, renders } = renderOrphaned()
    const api = latest()

    expect(() => {
      api.dismissFailedPayment()
    }).not.toThrow()

    expect(api.failedPayment).toBeNull()
    expect(renders()).toHaveLength(1)
  })
})

// ─── Nested providers ─────────────────────────────────────────────────────────

describe('BillingProvider — nested providers', () => {
  function renderNested() {
    const seen: { outer?: BillingApi; inner?: BillingApi } = {}

    function OuterProbe() {
      const api = useBilling()
      useEffect(() => {
        seen.outer = api
      })
      return <span data-testid="outer">{api.failedPayment?.id ?? 'none'}</span>
    }

    function InnerProbe() {
      const api = useBilling()
      useEffect(() => {
        seen.inner = api
      })
      return <span data-testid="inner">{api.failedPayment?.id ?? 'none'}</span>
    }

    render(
      <BillingProvider>
        <OuterProbe />
        <BillingProvider>
          <InnerProbe />
        </BillingProvider>
      </BillingProvider>,
    )

    return {
      outer: () => seen.outer as BillingApi,
      inner: () => seen.inner as BillingApi,
    }
  }

  it('resolves the value from the nearest provider', () => {
    renderNested()

    expect(screen.getByTestId('outer')).toHaveTextContent('fp_001')
    expect(screen.getByTestId('inner')).toHaveTextContent('fp_001')
  })

  it('isolates a publish inside the inner provider', () => {
    const nested = renderNested()

    act(() => {
      nested.inner().setFailedPayment(RETRY)
    })

    expect(screen.getByTestId('inner')).toHaveTextContent('fp_002')
    expect(screen.getByTestId('outer')).toHaveTextContent('fp_001')
    expect(nested.outer().failedPayment).toEqual(SEED)
  })

  it('isolates a dismissal inside the inner provider', () => {
    const nested = renderNested()

    act(() => {
      nested.inner().dismissFailedPayment()
    })

    expect(screen.getByTestId('inner')).toHaveTextContent('none')
    expect(screen.getByTestId('outer')).toHaveTextContent('fp_001')
    expect(nested.outer().failedPayment).toEqual(SEED)
  })
})

// ─── Invalid and boundary inputs ──────────────────────────────────────────────

describe('BillingProvider — invalid and boundary inputs', () => {
  it('stores a malformed record verbatim instead of throwing', () => {
    const { latest } = renderProvider()
    const malformed = { id: 'fp_003' } as unknown as FailedPaymentInfo

    expect(() => {
      act(() => {
        latest().setFailedPayment(malformed)
      })
    }).not.toThrow()

    expect(latest().failedPayment).toBe(malformed)
    expect(screen.getByTestId('failure-id')).toHaveTextContent('fp_003')
  })

  it('treats undefined as "no failure" instead of throwing', () => {
    const { latest } = renderProvider()

    expect(() => {
      act(() => {
        latest().setFailedPayment(undefined as unknown as FailedPaymentInfo | null)
      })
    }).not.toThrow()

    expect(latest().failedPayment).toBeUndefined()
    expect(screen.getByTestId('presence')).toHaveTextContent('absent')
  })

  it('accepts a non-object payload verbatim (no runtime validation)', () => {
    const { latest } = renderProvider()
    // Deliberately defeats the FailedPaymentInfo type: the provider is a thin
    // pass-through, so the raw value must survive without throwing.
    const payload = 'card-declined' as unknown as FailedPaymentInfo

    expect(() => {
      act(() => {
        latest().setFailedPayment(payload)
      })
    }).not.toThrow()

    expect(latest().failedPayment).toBe(payload)
    expect(typeof latest().failedPayment).toBe('string')
  })

  it('never logs a React error while handling malformed input', () => {
    const { latest } = renderProvider()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    act(() => {
      latest().setFailedPayment({ id: 'fp_004' } as unknown as FailedPaymentInfo)
    })
    act(() => {
      latest().setFailedPayment(undefined as unknown as FailedPaymentInfo | null)
    })
    act(() => {
      latest().setFailedPayment(RETRY)
    })

    expect(errorSpy).not.toHaveBeenCalled()
  })
})

// ─── Integration with the production consumer ─────────────────────────────────

describe('BillingProvider — FailedPaymentBanner integration', () => {
  const notice = () => screen.queryByRole('region', { name: 'Payment failure notice' })

  it('renders the failure notice for the seeded record', () => {
    const { latest } = renderProvider(<BillingScreen />, { router: true })

    expect(latest().failedPayment).toEqual(SEED)
    expect(notice()).toBeInTheDocument()
    expect(screen.getByText('Payment failed')).toBeInTheDocument()
    expect(screen.getByText(/\$29\.00/)).toBeInTheDocument()
    expect(screen.getByText(/inv_005/)).toBeInTheDocument()
  })

  it('clears the record and removes the notice when the notice is dismissed', () => {
    const { latest } = renderProvider(<BillingScreen />, { router: true })

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss payment failure notice' }))

    expect(latest().failedPayment).toBeNull()
    expect(notice()).not.toBeInTheDocument()
  })

  it('hides the notice once the record is cleared directly', () => {
    const { latest } = renderProvider(<BillingScreen />, { router: true })

    fireEvent.click(screen.getByRole('button', { name: 'Mark billing healthy' }))

    expect(latest().failedPayment).toBeNull()
    expect(notice()).not.toBeInTheDocument()
  })

  it('re-publishes the notice after a context-driven dismissal', () => {
    renderProvider(<BillingScreen />, { router: true })

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
    expect(notice()).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Report new failure' }))

    expect(notice()).toBeInTheDocument()
    expect(screen.getByText(/\$149\.50/)).toBeInTheDocument()
    expect(screen.getByText(/inv_006/)).toBeInTheDocument()
  })
})
