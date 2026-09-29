import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  EMPTY_FILTER_STATE,
  MAX_FILTERS_PER_WORKSPACE,
  MAX_FILTER_NAME_LENGTH,
  findMatchingSavedFilter,
  isFilterEmpty,
  isValidIsoDate,
  makeSavedFilterId,
  parseFilterUrl,
  readFilterStateFromLocation,
  savedFilterStorageKey,
  serializeFilterState,
  validateFilterName,
} from './auditLogFilters'

describe('auditLogFilters', () => {
  describe('isFilterEmpty', () => {
    it('returns true for the empty state', () => {
      expect(isFilterEmpty({ ...EMPTY_FILTER_STATE })).toBe(true)
    })

    it('returns false when query is set', () => {
      expect(isFilterEmpty({ ...EMPTY_FILTER_STATE, query: 'x' })).toBe(false)
    })

    it('returns false when chips are set', () => {
      expect(isFilterEmpty({ ...EMPTY_FILTER_STATE, activeChips: ['a'] })).toBe(
        false,
      )
    })

    it('returns false when from or to is set', () => {
      expect(
        isFilterEmpty({ ...EMPTY_FILTER_STATE, dateFrom: '2026-01-01' }),
      ).toBe(false)
      expect(
        isFilterEmpty({ ...EMPTY_FILTER_STATE, dateTo: '2026-02-01' }),
      ).toBe(false)
    })
  })

  describe('isValidIsoDate', () => {
    it('accepts well-formed dates', () => {
      expect(isValidIsoDate('2026-07-28')).toBe(true)
      expect(isValidIsoDate('1999-12-31')).toBe(true)
    })

    it('rejects malformed dates', () => {
      expect(isValidIsoDate('2026-13-01')).toBe(false)
      expect(isValidIsoDate('2026-02-30')).toBe(false)
      expect(isValidIsoDate('2026/07/28')).toBe(false)
      expect(isValidIsoDate('')).toBe(false)
      expect(isValidIsoDate('today')).toBe(false)
    })
  })

  describe('serializeFilterState', () => {
    it('returns an empty string for the empty state', () => {
      expect(serializeFilterState({ ...EMPTY_FILTER_STATE })).toBe('')
    })

    it('keeps params alphabetically stable for chips', () => {
      const a = serializeFilterState({
        ...EMPTY_FILTER_STATE,
        activeChips: ['failed', 'verified'],
      })
      const b = serializeFilterState({
        ...EMPTY_FILTER_STATE,
        activeChips: ['verified', 'failed'],
      })
      expect(a).toBe(b)
      expect(a).toBe('?status=failed,verified')
    })

    it('trims and includes query, from, and to when valid', () => {
      expect(
        serializeFilterState({
          query: '  hello world  ',
          activeChips: [],
          dateFrom: '2026-07-01',
          dateTo: '2026-07-31',
        }),
      ).toBe('?q=hello%20world&from=2026-07-01&to=2026-07-31')
    })

    it('strips invalid dates instead of including them', () => {
      expect(
        serializeFilterState({
          ...EMPTY_FILTER_STATE,
          dateFrom: 'not-a-date',
          dateTo: '2026-13-99',
        }),
      ).toBe('')
    })

    it('dedupes and sorts chips on serialize', () => {
      expect(
        serializeFilterState({
          ...EMPTY_FILTER_STATE,
          activeChips: ['b', 'a', 'b', 'a'],
        }),
      ).toBe('?status=a,b')
    })

    it('omits whitespace-only query', () => {
      expect(
        serializeFilterState({ ...EMPTY_FILTER_STATE, query: '   ' }),
      ).toBe('')
    })
  })

  describe('round-trip', () => {
    it('round-trips a fully-populated state', () => {
      const state = {
        query: 'hello world',
        activeChips: ['verified', 'failed'],
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
      }
      const serialized = serializeFilterState(state)
      const reparsed = parseFilterUrl(new URLSearchParams(serialized.replace(/^\?/, '')))
      expect(reparsed).toEqual({
        query: 'hello world',
        activeChips: ['failed', 'verified'],
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
      })
    })
  })

  describe('parseFilterUrl', () => {
    it('parses all four fields', () => {
      const params = new URLSearchParams(
        'q=hello&status=verified,failed&from=2026-01-01&to=2026-01-31',
      )
      expect(parseFilterUrl(params)).toEqual({
        query: 'hello',
        activeChips: ['failed', 'verified'],
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      })
    })

    it('returns empty state for empty params', () => {
      expect(parseFilterUrl(new URLSearchParams())).toEqual({
        ...EMPTY_FILTER_STATE,
      })
    })

    it('drops malformed dates silently', () => {
      const params = new URLSearchParams(
        'q=x&from=bad&to=2026-13-99&status=verified',
      )
      expect(parseFilterUrl(params)).toEqual({
        query: 'x',
        activeChips: ['verified'],
        dateFrom: '',
        dateTo: '',
      })
    })

    it('tolerates a malformed URLSearchParams getter', () => {
      const throwing = {
        get: () => {
          throw new Error('boom')
        },
      } as unknown as URLSearchParams
      expect(() => parseFilterUrl(throwing)).not.toThrow()
      expect(parseFilterUrl(throwing)).toEqual({ ...EMPTY_FILTER_STATE })
    })

    it('drops blank chip tokens and dedupes', () => {
      const params = new URLSearchParams('status=a,,a,b,b')
      expect(parseFilterUrl(params).activeChips).toEqual(['a', 'b'])
    })
  })

  describe('savedFilterStorageKey', () => {
    it('uses the workspace id verbatim when safe', () => {
      expect(savedFilterStorageKey('acme-01')).toBe(
        'veritasor.savedAuditFilters.acme-01',
      )
    })

    it('strips characters that would collide between workspaces', () => {
      expect(savedFilterStorageKey('a/b c')).toBe(
        'veritasor.savedAuditFilters.abc',
      )
      expect(savedFilterStorageKey('!!!')).toBe(
        'veritasor.savedAuditFilters.default',
      )
    })
  })

  describe('validateFilterName', () => {
    it('accepts a normal name', () => {
      expect(validateFilterName('Failed Attestations', [])).toEqual({
        ok: true,
        name: 'Failed Attestations',
      })
    })

    it('trims and collapses internal whitespace', () => {
      expect(validateFilterName('  foo   bar  ', [])).toEqual({
        ok: true,
        name: 'foo bar',
      })
    })

    it('rejects empty input', () => {
      expect(validateFilterName('   ', [])).toEqual({
        ok: false,
        reason: 'empty',
      })
    })

    it('rejects names over the limit', () => {
      const tooLong = 'a'.repeat(MAX_FILTER_NAME_LENGTH + 1)
      expect(validateFilterName(tooLong, [])).toEqual({
        ok: false,
        reason: 'too_long',
      })
    })

    it('rejects duplicates case-insensitively', () => {
      expect(validateFilterName('Failed', ['failed'])).toEqual({
        ok: false,
        reason: 'duplicate',
      })
      expect(validateFilterName('FAILED', ['failed'])).toEqual({
        ok: false,
        reason: 'duplicate',
      })
      // Allow if user changes a non-conflicting char.
      expect(validateFilterName('failed2', ['failed'])).toEqual({
        ok: true,
        name: 'failed2',
      })
    })

    it('rejects names with control characters', () => {
      expect(validateFilterName('foo\u0001bar', [])).toEqual({
        ok: false,
        reason: 'invalid_chars',
      })
      // DEL character (0x7f) is also in the banned range
      expect(validateFilterName('foo\u007fbar', [])).toEqual({
        ok: false,
        reason: 'invalid_chars',
      })
    })

    it('accepts names at the limit', () => {
      const exactly = 'a'.repeat(MAX_FILTER_NAME_LENGTH)
      expect(validateFilterName(exactly, [])).toEqual({ ok: true, name: exactly })
    })
  })

  describe('makeSavedFilterId', () => {
    it('produces prefixed ids that are unique across calls', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 50; i++) ids.add(makeSavedFilterId())
      expect(ids.size).toBe(50)
    })

    it('always starts with the flt_ prefix', () => {
      expect(makeSavedFilterId()).toMatch(/^flt_/)
    })
  })

  describe('findMatchingSavedFilter', () => {
    it('finds a saved filter whose params match the state', () => {
      const saved = [
        {
          id: 'a',
          name: 'Failed',
          searchParams: '?status=failed',
          createdAt: '',
          updatedAt: '',
        },
      ]
      expect(
        findMatchingSavedFilter(saved, {
          ...EMPTY_FILTER_STATE,
          activeChips: ['failed'],
        }),
      ).toBe(saved[0])
    })

    it('returns undefined for empty state', () => {
      expect(findMatchingSavedFilter([], { ...EMPTY_FILTER_STATE })).toBeUndefined()
    })

    it('returns undefined when no saved filter matches', () => {
      expect(
        findMatchingSavedFilter(
          [
            {
              id: 'a',
              name: 'n',
              searchParams: '?status=verified',
              createdAt: '',
              updatedAt: '',
            },
          ],
          { ...EMPTY_FILTER_STATE, activeChips: ['failed'] },
        ),
      ).toBeUndefined()
    })

    it('returns the correct filter from a list of several', () => {
      const saved = [
        { id: '1', name: 'All verified', searchParams: '?status=verified', createdAt: '', updatedAt: '' },
        { id: '2', name: 'Failed only',  searchParams: '?status=failed',   createdAt: '', updatedAt: '' },
        { id: '3', name: 'Date range',   searchParams: '?from=2026-01-01&to=2026-01-31', createdAt: '', updatedAt: '' },
      ]
      expect(
        findMatchingSavedFilter(saved, { ...EMPTY_FILTER_STATE, activeChips: ['failed'] }),
      ).toBe(saved[1])
      expect(
        findMatchingSavedFilter(saved, { ...EMPTY_FILTER_STATE, dateFrom: '2026-01-01', dateTo: '2026-01-31' }),
      ).toBe(saved[2])
    })

    it('returns undefined when state serializes to empty (no active filter)', () => {
      const saved = [
        { id: '1', name: 'Something', searchParams: '?status=verified', createdAt: '', updatedAt: '' },
      ]
      expect(findMatchingSavedFilter(saved, { ...EMPTY_FILTER_STATE })).toBeUndefined()
    })
  })

  describe('constants', () => {
    it('exposes a sane limit', () => {
      expect(MAX_FILTERS_PER_WORKSPACE).toBeGreaterThan(0)
      expect(MAX_FILTER_NAME_LENGTH).toBeGreaterThan(0)
    })
  })

  describe('readFilterStateFromLocation', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('returns EMPTY_FILTER_STATE when window is undefined (SSR)', () => {
      vi.stubGlobal('window', undefined)
      expect(readFilterStateFromLocation()).toEqual({ ...EMPTY_FILTER_STATE })
    })

    it('parses the current window.location.href', () => {
      vi.stubGlobal('window', {
        location: { href: 'https://app.example.com/audit?q=test&status=failed' },
      })
      expect(readFilterStateFromLocation()).toEqual({
        query: 'test',
        activeChips: ['failed'],
        dateFrom: '',
        dateTo: '',
      })
    })

    it('returns empty state when the URL has no recognised params', () => {
      vi.stubGlobal('window', {
        location: { href: 'https://app.example.com/audit' },
      })
      expect(readFilterStateFromLocation()).toEqual({ ...EMPTY_FILTER_STATE })
    })
  })
})
