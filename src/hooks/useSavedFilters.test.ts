import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSavedFilters, type UseSavedFiltersReturn } from './useSavedFilters'
import { savedFilterStorageKey } from '../utils/auditLogFilters'

const ws = 'ws-test'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('useSavedFilters', () => {
  it('exposes the documented return contract', () => {
    const { result } = renderHook(() => useSavedFilters(ws))
    const value: UseSavedFiltersReturn = result.current

    expect(value).toMatchObject({
      filters: [],
      isHydrated: true,
      isFull: false,
      maxFilters: 50,
      maxNameLength: 50,
    })
    expect(value.save).toEqual(expect.any(Function))
    expect(value.rename).toEqual(expect.any(Function))
    expect(value.remove).toEqual(expect.any(Function))
    expect(value.getById).toEqual(expect.any(Function))
  })

  it('starts empty when there is no entry in localStorage', () => {
    const { result } = renderHook(() => useSavedFilters(ws))
    expect(result.current.filters).toEqual([])
    expect(result.current.isHydrated).toBe(true)
  })

  it('hydrates synchronously from localStorage on mount', () => {
    const stored = [
      {
        id: 'a',
        name: 'Persisted',
        searchParams: '?status=failed',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]
    window.localStorage.setItem(savedFilterStorageKey(ws), JSON.stringify(stored))
    const { result } = renderHook(() => useSavedFilters(ws))
    expect(result.current.filters).toEqual(stored)
  })

  it('drops malformed entries silently on hydrate', () => {
    const bad = [
      { id: 'a', name: 'good', searchParams: '?q=x' },
      'not-an-object',
      null,
      { id: 42, name: 'bad-shape' },
    ]
    window.localStorage.setItem(savedFilterStorageKey(ws), JSON.stringify(bad))
    const { result } = renderHook(() => useSavedFilters(ws))
    expect(result.current.filters).toEqual([
      { id: 'a', name: 'good', searchParams: '?q=x' },
    ])
  })

  it.each(['{invalid json', '{"filters":[]}'])(
    'returns empty for invalid stored JSON: %s',
    (raw) => {
      window.localStorage.setItem(savedFilterStorageKey(ws), raw)
      const { result } = renderHook(() => useSavedFilters(ws))
      expect(result.current.filters).toEqual([])
    },
  )

  it('keeps in-memory actions usable when localStorage reads and writes throw', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    const { result } = renderHook(() => useSavedFilters(ws))
    let saveResult: ReturnType<UseSavedFiltersReturn['save']> | undefined
    act(() => {
      saveResult = result.current.save('Still usable', '?status=failed')
    })

    expect(saveResult).toEqual({ ok: true, name: 'Still usable' })
    expect(result.current.filters[0]).toMatchObject({
      name: 'Still usable',
      searchParams: '?status=failed',
    })
  })

  it('switches workspaces without leaking entries', () => {
    window.localStorage.setItem(
      savedFilterStorageKey('ws-a'),
      JSON.stringify([
        { id: '1', name: 'A1', searchParams: '?q=a', createdAt: '', updatedAt: '' },
      ]),
    )
    window.localStorage.setItem(
      savedFilterStorageKey('ws-b'),
      JSON.stringify([
        { id: '2', name: 'B1', searchParams: '?q=b', createdAt: '', updatedAt: '' },
      ]),
    )
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useSavedFilters(id),
      { initialProps: { id: 'ws-a' } },
    )
    expect(result.current.filters.map((f) => f.name)).toEqual(['A1'])
    rerender({ id: 'ws-b' })
    expect(result.current.filters.map((f) => f.name)).toEqual(['B1'])
  })

  it('save() validates and rejects empty / too-long / duplicate names', () => {
    const { result } = renderHook(() => useSavedFilters(ws))
    // Each call lives in its own act() so React 18 batching commits the
    // state update from the previous call before the next one reads
    // existingNames.
    act(() => {
      expect(result.current.save('', '?q=x')).toEqual({
        ok: false,
        reason: 'empty',
      })
    })
    act(() => {
      expect(result.current.save('a'.repeat(51), '?q=x')).toEqual({
        ok: false,
        reason: 'too_long',
      })
    })
    act(() => {
      expect(result.current.save('valid', '?q=x')).toEqual({
        ok: true,
        name: 'valid',
      })
    })
    act(() => {
      expect(result.current.save('VALID', '?q=x')).toEqual({
        ok: false,
        reason: 'duplicate',
      })
    })
  })

  it('save() adds an entry and updates the underlying state', () => {
    const { result } = renderHook(() => useSavedFilters(ws))
    act(() => {
      result.current.save('Failed Attestations', '?status=failed')
    })
    expect(result.current.filters).toHaveLength(1)
    expect(result.current.filters[0]).toMatchObject({
      name: 'Failed Attestations',
      searchParams: '?status=failed',
    })
    expect(window.localStorage.getItem(savedFilterStorageKey(ws))).not.toBeNull()
  })

  it('save() respects the per-workspace cap by dropping the oldest entry', () => {
    window.localStorage.setItem(
      savedFilterStorageKey(ws),
      JSON.stringify(
        Array.from({ length: 50 }, (_, i) => ({
          id: `existing-${i}`,
          name: `Old ${i}`,
          searchParams: '?q=old',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        })),
      ),
    )
    const { result } = renderHook(() => useSavedFilters(ws))
    expect(result.current.isFull).toBe(true)
    act(() => {
      result.current.save('NewEntry', '?q=new')
    })
    expect(result.current.filters).toHaveLength(50)
    expect(result.current.filters[0].name).toBe('NewEntry')
    // NewEntry is prepended, pushing the array to 51 items. The slice
    // truncates the LAST item — the previously-newest entry ("Old 49").
    expect(
      result.current.filters.some((f) => f.name === 'Old 0'),
    ).toBe(true)
    expect(
      result.current.filters.some((f) => f.name === 'Old 49'),
    ).toBe(false)
  })

  it('rename() validates including excluding the target id from dup checks', () => {
    const { result } = renderHook(() => useSavedFilters(ws))
    act(() => {
      result.current.save('Original', '?q=o')
    })
    const id = result.current.filters[0].id
    expect(result.current.filters[0].name).toBe('Original')
    act(() => {
      expect(result.current.rename(id, '  rename me  ')).toEqual({
        ok: true,
        name: 'rename me',
      })
    })
    expect(result.current.filters[0].name).toBe('rename me')
    // No-op rename is fine.
    act(() => {
      expect(result.current.rename(id, 'rename me')).toEqual({
        ok: true,
        name: 'rename me',
      })
    })
  })

  it('rename() rejects names that collide with another filter in the workspace', () => {
    const { result } = renderHook(() => useSavedFilters(ws))
    act(() => {
      result.current.save('Alpha', '?q=a')
      result.current.save('Beta', '?q=b')
    })
    const betaId = result.current.filters.find((f) => f.name === 'Beta')!.id
    expect(result.current.rename(betaId, 'Alpha')).toEqual({
      ok: false,
      reason: 'duplicate',
    })
  })

  it('rename() returns empty reason when the target id does not exist', () => {
    const { result } = renderHook(() => useSavedFilters(ws))
    expect(result.current.rename('missing', 'whatever')).toEqual({
      ok: false,
      reason: 'empty',
    })
  })

  it('remove() deletes the entry and persists', () => {
    const { result } = renderHook(() => useSavedFilters(ws))
    act(() => {
      result.current.save('To delete', '?q=x')
    })
    const id = result.current.filters[0].id
    act(() => {
      result.current.remove(id)
    })
    expect(result.current.filters).toEqual([])
    const stored = window.localStorage.getItem(savedFilterStorageKey(ws))
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!)).toEqual([])
  })

  it('getById returns the matching entry', () => {
    const { result } = renderHook(() => useSavedFilters(ws))
    act(() => {
      result.current.save('A', '?q=a')
      result.current.save('B', '?q=b')
    })
    const b = result.current.filters.find((f) => f.name === 'B')!
    expect(result.current.getById(b.id)?.name).toBe('B')
    expect(result.current.getById('missing')).toBeUndefined()
  })
})
