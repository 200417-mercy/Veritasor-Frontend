import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

describe('usePrefersReducedMotion', () => {
  let originalWindow: Window & typeof globalThis

  beforeEach(() => {
    originalWindow = global.window
  })

  afterEach(() => {
    global.window = originalWindow
    vi.restoreAllMocks()
  })

  it('returns false when window is undefined (SSR)', () => {
    // @ts-expect-error simulating SSR
    delete global.window

    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true when media query matches', () => {
    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    
    vi.stubGlobal('matchMedia', matchMediaMock)

    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(true)
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('returns false when media query does not match', () => {
    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    
    vi.stubGlobal('matchMedia', matchMediaMock)

    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
  })

  it('updates when media query matches change', () => {
    let changeListener: ((event: { matches: boolean }) => void) | null = null

    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn((event, listener) => {
        if (event === 'change') {
          changeListener = listener
        }
      }),
      removeEventListener: vi.fn((event, listener) => {
        if (event === 'change' && changeListener === listener) {
          changeListener = null
        }
      }),
      dispatchEvent: vi.fn(),
    }))
    
    vi.stubGlobal('matchMedia', matchMediaMock)

    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)

    // Simulate change
    matchMediaMock.mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    
    if (changeListener) {
      // Trigger the listener to tell React to re-evaluate
      (changeListener as any)({ matches: true })
    }

    expect(result.current).toBe(true)
  })
})
