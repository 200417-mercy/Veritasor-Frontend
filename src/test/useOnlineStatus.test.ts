import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useOnlineStatus, type OnlineStatus } from '../hooks/useOnlineStatus'

/**
 * Render the hook with a deterministic navigator stub.
 * Returns the standard renderHook result plus a helper to flip the stubbed
 * `navigator.onLine` flag for tests that exercise environment changes.
 */
function renderOnlineHook(apiBaseUrl?: string) {
  return renderHook((props: { url?: string } = {}) => useOnlineStatus(props.url), {
    initialProps: apiBaseUrl !== undefined ? { url: apiBaseUrl } : {},
  })
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('public contract', () => {
    it('exposes the OnlineStatus shape: boolean isOnline and callable retry', () => {
      vi.stubGlobal('navigator', { onLine: true })
      const { result } = renderOnlineHook()

      const status: OnlineStatus = result.current

      expect(typeof status.isOnline).toBe('boolean')
      expect(typeof status.retry).toBe('function')
    })

    it('initialises with navigator.onLine = true', () => {
      vi.stubGlobal('navigator', { onLine: true })
      const { result } = renderOnlineHook()

      expect(result.current.isOnline).toBe(true)
    })

    it('initialises with navigator.onLine = false', () => {
      vi.stubGlobal('navigator', { onLine: false })
      const { result } = renderOnlineHook()

      expect(result.current.isOnline).toBe(false)
    })

    it('falls back to online when navigator is unavailable (SSR-safe default)', () => {
      // Directly covers the `typeof navigator !== 'undefined'` guard branch:
      // with no navigator at all the hook must not throw and must default to online.
      vi.stubGlobal('navigator', undefined)
      const { result } = renderOnlineHook()

      expect(result.current.isOnline).toBe(true)
    })

    it('keeps the retry callback identity stable across rerenders with the same apiBaseUrl', () => {
      vi.stubGlobal('navigator', { onLine: true })
      const { result, rerender } = renderOnlineHook('https://api.example.com')

      const first = result.current.retry
      rerender({ url: 'https://api.example.com' })

      expect(result.current.retry).toBe(first)
    })

    it('recreates retry when apiBaseUrl changes and probes the new URL', async () => {
      vi.stubGlobal('navigator', { onLine: false })
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      const { result, rerender } = renderOnlineHook('https://api.example.com')
      const first = result.current.retry

      rerender({ url: 'https://api.example.com/v2' })

      expect(result.current.retry).not.toBe(first)

      await act(async () => {
        await result.current.retry()
      })

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/v2',
        expect.objectContaining({ method: 'HEAD' }),
      )
      expect(result.current.isOnline).toBe(true)
    })
  })

  describe('event-driven state transitions', () => {
    it('sets isOnline to false when the offline event fires', () => {
      vi.stubGlobal('navigator', { onLine: true })
      const { result } = renderOnlineHook()

      act(() => {
        window.dispatchEvent(new Event('offline'))
      })

      expect(result.current.isOnline).toBe(false)
    })

    it('sets isOnline to true when the online event fires', () => {
      vi.stubGlobal('navigator', { onLine: false })
      const { result } = renderOnlineHook()

      act(() => {
        window.dispatchEvent(new Event('online'))
      })

      expect(result.current.isOnline).toBe(true)
    })

    it('follows a full offline → online → offline cycle', () => {
      vi.stubGlobal('navigator', { onLine: true })
      const { result } = renderOnlineHook()

      act(() => {
        window.dispatchEvent(new Event('offline'))
      })
      expect(result.current.isOnline).toBe(false)

      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      expect(result.current.isOnline).toBe(true)

      act(() => {
        window.dispatchEvent(new Event('offline'))
      })
      expect(result.current.isOnline).toBe(false)
    })

    it('is idempotent when the same event fires repeatedly', () => {
      vi.stubGlobal('navigator', { onLine: true })
      const { result } = renderOnlineHook()

      act(() => {
        window.dispatchEvent(new Event('offline'))
        window.dispatchEvent(new Event('offline'))
      })

      expect(result.current.isOnline).toBe(false)

      act(() => {
        window.dispatchEvent(new Event('online'))
        window.dispatchEvent(new Event('online'))
      })

      expect(result.current.isOnline).toBe(true)
    })

    it('cleans up event listeners on unmount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const { unmount } = renderOnlineHook()

      const registeredOnline = addSpy.mock.calls.find(([type]) => type === 'online')?.[1]
      const registeredOffline = addSpy.mock.calls.find(([type]) => type === 'offline')?.[1]

      unmount()

      // The exact handlers registered on mount must be the ones removed –
      // a mismatched reference would leak listeners across mounts.
      expect(removeSpy).toHaveBeenCalledWith('online', registeredOnline)
      expect(removeSpy).toHaveBeenCalledWith('offline', registeredOffline)
      expect(registeredOnline).toBeTypeOf('function')
      expect(registeredOffline).toBeTypeOf('function')
    })

    it('ignores events after unmount (no listener leak)', () => {
      vi.stubGlobal('navigator', { onLine: true })
      const { result, unmount } = renderOnlineHook()

      unmount()

      // Must not throw even though the listeners were removed.
      expect(() => {
        window.dispatchEvent(new Event('offline'))
      }).not.toThrow()
      expect(result.current.isOnline).toBe(true)
    })
  })

  describe('retry', () => {
    it('sets online to true when HEAD probe succeeds', async () => {
      vi.stubGlobal('navigator', { onLine: false })
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
      const { result } = renderOnlineHook('https://api.example.com')

      await act(async () => {
        await result.current.retry()
      })

      expect(result.current.isOnline).toBe(true)
    })

    it('sets online to false when HEAD probe fails', async () => {
      vi.stubGlobal('navigator', { onLine: true })
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
      const { result } = renderOnlineHook('https://api.example.com')

      await act(async () => {
        await result.current.retry()
      })

      expect(result.current.isOnline).toBe(false)
    })

    it('sets online to false when HEAD probe returns non-OK', async () => {
      vi.stubGlobal('navigator', { onLine: true })
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
      const { result } = renderOnlineHook('https://api.example.com')

      await act(async () => {
        await result.current.retry()
      })

      expect(result.current.isOnline).toBe(false)
    })

    it('sets online to false when fetch itself is unavailable in the environment', async () => {
      // Boundary case: a missing global fetch throws synchronously inside the
      // probe; the hook must catch it and report offline instead of crashing.
      vi.stubGlobal('navigator', { onLine: true })
      vi.stubGlobal('fetch', undefined)
      const { result } = renderOnlineHook('https://api.example.com')

      await act(async () => {
        await expect(result.current.retry()).resolves.toBeUndefined()
      })

      expect(result.current.isOnline).toBe(false)
    })

    it('falls back to navigator.onLine when no apiBaseUrl is provided', async () => {
      vi.stubGlobal('navigator', { onLine: true })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const { result } = renderOnlineHook()

      await act(async () => {
        await result.current.retry()
      })

      expect(fetchMock).not.toHaveBeenCalled()
      expect(result.current.isOnline).toBe(true)
    })

    it('falls back to navigator.onLine when apiBaseUrl is an empty string', async () => {
      // Invalid-input case: the empty string is falsy and must take the same
      // no-probe path as an omitted argument.
      vi.stubGlobal('navigator', { onLine: false })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const { result } = renderOnlineHook('')

      await act(async () => {
        await result.current.retry()
      })

      expect(fetchMock).not.toHaveBeenCalled()
      expect(result.current.isOnline).toBe(false)
    })

    it('sends HEAD with no-store cache and an abort signal', async () => {
      vi.stubGlobal('navigator', { onLine: false })
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      const { result } = renderOnlineHook('https://api.example.com')

      await act(async () => {
        await result.current.retry()
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith('https://api.example.com', {
        method: 'HEAD',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      })

      const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
      expect(signal.aborted).toBe(false)
    })

    it('resolves without throwing when the component unmounts mid-probe', async () => {
      vi.stubGlobal('navigator', { onLine: false })
      let resolveFetch!: (value: { ok: boolean }) => void
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(
          () => new Promise<{ ok: boolean }>((resolve) => (resolveFetch = resolve)),
        ),
      )
      const { result, unmount } = renderOnlineHook('https://api.example.com')

      await act(async () => {
        const probe = result.current.retry()
        unmount()
        resolveFetch({ ok: true })
        await probe
      })

      // No exception surfaced; the in-flight probe was simply discarded.
      expect(result.current.isOnline).toBe(false)
    })
  })
})
