// ---------------------------------------------------------------------------
// Regression coverage for `src/components/a11y/a11yCsv.ts` (issue #613)
//
// Focus: the explicit failure path in `defaultDeps()` —
//   `throw new Error('downloadIssuesCsv: a browser `window` is required')` —
// plus the neighboring normal path (successful Blob/anchor download with
// injected deps) and boundary inputs (empty result set, optional fields,
// RFC 4180 quoting edge cases).
//
// All DOM-touching dependencies are injected so the suite stays deterministic
// and never mutates jsdom globals (the SSR failure branch is the only place
// globals are stubbed, and they are restored in a `finally`).
// ---------------------------------------------------------------------------

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CSV_HEADERS,
  buildIssuesCsv,
  downloadIssuesCsv,
  escapeCsvField,
  issuesCsvFilename,
  type CsvHeader,
  type DownloadDeps,
} from './a11yCsv'
import { MOCK_ISSUES, SEVERITY_ORDER, type A11yIssue } from './a11yAuditData'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOM = '﻿'

/** Minimal valid issue; every optional field is overridable per test. */
function makeIssue(overrides: Partial<A11yIssue> = {}): A11yIssue {
  return {
    id: 'issue-test-1',
    severity: 'critical',
    ruleId: 'color-contrast',
    ruleName: 'Elements must have sufficient color contrast',
    wcag: '1.4.3',
    selector: '.auth-secondary-button',
    description: 'Text on the secondary CTA falls below the 4.5:1 contrast ratio.',
    fixSuggestion: 'Increase text colour to `--text` or darken the background.',
    url: 'https://dequeuniversity.com/rules/axe/4.7/color-contrast',
    detectedAt: '2026-07-23T11:42:00Z',
    documentTitle: 'Signup',
    ...overrides,
  }
}

/**
 * Fully injected `DownloadDeps` with observation handles so each test can
 * assert on the exact interactions (Blob parts, anchor lifecycle, URL
 * lifecycle, deferred revoke). The injected `setTimeoutFn` executes the
 * callback synchronously so revoke behaviour is observable without timers.
 */
function makeDeps() {
  const blobParts: BlobPart[] = []
  const blobOptions: BlobPropertyBag[] = []
  function BlobCtor(parts: BlobPart[], options?: BlobPropertyBag): Blob {
    blobParts.push(...parts)
    blobOptions.push(options ?? {})
    return new Blob(parts, options)
  }
  const urlApi = {
    createObjectURL: vi.fn(() => 'blob:test/fixed-url'),
    revokeObjectURL: vi.fn(),
  }
  const clicks: Array<{ href: string; download: string }> = []
  const appended: HTMLElement[] = []
  const removed: HTMLElement[] = []
  const root = document.createElement('div')
  const dom = {
    createElement: ((tag: string) => {
      const el = document.createElement(tag)
      if (tag === 'a') {
        const original = el.click.bind(el)
        el.click = () => {
          clicks.push({ href: el.href, download: el.download })
          original()
        }
      }
      return el
    }) as Document['createElement'],
    body: {
      appendChild: (child: Node) => {
        appended.push(child as HTMLElement)
        root.appendChild(child)
        return child
      },
      removeChild: (child: Node) => {
        removed.push(child as HTMLElement)
        root.removeChild(child)
        return child
      },
    } as unknown as Document['body'],
  }
  const setTimeoutFn = vi.fn((fn: () => void, _ms: number) => {
    fn()
    return 1
  })
  const deps: DownloadDeps = {
    BlobCtor: BlobCtor as unknown as typeof Blob,
    urlApi,
    dom,
    setTimeoutFn,
  }
  return { deps, blobParts, blobOptions, urlApi, clicks, appended, removed, setTimeoutFn }
}

/**
 * Minimal RFC 4180 parser used to *read back* generated CSV. Returns records
 * (arrays of unescaped fields), honouring quoted fields with embedded commas,
 * doubled quotes, and CRLF line breaks — unlike a naive `split()`, which
 * would split inside quoted fields.
 */
function parseCsv(csv: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < csv.length) {
    const ch = csv[i]
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      record.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\r' && csv[i + 1] === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
      i += 2
      continue
    }
    field += ch
    i += 1
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field)
    records.push(record)
  }
  return records
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// CSV_HEADERS — the export surface named by issue #613
// ---------------------------------------------------------------------------

describe('a11yCsv — CSV_HEADERS', () => {
  it('exposes the canonical triage column order (severity first)', () => {
    expect([...CSV_HEADERS]).toEqual([
      'severity',
      'rule_id',
      'rule_name',
      'wcag',
      'selector',
      'description',
      'fix_suggestion',
      'element',
      'url',
      'document_title',
      'detected_at',
    ])
  })

  it('contains no duplicate or empty headers', () => {
    expect(new Set(CSV_HEADERS).size).toBe(CSV_HEADERS.length)
    for (const header of CSV_HEADERS) {
      expect(header.length).toBeGreaterThan(0)
    }
  })

  it('is used verbatim as the first CSV row by buildIssuesCsv', () => {
    const csv = buildIssuesCsv([MOCK_ISSUES[0]])
    expect(csv.split('\r\n')[0]).toBe(CSV_HEADERS.join(','))
  })

  it('keeps the public `CsvHeader` type aligned with the tuple', () => {
    const first: CsvHeader = CSV_HEADERS[0]
    expect(first).toBe('severity')
  })
})

// ---------------------------------------------------------------------------
// escapeCsvField — RFC 4180 boundary inputs
// ---------------------------------------------------------------------------

describe('a11yCsv — escapeCsvField (RFC 4180)', () => {
  it('passes plain values through untouched', () => {
    expect(escapeCsvField('image-alt')).toBe('image-alt')
    expect(escapeCsvField('')).toBe('')
    expect(escapeCsvField('1.4.3')).toBe('1.4.3')
  })

  it('wraps values containing a comma in double quotes', () => {
    expect(escapeCsvField('contrast, color')).toBe('"contrast, color"')
  })

  it('wraps values containing double quotes and doubles the inner quotes', () => {
    expect(escapeCsvField('attribute "alt" is missing')).toBe('"attribute ""alt"" is missing"')
  })

  it('wraps values containing LF line breaks', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"')
  })

  it('wraps values containing CR line breaks (RFC 4180 treats CR as a break)', () => {
    expect(escapeCsvField('line one\rline two')).toBe('"line one\rline two"')
  })

  it('wraps values containing CRLF line breaks', () => {
    expect(escapeCsvField('line one\r\nline two')).toBe('"line one\r\nline two"')
  })

  it('escapes quotes AND wraps in one pass when several metacharacters co-occur', () => {
    const value = 'he said "use alt", then\nleft'
    expect(escapeCsvField(value)).toBe('"he said ""use alt"", then\nleft"')
  })

  it('never mutates the input value', () => {
    const value = 'a,b"c'
    escapeCsvField(value)
    expect(value).toBe('a,b"c')
  })
})

// ---------------------------------------------------------------------------
// buildIssuesCsv — normal path + boundary inputs
// ---------------------------------------------------------------------------

describe('a11yCsv — buildIssuesCsv', () => {
  it('returns a header-only document for an empty result set (boundary)', () => {
    expect(buildIssuesCsv([])).toBe(CSV_HEADERS.join(','))
  })

  it('sorts rows critical → serious → moderate → minor regardless of input order', () => {
    const csv = buildIssuesCsv([
      makeIssue({ id: 'b', severity: 'minor' }),
      makeIssue({ id: 'a', severity: 'critical' }),
      makeIssue({ id: 'd', severity: 'moderate' }),
      makeIssue({ id: 'c', severity: 'serious' }),
    ])
    const severities = csv
      .split('\r\n')
      .slice(1)
      .map((row) => row.split(',')[0])
    expect(severities).toEqual([...SEVERITY_ORDER])
  })

  it('does not mutate the caller’s array', () => {
    const issues = [
      makeIssue({ id: 'b', severity: 'minor' }),
      makeIssue({ id: 'a', severity: 'critical' }),
    ]
    const before = [...issues]
    buildIssuesCsv(issues)
    expect(issues.map((i) => i.id)).toEqual(before.map((i) => i.id))
  })

  it('emits one value per declared column for every row', () => {
    const csv = buildIssuesCsv(MOCK_ISSUES)
    const records = parseCsv(csv)
    expect(records).toHaveLength(MOCK_ISSUES.length + 1) // header + data
    for (const record of records) {
      expect(record).toHaveLength(CSV_HEADERS.length)
    }
    expect(records[0]).toEqual([...CSV_HEADERS])
  })

  it('defaults optional fields (`element`, `documentTitle`) to empty strings', () => {
    const issue = makeIssue({}) as A11yIssue
    delete (issue as Partial<A11yIssue>).element
    delete (issue as Partial<A11yIssue>).documentTitle
    const row = buildIssuesCsv([issue]).split('\r\n')[1].split(',')
    const elementIdx = CSV_HEADERS.indexOf('element')
    const titleIdx = CSV_HEADERS.indexOf('document_title')
    expect(row[elementIdx]).toBe('')
    expect(row[titleIdx]).toBe('')
  })

  it('quotes fields containing separators/newlines so the record count stays stable', () => {
    const messy = 'uses "quotes", commas\r\nand breaks'
    const csv = buildIssuesCsv([makeIssue({ description: messy })])

    // Raw bytes show the field was wrapped and inner quotes were doubled.
    expect(csv).toContain('"uses ""quotes"", commas\r\nand breaks"')

    // A standards-compliant parser reads back exactly 2 records (header + 1),
    // with the messy field round-tripped losslessly despite the embedded CRLF.
    const records = parseCsv(csv)
    expect(records).toHaveLength(2)
    const descriptionIdx = CSV_HEADERS.indexOf('description')
    expect(records[1][descriptionIdx]).toBe(messy)
  })

  it('terminates every record with CRLF and emits no trailing terminator', () => {
    const csv = buildIssuesCsv([MOCK_ISSUES[0], MOCK_ISSUES[1]])
    expect(csv.endsWith('\r\n')).toBe(false)
    expect(csv.match(/\r\n/g)).toHaveLength(2) // 2 records → 1 header + 1 data join
  })
})

// ---------------------------------------------------------------------------
// issuesCsvFilename — deterministic filename boundary
// ---------------------------------------------------------------------------

describe('a11yCsv — issuesCsvFilename', () => {
  it('formats a fixed date deterministically', () => {
    expect(issuesCsvFilename(new Date('2026-07-28T12:34:56Z'))).toBe(
      'veritasor-a11y-issues-2026-07-28T12-34-56.csv',
    )
  })

  it('keeps the `veritasor-a11y-issues-` prefix and `.csv` extension', () => {
    const name = issuesCsvFilename(new Date('2026-01-01T00:00:00Z'))
    expect(name.startsWith('veritasor-a11y-issues-')).toBe(true)
    expect(name.endsWith('.csv')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// downloadIssuesCsv — FAILURE path (the branch named by issue #613)
// ---------------------------------------------------------------------------

describe('a11yCsv — downloadIssuesCsv failure path (no browser window)', () => {
  /**
   * The guard `if (typeof window === 'undefined')` inside `defaultDeps()` is
   * the explicit failure contract: it must throw a synchronous, descriptive
   * Error before any Blob/anchor/URL work happens. jsdom always defines
   * `window`, so the test removes it from `globalThis` (restored in
   * `finally`) to simulate a non-browser environment deterministically.
   */
  function stubWindowUndefined(): void {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    return () => {
      if (descriptor) {
        Object.defineProperty(globalThis, 'window', descriptor)
      } else {
        // @ts-expect-error — restoring a global that was somehow absent
        globalThis.window = undefined
      }
    }
  }

  it('throws the documented error when no browser `window` is available', () => {
    const restore = stubWindowUndefined()
    let caught: unknown
    try {
      downloadIssuesCsv([])
    } catch (error) {
      caught = error
    } finally {
      restore()
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe(
      'downloadIssuesCsv: a browser `window` is required',
    )
  })

  it('throws before touching the DOM or any injected dependency', () => {
    const restore = stubWindowUndefined()
    const { deps, urlApi } = makeDeps()
    let caught: unknown
    try {
      downloadIssuesCsv(MOCK_ISSUES, 'should-never-download.csv', deps)
    } catch (error) {
      caught = error
    } finally {
      restore()
    }

    expect(caught).toBeInstanceOf(Error)
    // Error precedence: the guard fires before deps are merged or used.
    expect(urlApi.createObjectURL).not.toHaveBeenCalled()
    expect(urlApi.revokeObjectURL).not.toHaveBeenCalled()
    expect(deps.setTimeoutFn).not.toHaveBeenCalled()
    // No download anchor was ever appended to the real document body.
    expect(document.body.querySelector('a[download]')).toBeNull()
  })

  it('restores the window global afterwards so later tests are unaffected', () => {
    stubWindowUndefined()()
    expect(typeof window).toBe('object')
    expect(typeof window.document).toBe('object')
  })
})

// ---------------------------------------------------------------------------
// downloadIssuesCsv — NORMAL path (injected deps, deterministic)
// ---------------------------------------------------------------------------

describe('a11yCsv — downloadIssuesCsv normal path (injected deps)', () => {
  it('returns the filename, byte size, and CSV payload', () => {
    const { deps } = makeDeps()
    const result = downloadIssuesCsv([MOCK_ISSUES[0]], 'export-test.csv', { ...deps })

    expect(result.filename).toBe('export-test.csv')
    expect(result.data).toBe(buildIssuesCsv([MOCK_ISSUES[0]]))
    // Blob bytes must match a fresh UTF-8 encoding of BOM + payload
    // (non-ASCII content would otherwise hide encoding bugs).
    expect(result.bytes).toBe(new Blob([BOM, result.data]).size)
    expect(result.bytes).toBeGreaterThan(result.data.length) // BOM is 3 bytes
  })

  it('prepends the UTF-8 BOM with the text/csv content type', () => {
    const { deps, blobParts, blobOptions } = makeDeps()
    downloadIssuesCsv([MOCK_ISSUES[0]], 'bom.csv', { ...deps })
    expect(blobParts[0]).toBe('﻿')
    expect(blobOptions[0]?.type).toBe('text/csv;charset=utf-8')
  })

  it('drives the full anchor lifecycle: create → style → append → click → remove', () => {
    const { deps, clicks, appended, removed } = makeDeps()
    downloadIssuesCsv([MOCK_ISSUES[0]], 'lifecycle.csv', { ...deps })

    expect(clicks).toHaveLength(1)
    expect(clicks[0].href).toContain('blob:')
    expect(clicks[0].download).toBe('lifecycle.csv')
    expect(appended).toHaveLength(1)
    expect(removed).toHaveLength(1)
    expect(appended[0]).toBe(removed[0])
    // The anchor is hidden from users.
    expect((appended[0] as HTMLAnchorElement).style.display).toBe('none')
  })

  it('creates exactly one object URL and revokes the same URL', () => {
    const { deps, urlApi } = makeDeps()
    downloadIssuesCsv([MOCK_ISSUES[0]], 'url-lifecycle.csv', { ...deps })

    expect(urlApi.createObjectURL).toHaveBeenCalledTimes(1)
    expect(urlApi.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(urlApi.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:test/fixed-url')
  })

  it('defers `revokeObjectURL` via the timeout provider with a 0 ms delay', () => {
    // Fresh deps whose setTimeoutFn only *records* (does not execute) so we
    // can assert on the scheduling contract itself.
    const { deps, urlApi } = makeDeps()
    const recording = vi.fn()
    deps.setTimeoutFn = recording
    downloadIssuesCsv([MOCK_ISSUES[0]], 'deferred.csv', { ...deps })

    expect(recording).toHaveBeenCalledTimes(1)
    const [scheduledFn, ms] = recording.mock.calls[0]
    expect(ms).toBe(0)
    // The scheduled callback revokes the object URL when it eventually runs.
    scheduledFn()
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:test/fixed-url')
  })

  it('defaults the filename to the deterministic `issuesCsvFilename()` stamp', () => {
    const { deps } = makeDeps()
    const result = downloadIssuesCsv([MOCK_ISSUES[0]], undefined, { ...deps })
    expect(result.filename).toMatch(/^veritasor-a11y-issues-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/)
  })

  it('downloads successfully for an empty issue list (header-only CSV)', () => {
    const { deps, blobParts, urlApi } = makeDeps()
    const result = downloadIssuesCsv([], 'empty-export.csv', { ...deps })

    expect(result.filename).toBe('empty-export.csv')
    expect(result.data).toBe(CSV_HEADERS.join(','))
    expect(blobParts[1]).toBe(CSV_HEADERS.join(','))
    expect(urlApi.createObjectURL).toHaveBeenCalledTimes(1)
    expect(urlApi.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('honours partial dependency injection (global Blob + injected URL API)', () => {
    const urlApi = {
      createObjectURL: vi.fn(() => 'blob:test/partial'),
      revokeObjectURL: vi.fn(),
    }
    const result = downloadIssuesCsv([MOCK_ISSUES[0]], 'partial.csv', { urlApi })

    // Global Blob was used (no crash), and the injected URL API was adopted.
    expect(urlApi.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(result.bytes).toBeGreaterThan(0)
  })
})
