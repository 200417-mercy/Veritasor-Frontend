import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest'
import { useViewportObserver, UseViewportObserverOptions } from './useViewportObserver'

describe('useViewportObserver', () => {
  let mockIntersectionObserver: Mock
  let mockObserve: Mock
  let mockUnobserve: Mock
  let mockDisconnect: Mock
  let mockMatchMedia: Mock
  let intersectionCallback: IntersectionObserverCallback

  beforeEach(() => {
    mockObserve = vi.fn()
    mockUnobserve = vi.fn()
    mockDisconnect = vi.fn()

    mockIntersectionObserver = vi.fn((callback, options) => {
      intersectionCallback = callback
      return {
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: mockDisconnect,
        root: null,
        rootMargin: options?.rootMargin || '',
        thresholds: Array.isArray(options?.threshold) ? options.threshold : [options?.threshold || 0],
        takeRecords: vi.fn(),
      }
    })

    vi.stubGlobal('IntersectionObserver', mockIntersectionObserver)

    mockMatchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    vi.stubGlobal('matchMedia', mockMatchMedia)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function renderViewportHook(options?: UseViewportObserverOptions) {
    const div = document.createElement('div')
    return renderHook(() => {
      const hookResult = useViewportObserver(options)
      if (!hookResult.ref.current) {
        // @ts-expect-error - simulate React assigning the ref before useEffect runs
        hookResult.ref.current = div
      }
      return { ...hookResult, div }
    })
  }

  it('initializes with isVisible as false and sets up observer', () => {
    const { result } = renderViewportHook()
    expect(result.current.isVisible).toBe(false)
    expect(mockIntersectionObserver).toHaveBeenCalledTimes(1)
    expect(mockObserve).toHaveBeenCalledWith(result.current.div)
  })

  it('does nothing if ref is null when effect runs', () => {
    // Render without assigning the ref
    const { result } = renderHook(() => useViewportObserver())
    expect(result.current.isVisible).toBe(false)
    expect(mockIntersectionObserver).not.toHaveBeenCalled()
  })

  it('cleans up observer on unmount', () => {
    const { unmount } = renderViewportHook()
    unmount()
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it('updates isVisible to true when element intersects (once: true default)', () => {
    const { result } = renderViewportHook()
    
    act(() => {
      intersectionCallback([{ isIntersecting: true, target: result.current.div } as unknown as IntersectionObserverEntry], mockIntersectionObserver.mock.results[0].value)
    })
    
    expect(result.current.isVisible).toBe(true)
    expect(mockUnobserve).toHaveBeenCalledWith(result.current.div)
  })

  it('does not unobserve when once is false', () => {
    const { result } = renderViewportHook({ once: false })
    
    act(() => {
      intersectionCallback([{ isIntersecting: true, target: result.current.div } as unknown as IntersectionObserverEntry], mockIntersectionObserver.mock.results[0].value)
    })
    
    expect(result.current.isVisible).toBe(true)
    expect(mockUnobserve).not.toHaveBeenCalled()
  })

  it('updates isVisible back to false when element leaves viewport and once is false', () => {
    const { result } = renderViewportHook({ once: false })
    
    act(() => {
      intersectionCallback([{ isIntersecting: true, target: result.current.div } as unknown as IntersectionObserverEntry], mockIntersectionObserver.mock.results[0].value)
    })
    expect(result.current.isVisible).toBe(true)
    
    act(() => {
      intersectionCallback([{ isIntersecting: false, target: result.current.div } as unknown as IntersectionObserverEntry], mockIntersectionObserver.mock.results[0].value)
    })
    expect(result.current.isVisible).toBe(false)
  })

  it('does not update isVisible to false when element leaves viewport if once is true', () => {
    const { result } = renderViewportHook({ once: true })
    
    act(() => {
      intersectionCallback([{ isIntersecting: true, target: result.current.div } as unknown as IntersectionObserverEntry], mockIntersectionObserver.mock.results[0].value)
    })
    expect(result.current.isVisible).toBe(true)
    
    act(() => {
      intersectionCallback([{ isIntersecting: false, target: result.current.div } as unknown as IntersectionObserverEntry], mockIntersectionObserver.mock.results[0].value)
    })
    // Still true
    expect(result.current.isVisible).toBe(true)
  })

  it('immediately sets isVisible to true and skips observation if prefers-reduced-motion is active', () => {
    mockMatchMedia.mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    }))
    
    const { result } = renderViewportHook()
    
    expect(result.current.isVisible).toBe(true)
    expect(mockIntersectionObserver).not.toHaveBeenCalled()
  })

  it('passes custom threshold and rootMargin to IntersectionObserver', () => {
    renderViewportHook({ threshold: 0.5, rootMargin: '10px' })
    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.5, rootMargin: '10px' })
    )
  })

  it('handles invalid inputs gracefully (e.g. empty options object)', () => {
    const { result } = renderViewportHook({})
    expect(result.current.isVisible).toBe(false)
    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.1, rootMargin: '0px' }) // Verify defaults
    )
  })
})
