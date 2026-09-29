/**
 * Behaviour tests for `src/test/setup.ts`, the Vitest setup file that
 * `test.setupFiles` loads for every suite in this repository.
 *
 * The module exports nothing, so its whole public contract is the environment
 * it installs at import time. That contract is asserted two ways:
 *
 * 1. The live contract — the globals the rest of the suite already consumes,
 *    exercised through the same values production code would use.
 * 2. The install decisions — every polyfill sits behind an
 *    `if (typeof ... === 'undefined')` guard, so the module is re-evaluated
 *    against controlled environments to pin both sides of all four guards.
 *
 * No production code is changed by this suite.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// ─── Collection-time harness ─────────────────────────────────────────────────
// setup.ts calls `afterEach(cleanup)` at import time, so it may only be
// evaluated while this file is being collected — exactly how Vitest itself
// loads `setupFiles`. Re-evaluating it from inside a test body would register
// hooks mid-run, so all three re-evaluations happen here at module scope and
// the tests below assert on the captured results.

type Environment = {
  ResizeObserver: unknown
  IntersectionObserver: unknown
  matchMedia: unknown
  scrollIntoView: unknown
}

type GlobalKey = 'ResizeObserver' | 'IntersectionObserver' | 'matchMedia'

/** Reads the four values setup.ts is responsible for. */
function readEnvironment(): Environment {
  return {
    ResizeObserver: globalThis.ResizeObserver,
    IntersectionObserver: globalThis.IntersectionObserver,
    matchMedia: window.matchMedia,
    scrollIntoView: Element.prototype.scrollIntoView,
  }
}

/**
 * Defines `key` on both the global object and `window`. jsdom exposes two
 * distinct objects here and setup.ts mixes them — the observer guards read the
 * bare global, the matchMedia guard reads `window.matchMedia` — so the harness
 * keeps both in step.
 */
function setGlobal(key: GlobalKey, value: unknown): void {
  const targets = [globalThis, window] as unknown as Array<Record<string, unknown>>
  for (const target of targets) {
    Object.defineProperty(target, key, { value, configurable: true, writable: true })
  }
}

function setScrollIntoView(value: unknown): void {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    value,
    configurable: true,
    writable: true,
  })
}

function restoreEnvironment(environment: Environment): void {
  setGlobal('ResizeObserver', environment.ResizeObserver)
  setGlobal('IntersectionObserver', environment.IntersectionObserver)
  setGlobal('matchMedia', environment.matchMedia)
  setScrollIntoView(environment.scrollIntoView)
}

/**
 * Re-evaluates setup.ts from a clean module registry against a controlled
 * environment and returns the four values it left behind. The real
 * environment is always restored, even if the import throws.
 *
 * This depends on `vi.resetModules()` forcing re-evaluation rather than serving
 * the cached module; if that ever stops holding, "installs all four shims when
 * the environment provides none of them" is the test that fails first.
 */
async function evaluateSetupWith(configure: () => void): Promise<Environment> {
  const original = readEnvironment()
  try {
    configure()
    vi.resetModules()
    await import('./setup')
    return readEnvironment()
  } finally {
    restoreEnvironment(original)
  }
}

/** The environment as it looks to jsdom, which implements none of the four APIs. */
function clearEnvironment(): void {
  setGlobal('ResizeObserver', undefined)
  setGlobal('IntersectionObserver', undefined)
  setGlobal('matchMedia', undefined)
  setScrollIntoView(undefined)
}

/** Stand-ins for an environment that already implements the four APIs. */
class ExistingResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class ExistingIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
  root: Element | Document | null = null
  rootMargin = ''
  thresholds: ReadonlyArray<number> = []
}

const existingMatchMedia = () =>
  ({ matches: true, media: 'existing' }) as unknown as MediaQueryList

const existingScrollIntoView = () => 'existing-scroll-into-view'

/** The live, already-patched environment, captured before any re-evaluation. */
const LIVE = readEnvironment()

/** setup.ts run against an empty environment: every guard should install. */
const INSTALLED = await evaluateSetupWith(clearEnvironment)

/** setup.ts run against a fully populated environment: no guard should fire. */
const PRESERVED = await evaluateSetupWith(() => {
  setGlobal('ResizeObserver', ExistingResizeObserver)
  setGlobal('IntersectionObserver', ExistingIntersectionObserver)
  setGlobal('matchMedia', existingMatchMedia)
  setScrollIntoView(existingScrollIntoView)
})

/** setup.ts run against the environment it already patched: fully idempotent. */
const REPEATED = await evaluateSetupWith(() => {})

/**
 * The matchMedia polyfill only installed into an empty environment, because
 * jsdom implements `window.matchMedia` itself. Its behaviour is therefore
 * asserted against this captured copy, which is the only way to reach it.
 */
const matchMediaPolyfill = INSTALLED.matchMedia as (query: string) => MediaQueryList

/** Representative queries a consumer can pass, valid and malformed alike. */
const VALID_QUERIES = [
  '(prefers-reduced-motion: reduce)',
  'screen and (min-width: 1024px)',
  '(prefers-color-scheme: dark)',
]

const INVALID_QUERIES = ['', '   ', 'not-a-media-query', 'screen and (min-width: )', '(((']

// ─── The environment the rest of the suite inherits ──────────────────────────

describe('setup.ts environment contract', () => {
  it('provides the four browser APIs the suite depends on', () => {
    expect(typeof globalThis.ResizeObserver).toBe('function')
    expect(typeof globalThis.IntersectionObserver).toBe('function')
    expect(typeof window.matchMedia).toBe('function')
    expect(typeof Element.prototype.scrollIntoView).toBe('function')
  })

  it('registers the jest-dom matchers on the global expect', () => {
    const element = document.createElement('span')

    expect(element).not.toBeInTheDocument()
    document.body.appendChild(element)
    expect(element).toBeInTheDocument()
    element.remove()
    expect(element).not.toBeInTheDocument()
  })

  it('leaves the live environment untouched after re-evaluating the module', () => {
    const after = readEnvironment()

    expect(after.ResizeObserver).toBe(LIVE.ResizeObserver)
    expect(after.IntersectionObserver).toBe(LIVE.IntersectionObserver)
    expect(after.matchMedia).toBe(LIVE.matchMedia)
    expect(after.scrollIntoView).toBe(LIVE.scrollIntoView)
  })
})

describe('setup.ts afterEach(cleanup)', () => {
  it('keeps the rendered tree available for the whole test that made it', () => {
    render(<p data-testid="setup-cleanup-probe">rendered by the previous test</p>)

    expect(screen.getByTestId('setup-cleanup-probe')).toBeInTheDocument()
  })

  it('has unmounted that tree before the next test starts', () => {
    expect(screen.queryByTestId('setup-cleanup-probe')).toBeNull()
    expect(document.body).toBeEmptyDOMElement()
  })
})

// ─── Install decisions ───────────────────────────────────────────────────────

describe('setup.ts polyfill installation', () => {
  it('installs all four shims when the environment provides none of them', () => {
    expect(typeof INSTALLED.ResizeObserver).toBe('function')
    expect(typeof INSTALLED.IntersectionObserver).toBe('function')
    expect(typeof INSTALLED.matchMedia).toBe('function')
    expect(typeof INSTALLED.scrollIntoView).toBe('function')
  })

  it('defers to an existing ResizeObserver', () => {
    expect(PRESERVED.ResizeObserver).toBe(ExistingResizeObserver)
  })

  it('defers to an existing IntersectionObserver', () => {
    expect(PRESERVED.IntersectionObserver).toBe(ExistingIntersectionObserver)
  })

  it('defers to an existing matchMedia', () => {
    expect(PRESERVED.matchMedia).toBe(existingMatchMedia)
  })

  it('defers to an existing Element.prototype.scrollIntoView', () => {
    expect(PRESERVED.scrollIntoView).toBe(existingScrollIntoView)
  })

  it('is idempotent: re-evaluating a patched environment changes nothing', () => {
    expect(REPEATED.ResizeObserver).toBe(LIVE.ResizeObserver)
    expect(REPEATED.IntersectionObserver).toBe(LIVE.IntersectionObserver)
    expect(REPEATED.matchMedia).toBe(LIVE.matchMedia)
    expect(REPEATED.scrollIntoView).toBe(LIVE.scrollIntoView)
  })
})

// ─── ResizeObserver polyfill ─────────────────────────────────────────────────

describe('ResizeObserver polyfill', () => {
  it('is constructible and exposes the observer interface', () => {
    const observer = new globalThis.ResizeObserver(vi.fn())

    expect(typeof observer.observe).toBe('function')
    expect(typeof observer.unobserve).toBe('function')
    expect(typeof observer.disconnect).toBe('function')
  })

  it('notifies synchronously on observe with no entries and itself as the observer', () => {
    const callback = vi.fn()
    const observer = new globalThis.ResizeObserver(callback)

    observer.observe(document.createElement('div'))

    expect(callback).toHaveBeenCalledTimes(1)
    const [entries, reportedObserver] = callback.mock.calls[0]
    expect(entries).toEqual([])
    expect(reportedObserver).toBe(observer)
  })

  it('notifies on every observe call instead of latching the first one', () => {
    const callback = vi.fn()
    const observer = new globalThis.ResizeObserver(callback)
    const target = document.createElement('div')

    observer.observe(target)
    observer.observe(target)

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('keeps each instance bound to its own callback', () => {
    const first = vi.fn()
    const second = vi.fn()
    const firstObserver = new globalThis.ResizeObserver(first)
    const secondObserver = new globalThis.ResizeObserver(second)
    const target = document.createElement('div')

    firstObserver.observe(target)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()

    secondObserver.observe(target)
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledTimes(1)
  })

  it('treats unobserve and disconnect as no-ops that do not throw', () => {
    const callback = vi.fn()
    const observer = new globalThis.ResizeObserver(callback)

    expect(() => observer.unobserve(document.createElement('div'))).not.toThrow()
    expect(() => observer.disconnect()).not.toThrow()
    expect(callback).not.toHaveBeenCalled()
  })

  it('keeps notifying after unobserve and disconnect, because it tracks no state', () => {
    const callback = vi.fn()
    const observer = new globalThis.ResizeObserver(callback)

    observer.disconnect()
    observer.unobserve(document.createElement('div'))
    observer.observe(document.createElement('div'))

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('ignores the observed target, including a missing or non-element one', () => {
    const callback = vi.fn()
    const observer = new globalThis.ResizeObserver(callback)
    const observe = observer.observe.bind(observer) as unknown as (...args: unknown[]) => void

    expect(() => observe()).not.toThrow()
    expect(() => observe(null)).not.toThrow()
    expect(() => observe({ not: 'an element' })).not.toThrow()
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('propagates an error thrown by the callback instead of swallowing it', () => {
    const observer = new globalThis.ResizeObserver(() => {
      throw new Error('resize handler exploded')
    })

    expect(() => observer.observe(document.createElement('div'))).toThrow(
      'resize handler exploded',
    )
  })
})

// ─── IntersectionObserver polyfill ────────────────────────────────────────────

describe('IntersectionObserver polyfill', () => {
  it('is constructible and exposes the observer interface', () => {
    const observer = new globalThis.IntersectionObserver(vi.fn())

    expect(typeof observer.observe).toBe('function')
    expect(typeof observer.unobserve).toBe('function')
    expect(typeof observer.disconnect).toBe('function')
    expect(typeof observer.takeRecords).toBe('function')
  })

  it('notifies synchronously on observe with no entries and itself as the observer', () => {
    const callback = vi.fn()
    const observer = new globalThis.IntersectionObserver(callback)

    observer.observe(document.createElement('div'))

    expect(callback).toHaveBeenCalledTimes(1)
    const [entries, reportedObserver] = callback.mock.calls[0]
    expect(entries).toEqual([])
    expect(reportedObserver).toBe(observer)
  })

  it('exposes the documented defaults for root, rootMargin and thresholds', () => {
    const observer = new globalThis.IntersectionObserver(vi.fn())

    expect(observer.root).toBeNull()
    expect(observer.rootMargin).toBe('')
    expect(observer.thresholds).toEqual([])
  })

  it('queues no records, and hands back a fresh array each call', () => {
    const observer = new globalThis.IntersectionObserver(vi.fn())

    const first = observer.takeRecords()
    expect(first).toEqual([])

    first.push({} as IntersectionObserverEntry)
    expect(observer.takeRecords()).toEqual([])
  })

  it('notifies on every observe call instead of latching the first one', () => {
    const callback = vi.fn()
    const observer = new globalThis.IntersectionObserver(callback)
    const target = document.createElement('div')

    observer.observe(target)
    observer.observe(target)

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('keeps each instance bound to its own callback', () => {
    const first = vi.fn()
    const second = vi.fn()
    const firstObserver = new globalThis.IntersectionObserver(first)
    const secondObserver = new globalThis.IntersectionObserver(second)
    const target = document.createElement('div')

    firstObserver.observe(target)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()

    secondObserver.observe(target)
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledTimes(1)
  })

  it('treats unobserve and disconnect as no-ops that do not throw', () => {
    const callback = vi.fn()
    const observer = new globalThis.IntersectionObserver(callback)

    expect(() => observer.unobserve(document.createElement('div'))).not.toThrow()
    expect(() => observer.disconnect()).not.toThrow()
    expect(callback).not.toHaveBeenCalled()
  })

  it('keeps notifying after unobserve and disconnect, because it tracks no state', () => {
    const callback = vi.fn()
    const observer = new globalThis.IntersectionObserver(callback)

    observer.disconnect()
    observer.unobserve(document.createElement('div'))
    observer.observe(document.createElement('div'))

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('ignores the observed target, including a missing or non-element one', () => {
    const callback = vi.fn()
    const observer = new globalThis.IntersectionObserver(callback)
    const observe = observer.observe.bind(observer) as unknown as (...args: unknown[]) => void

    expect(() => observe()).not.toThrow()
    expect(() => observe(null)).not.toThrow()
    expect(() => observe({ not: 'an element' })).not.toThrow()
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('propagates an error thrown by the callback instead of swallowing it', () => {
    const observer = new globalThis.IntersectionObserver(() => {
      throw new Error('intersection handler exploded')
    })

    expect(() => observer.observe(document.createElement('div'))).toThrow(
      'intersection handler exploded',
    )
  })
})

// ─── scrollIntoView polyfill ─────────────────────────────────────────────────

describe('scrollIntoView polyfill', () => {
  it('is installed on the prototype, so elements inherit it', () => {
    const element = document.createElement('span')

    expect(typeof element.scrollIntoView).toBe('function')
    expect(element.scrollIntoView).toBe(Element.prototype.scrollIntoView)
  })

  it('is a no-op that does not throw and returns undefined', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)

    expect(element.scrollIntoView()).toBeUndefined()
    expect(() => element.scrollIntoView({ behavior: 'smooth', block: 'center' })).not.toThrow()
    expect(() => element.scrollIntoView(true)).not.toThrow()
    expect(() => element.scrollIntoView(false)).not.toThrow()

    element.remove()
  })

  it('is safe on a detached element that is not in the document', () => {
    const detached = document.createElement('div')

    expect(() => detached.scrollIntoView()).not.toThrow()
  })

  it('is safe on non-HTML element types', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

    expect(() => svg.scrollIntoView()).not.toThrow()
  })
})

// ─── matchMedia polyfill ─────────────────────────────────────────────────────

describe('matchMedia polyfill', () => {
  it('installs a callable factory returning a MediaQueryList-shaped object', () => {
    expect(typeof INSTALLED.matchMedia).toBe('function')

    const list = matchMediaPolyfill('(min-width: 768px)')
    expect(typeof list.matches).toBe('boolean')
    expect(typeof list.addEventListener).toBe('function')
    expect(typeof list.removeEventListener).toBe('function')
    expect(typeof list.addListener).toBe('function')
    expect(typeof list.removeListener).toBe('function')
    expect(typeof list.dispatchEvent).toBe('function')
  })

  it('reports no match and echoes the query back', () => {
    const list = matchMediaPolyfill('(prefers-reduced-motion: reduce)')

    expect(list.matches).toBe(false)
    expect(list.media).toBe('(prefers-reduced-motion: reduce)')
    expect(list.onchange).toBeNull()
  })

  for (const query of VALID_QUERIES) {
    it(`never matches the valid query ${JSON.stringify(query)}`, () => {
      const list = matchMediaPolyfill(query)

      expect(list.matches).toBe(false)
      expect(list.media).toBe(query)
    })
  }

  for (const query of INVALID_QUERIES) {
    it(`tolerates the malformed query ${JSON.stringify(query)} without throwing`, () => {
      expect(() => matchMediaPolyfill(query)).not.toThrow()

      const list = matchMediaPolyfill(query)
      expect(list.matches).toBe(false)
      expect(list.media).toBe(query)
    })
  }

  it('returns a distinct list per call, so state cannot leak between consumers', () => {
    const first = matchMediaPolyfill('(min-width: 768px)')
    const second = matchMediaPolyfill('(min-width: 768px)')

    expect(first).not.toBe(second)
  })

  it('never invokes change listeners through either registration API', () => {
    const list = matchMediaPolyfill('(min-width: 768px)')
    const viaEventTarget = vi.fn()
    const viaLegacy = vi.fn()

    expect(() => list.addEventListener('change', viaEventTarget)).not.toThrow()
    expect(() => list.addListener(viaLegacy)).not.toThrow()
    expect(() => list.removeEventListener('change', viaEventTarget)).not.toThrow()
    expect(() => list.removeListener(viaLegacy)).not.toThrow()

    expect(list.dispatchEvent(new Event('change'))).toBe(false)
    expect(viaEventTarget).not.toHaveBeenCalled()
    expect(viaLegacy).not.toHaveBeenCalled()
    expect(list.onchange).toBeNull()
  })

  it('tolerates listeners registered with no arguments at all', () => {
    const unbound = matchMediaPolyfill('(min-width: 768px)') as unknown as {
      addEventListener: () => void
      removeEventListener: () => void
      addListener: () => void
      removeListener: () => void
    }

    expect(() => unbound.addEventListener()).not.toThrow()
    expect(() => unbound.removeEventListener()).not.toThrow()
    expect(() => unbound.addListener()).not.toThrow()
    expect(() => unbound.removeListener()).not.toThrow()
  })

  it('tolerates being called with no query, mirroring the omission as undefined', () => {
    const factory = matchMediaPolyfill as (query?: string) => MediaQueryList

    expect(() => factory()).not.toThrow()

    const list = factory()
    expect(list.matches).toBe(false)
    expect(list.media).toBeUndefined()
  })
})
