/**
 * Behavioural coverage for `useTheme`.
 *
 * The hook is the only thing standing between a stored preference and the
 * `data-theme` attribute the stylesheet keys off, and it has three separate
 * inputs that can disagree:
 *
 *  1. `localStorage` (per-user key, then the base key) — including the case
 *     where storage throws, which a private-mode browser does;
 *  2. a cross-tab `storage` event, plus the same-tab custom events `setTheme`
 *     dispatches;
 *  3. `prefers-color-scheme`, consulted only while the theme is `system`.
 *
 * The tests below pin the resolution order, the validation of stored values,
 * the `system` fallback, and the fact that an explicit theme stops listening
 * to the OS preference.
 */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { getThemeStorageKey, useTheme, type Theme } from '../hooks/useTheme'

const BASE_KEY = 'veritasor-theme'

type MatchMediaController = {
  setLight: (matches: boolean) => void
  emitChange: () => void
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  listeners: Array<() => void>
}

/** A controllable `window.matchMedia` double. */
function installMatchMedia(initialMatches: boolean): MatchMediaController {
  let matches = initialMatches
  const listeners: Array<() => void> = []
  const addEventListener = vi.fn((_type: string, cb: () => void) => {
    listeners.push(cb)
  })
  const removeEventListener = vi.fn((_type: string, cb: () => void) => {
    const index = listeners.indexOf(cb)
    if (index >= 0) listeners.splice(index, 1)
  })

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener,
        removeEventListener,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  })

  return {
    setLight: (next: boolean) => {
      matches = next
    },
    emitChange: () => {
      for (const cb of [...listeners]) cb()
    },
    addEventListener,
    removeEventListener,
    listeners,
  }
}

function dataTheme(): string | null {
  return document.documentElement.getAttribute('data-theme')
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  installMatchMedia(false)
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('getThemeStorageKey', () => {
  it('returns the base key when no user is supplied', () => {
    expect(getThemeStorageKey()).toBe(BASE_KEY)
    expect(getThemeStorageKey(undefined)).toBe(BASE_KEY)
  })

  it('namespaces the key per user', () => {
    expect(getThemeStorageKey('user-42')).toBe(`${BASE_KEY}-user-42`)
  })

  it('treats an empty user id as no user', () => {
    expect(getThemeStorageKey('')).toBe(BASE_KEY)
  })
})

describe('useTheme - stored value resolution', () => {
  it('defaults to system/dark with empty storage', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('system')
    expect(result.current.resolved).toBe('dark')
    expect(dataTheme()).toBe('dark')
  })

  it('honours an explicit stored theme', () => {
    localStorage.setItem(BASE_KEY, 'light')
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')
    expect(result.current.resolved).toBe('light')
    expect(dataTheme()).toBe('light')
  })

  it('falls back to system when the stored value is not a known theme', () => {
    localStorage.setItem(BASE_KEY, 'solarized')
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('system')
  })

  it('prefers the per-user key over the base key', () => {
    localStorage.setItem(BASE_KEY, 'light')
    localStorage.setItem(`${BASE_KEY}-u1`, 'high-contrast')

    const { result } = renderHook(() => useTheme('u1'))

    expect(result.current.theme).toBe('high-contrast')
    expect(result.current.resolved).toBe('high-contrast')
  })

  it('falls back to the base key when the user has no stored preference', () => {
    localStorage.setItem(BASE_KEY, 'dark')

    const { result } = renderHook(() => useTheme('u2'))

    expect(result.current.theme).toBe('dark')
  })

  it('ignores a base key holding an invalid value when resolving a user theme', () => {
    localStorage.setItem(BASE_KEY, 'not-a-theme')

    const { result } = renderHook(() => useTheme('u3'))

    expect(result.current.theme).toBe('system')
  })

  it('survives a localStorage that throws on read', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    const { result } = renderHook(() => useTheme('u4'))

    expect(result.current.theme).toBe('system')
    getItem.mockRestore()
  })
})

describe('useTheme - setTheme', () => {
  it('writes the value and updates the rendered theme', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('light')
    })

    expect(localStorage.getItem(BASE_KEY)).toBe('light')
    expect(result.current.theme).toBe('light')
    expect(result.current.resolved).toBe('light')
    expect(dataTheme()).toBe('light')
  })

  it('mirrors the preference into the base key for a signed-in user', () => {
    const { result } = renderHook(() => useTheme('u5'))

    act(() => {
      result.current.setTheme('high-contrast')
    })

    expect(localStorage.getItem(`${BASE_KEY}-u5`)).toBe('high-contrast')
    expect(localStorage.getItem(BASE_KEY)).toBe('high-contrast')
  })

  it('does not write the base key when no user is supplied', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })

    expect(localStorage.getItem(BASE_KEY)).toBe('dark')
    expect(localStorage.getItem(`${BASE_KEY}-undefined`)).toBeNull()
  })

  it('does not throw when the storage write is rejected', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    const { result } = renderHook(() => useTheme())

    expect(() => {
      act(() => {
        result.current.setTheme('light')
      })
    }).not.toThrow()

    // There is no in-memory fallback: the snapshot is always re-read from
    // storage, so a rejected write leaves the rendered theme unchanged.
    expect(result.current.theme).toBe('system')
    expect(dataTheme()).toBe('dark')
    setItem.mockRestore()
  })
})

describe('useTheme - reacting to external changes', () => {
  it('re-reads storage when a matching cross-tab storage event arrives', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')

    localStorage.setItem(BASE_KEY, 'light')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: BASE_KEY, newValue: 'light' }))
    })

    expect(result.current.theme).toBe('light')
    expect(dataTheme()).toBe('light')
  })

  it('re-reads storage when the per-user key changes elsewhere', () => {
    const { result } = renderHook(() => useTheme('u6'))

    localStorage.setItem(`${BASE_KEY}-u6`, 'high-contrast')
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: `${BASE_KEY}-u6`, newValue: 'high-contrast' }),
      )
    })

    expect(result.current.theme).toBe('high-contrast')
  })

  it('ignores a storage event for an unrelated key', () => {
    localStorage.setItem(BASE_KEY, 'light')
    const { result } = renderHook(() => useTheme())
    localStorage.removeItem(BASE_KEY)

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-key', newValue: 'x' }))
    })

    expect(result.current.theme).toBe('light')
  })

  it('unsubscribes from window events on unmount', () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useTheme('u7'))

    unmount()

    const removed = removeEventListener.mock.calls.map((call) => call[0])
    expect(removed).toContain('storage')
    expect(removed).toContain(BASE_KEY)
    expect(removed).toContain(`${BASE_KEY}-u7`)
  })
})

describe('useTheme - system preference', () => {
  it('resolves system from prefers-color-scheme: light', () => {
    const mm = installMatchMedia(true)
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('system')
    expect(result.current.resolved).toBe('light')
    expect(dataTheme()).toBe('light')
    expect(mm.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('re-applies the resolved theme when the OS preference changes', () => {
    const mm = installMatchMedia(false)
    renderHook(() => useTheme())
    expect(dataTheme()).toBe('dark')

    mm.setLight(true)
    act(() => {
      mm.emitChange()
    })

    expect(dataTheme()).toBe('light')
  })

  it('stops listening to the OS preference for an explicit theme', () => {
    const mm = installMatchMedia(true)
    localStorage.setItem(BASE_KEY, 'dark')

    renderHook(() => useTheme())

    expect(mm.addEventListener).not.toHaveBeenCalled()
    expect(dataTheme()).toBe('dark')

    mm.setLight(true)
    act(() => {
      mm.emitChange()
    })
    expect(dataTheme()).toBe('dark')
  })

  it('detaches the OS listener when the theme switches away from system', () => {
    const mm = installMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(mm.listeners).toHaveLength(1)

    act(() => {
      result.current.setTheme('light')
    })

    expect(mm.listeners).toHaveLength(0)
    expect(mm.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})

describe('useTheme - server rendering', () => {
  it('renders the system theme without consulting local storage', () => {
    localStorage.setItem(BASE_KEY, 'high-contrast')
    const getItem = vi.spyOn(Storage.prototype, 'getItem')

    function Probe() {
      const { theme } = useTheme('u8')
      return createElement('span', null, theme)
    }

    const html = renderToString(createElement(Probe))

    expect(html).toContain('system')
    expect(getItem).not.toHaveBeenCalled()
  })
})

describe('useTheme - every accepted theme', () => {
  const themes: Theme[] = ['light', 'dark', 'system', 'high-contrast']

  it.each(themes)('round-trips %s through storage', (theme) => {
    const mm = installMatchMedia(true)
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme(theme)
    })

    expect(localStorage.getItem(BASE_KEY)).toBe(theme)
    expect(result.current.theme).toBe(theme)
    const expected = theme === 'system' ? 'light' : theme
    expect(result.current.resolved).toBe(expected)
    expect(dataTheme()).toBe(expected)
    void mm
  })
})
