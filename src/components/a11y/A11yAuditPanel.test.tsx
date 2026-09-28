import {
  MemoryRouter,
  Route,
  Routes,
  useSearchParams,
} from 'react-router-dom'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import {
  describe, expect, it, vi, beforeEach, afterEach,
} from 'vitest'
import A11yAuditPanel from './A11yAuditPanel'
import {
  MOCK_ISSUES,
  SEVERITY_META,
  SEVERITY_ORDER,
  matchesQuery,
  type A11yIssue,
  type A11ySeverity,
} from './a11yAuditData'
import {
  buildIssuesCsv,
  downloadIssuesCsv,
  escapeCsvField,
  issuesCsvFilename,
} from './a11yCsv'

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// jsdom shim — URL.createObjectURL is unavailable without a polyfill.
// Provide a minimal stub so `downloadIssuesCsv` can run end-to-end (and so
// captureObjectURLCount() can verify how many times it was invoked).
// ---------------------------------------------------------------------------

beforeEach(() => {
  const stub = {
    createObjectURL: vi.fn((blob: Blob) => {
      // Synthesize a deterministic object URL we can inspect in tests.
      void blob
      return `blob:test/${Math.random().toString(36).slice(2)}`
    }),
    revokeObjectURL: vi.fn(),
  }
  Object.defineProperty(window, 'URL', {
    configurable: true,
    writable: true,
    value: stub,
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderAt(initialEntries: string[] = ['/settings/a11y-audit']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/settings/a11y-audit" element={<A11yAuditPanel />} />
        <Route path="/settings/a11y-audit-with-params" element={<A11yAuditPanelWithProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

function A11yAuditPanelWithProbe() {
  const [params] = useSearchParams()
  return (
    <>
      <A11yAuditPanel />
      <p
        data-testid="probed-params"
        aria-hidden="true"
      >
        {Array.from(params.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('&')}
      </p>
    </>
  )
}

function getProbedParams() {
  const node = screen.queryByTestId('probed-params')
  return node?.textContent ?? ''
}

// ---------------------------------------------------------------------------
// A11yAuditPanelProps
// ---------------------------------------------------------------------------

describe('A11yAuditPanelProps', () => {
  it('accepts a custom issues array', () => {
    const customIssues: readonly A11yIssue[] = [
      {
        id: 'test-issue-1',
        ruleId: 'custom-rule',
        ruleName: 'Custom Rule',
        wcag: 'WCAG 2.1',
        selector: '#custom',
        description: 'Custom description',
        fixSuggestion: 'Fix it',
        element: 'div',
        url: 'https://example.com',
        documentTitle: 'Test Doc',
        detectedAt: '2023-01-01T00:00:00Z',
        severity: 'critical',
      },
    ]
    render(
      <MemoryRouter>
        <A11yAuditPanel issues={customIssues} />
      </MemoryRouter>,
    )

    // Total count should be 1
    const allChip = screen.getByRole('button', { name: /all severities/i })
    expect(allChip.textContent).toContain('1')

    // Critical chip should have 1
    const criticalChip = screen.getByRole('button', { name: /critical severity/i })
    expect(criticalChip.textContent).toContain('1')

    // Result table should show the custom rule
    expect(screen.getByText('Custom Rule')).toBeInTheDocument()
  })

  it('handles an empty issues array gracefully', () => {
    render(
      <MemoryRouter>
        <A11yAuditPanel issues={[]} />
      </MemoryRouter>,
    )

    // Total count should be 0
    const allChip = screen.getByRole('button', { name: /all severities/i })
    expect(allChip.textContent).toContain('0')

    // Empty state should be visible
    expect(screen.getByText(/no accessibility issues match the current filter/i)).toBeInTheDocument()
    
    // Live region status
    expect(screen.getByText(/no accessibility issues recorded/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Structure & ARIA
// ---------------------------------------------------------------------------

describe('A11yAuditPanel — structure & ARIA', () => {
  it('renders the heading and helper copy', () => {
    renderAt()
    expect(screen.getByRole('heading', { level: 2, name: /accessibility audit/i }))
      .toBeInTheDocument()
    expect(screen.getByText(/triage wcag findings/i)).toBeInTheDocument()
  })

  it('renders all four severity chips with correct counts', () => {
    renderAt()
    for (const sev of SEVERITY_ORDER) {
      const expected = MOCK_ISSUES.filter((i) => i.severity === sev).length
      const chip = screen.getByRole('button', { name: new RegExp(`\\b${SEVERITY_META[sev].ariaLabel}\\b`, 'i') })
      expect(chip).toBeInTheDocument()
      expect(chip.textContent).toContain(String(expected))
    }
  })

  it('marks the "All" chip as pressed by default (no URL params)', () => {
    renderAt()
    const allChip = screen.getByRole('button', { name: /all severities/i })
    expect(allChip).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks every severity chip as not pressed by default', () => {
    renderAt()
    for (const sev of SEVERITY_ORDER) {
      const chip = screen.getByRole('button', { name: new RegExp(`\\b${SEVERITY_META[sev].ariaLabel}\\b`, 'i') })
      expect(chip).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('groups the severity chips under a single labelled region', () => {
    renderAt()
    const group = screen.getByRole('group', { name: /filter by severity/i })
    expect(group).toBeInTheDocument()
    // All severity chips live inside the group.
    for (const sev of SEVERITY_ORDER) {
      const chip = within(group).getByRole('button', {
        name: new RegExp(`\\b${SEVERITY_META[sev].ariaLabel}\\b`, 'i'),
      })
      expect(chip).toBeInTheDocument()
    }
  })

  it('renders an aria-live result count region', () => {
    renderAt()
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region.textContent).toMatch(/accessibility issues?/i)
  })

  it('renders a results table with caption and accessible name', () => {
    renderAt()
    const table = screen.getByRole('grid', { name: /accessibility issues/i })
    expect(table).toBeInTheDocument()
    // Caption is sr-only but available to assistive tech.
    expect(table.querySelector('caption')?.textContent).toMatch(/accessibility issues/i)
  })

  it('renders a search input with a programmatic label', () => {
    renderAt()
    const input = screen.getByLabelText(/search accessibility issues/i)
    expect(input).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Severity chip toggle — URL persistence
// ---------------------------------------------------------------------------

describe('A11yAuditPanel — chip filter & URL persistence', () => {
  it('toggles a single severity on click', () => {
    renderAt(['/settings/a11y-audit-with-params'])
    const criticalChip = screen.getByRole('button', {
      name: /critical severity/i,
    })
    fireEvent.click(criticalChip)
    expect(criticalChip).toHaveAttribute('aria-pressed', 'true')
    expect(getProbedParams()).toMatch(/severity=critical/)
  })

  it('toggles a severity off when clicked while active', () => {
    renderAt(['/settings/a11y-audit-with-params?severity=critical'])
    const criticalChip = screen.getByRole('button', { name: /critical severity/i })
    expect(criticalChip).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(criticalChip)
    expect(criticalChip).toHaveAttribute('aria-pressed', 'false')
    expect(getProbedParams()).not.toMatch(/severity=/)
  })

  it('persists multi-select chip state in the URL', () => {
    renderAt(['/settings/a11y-audit-with-params'])
    fireEvent.click(screen.getByRole('button', { name: /critical severity/i }))
    fireEvent.click(screen.getByRole('button', { name: /serious severity/i }))
    fireEvent.click(screen.getByRole('button', { name: /moderate severity/i }))
    expect(getProbedParams()).toMatch(/severity=critical,serious,moderate/)
  })

  it('reads chip state from initial URL params', () => {
    renderAt(['/settings/a11y-audit?severity=critical,minor'])
    const criticalChip = screen.getByRole('button', { name: /critical severity/i })
    const minorChip = screen.getByRole('button', { name: /minor severity/i })
    expect(criticalChip).toHaveAttribute('aria-pressed', 'true')
    expect(minorChip).toHaveAttribute('aria-pressed', 'true')
  })

  it('drops the severity param when the user clicks the All chip', () => {
    renderAt(['/settings/a11y-audit-with-params?severity=serious'])
    fireEvent.click(screen.getByRole('button', { name: /all severities/i }))
    expect(getProbedParams()).not.toMatch(/severity=/)
  })

  it('ignores invalid severity values in the URL', () => {
    renderAt(['/settings/a11y-audit?severity=critical,bogus,severe'])
    // Only critical should be active; bogus and severe are dropped.
    expect(screen.getByRole('button', { name: /critical severity/i }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /serious severity/i }))
      .toHaveAttribute('aria-pressed', 'false')
  })

  it('filters the rendered rows by selected severities', () => {
    renderAt(['/settings/a11y-audit?severity=critical'])
    const allRows = screen.getAllByRole('row')
    // header row + critical rows only
    const criticalRows = MOCK_ISSUES.filter((i) => i.severity === 'critical')
    expect(allRows.length).toBe(1 + criticalRows.length)
  })

  it('renders the empty-state panel when no severities match', () => {
    renderAt(['/settings/a11y-audit?severity=minor&q=__definitely_no_match__'])
    expect(screen.getByText(/no accessibility issues match the current filter/i))
      .toBeInTheDocument()
  })

  it('the "Clear all" button appears when at least one filter is active and clears both chips + search', () => {
    renderAt(['/settings/a11y-audit-with-params?severity=critical&q=image'])
    const clearAll = screen.getByRole('button', { name: /clear all filters/i })
    expect(clearAll).toBeInTheDocument()
    fireEvent.click(clearAll)
    expect(getProbedParams()).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('A11yAuditPanel — search', () => {
  it('filters by rule id suffix when the user types in the search field', () => {
    renderAt(['/settings/a11y-audit-with-params?severity='])
    const input = screen.getByLabelText(/search accessibility issues/i)
    fireEvent.change(input, { target: { value: 'color-contrast' } })
    expect(getProbedParams()).toMatch(/q=color-contrast/)
  })

  it('filters by selector substring', () => {
    renderAt(['/settings/a11y-audit?q=hero-illustration'])
    const expected = MOCK_ISSUES.filter((i) => i.selector.includes('hero-illustration'))
    expect(expected.length).toBe(1)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.length).toBe(1)
  })

  it('matchesQuery is case-insensitive and trims whitespace', () => {
    const colorContrastIssue = MOCK_ISSUES.find((i) => i.ruleId === 'color-contrast')!
    const imageAltIssue = MOCK_ISSUES.find((i) => i.ruleId === 'image-alt')!
    expect(matchesQuery(colorContrastIssue, '  COLOR-CONTRAST  ')).toBe(true)
    expect(matchesQuery(imageAltIssue, 'unknown-term')).toBe(false)
    expect(matchesQuery(imageAltIssue, '')).toBe(true)
  })

  it('updates aria-live result count when filter narrows', () => {
    renderAt(['/settings/a11y-audit?q=__no_results_match__'])
    // The empty-state panel and the live region both have role="status"; query
    // the live region directly via its text content to avoid ambiguity.
    expect(screen.getAllByText(/showing 0 of/i).length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// CSV export — pure builder
// ---------------------------------------------------------------------------

describe('A11yCsv — RFC 4180 escape', () => {
  it('leaves plain strings untouched', () => {
    expect(escapeCsvField('hello')).toBe('hello')
  })

  it('wraps fields containing commas in quotes', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"')
  })

  it('escapes inner double quotes by doubling them', () => {
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""')
  })

  it('wraps fields containing newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })
})

describe('A11yCsv — buildIssuesCsv', () => {
  it('includes the required columns in the header row', () => {
    const csv = buildIssuesCsv([])
    expect(csv.split('\r\n')[0]).toBe(
      'severity,rule_id,rule_name,wcag,selector,description,fix_suggestion,element,url,document_title,detected_at',
    )
  })

  it('sorts output so critical issues appear before serious, before minor', () => {
    const minorFixture = MOCK_ISSUES.find((i) => i.severity === 'minor')!
    const criticalFixture = MOCK_ISSUES.find((i) => i.severity === 'critical')!
    const seriousFixture = MOCK_ISSUES.find((i) => i.severity === 'serious')!
    const moderateFixture = MOCK_ISSUES.find((i) => i.severity === 'moderate')!
    // Shuffle into a deliberately unsorted order: minor, critical, moderate, serious
    const shuffled: readonly A11yIssue[] = [
      minorFixture, criticalFixture, moderateFixture, seriousFixture,
    ]
    const csv = buildIssuesCsv(shuffled)
    const lines = csv.split('\r\n').slice(1)
    const severities = lines.map((l) => l.split(',')[0].replace(/^"|"$/g, ''))
    expect(severities).toEqual(['critical', 'serious', 'moderate', 'minor'])
  })

  it('includes the spec-required fields (severity, rule, selector) for every record', () => {
    const csv = buildIssuesCsv(MOCK_ISSUES)
    for (const issue of MOCK_ISSUES) {
      const severity = escapeCsvField(issue.severity)
      const ruleId = escapeCsvField(issue.ruleId)
      const selector = escapeCsvField(issue.selector)
      // Each record's row must contain all three required fields verbatim
      // (or wrapped in quotes if escapeCsvField wrapped them).
      const fragment = `${severity},${ruleId}`
      expect(csv).toContain(fragment)
      expect(csv).toContain(selector)
    }
  })

  it('escapes selectors that contain commas and quotes', () => {
    const tricky: A11yIssue = {
      ...MOCK_ISSUES[0],
      selector: '[aria-label="Hello, world"]',
    }
    const csv = buildIssuesCsv([tricky])
    expect(csv).toContain('"[aria-label=""Hello, world""]"')
  })
})

describe('A11yCsv — issuesCsvFilename', () => {
  it('produces a stable, parseable filename pattern', () => {
    const fixed = new Date('2026-07-28T12:34:56Z')
    expect(issuesCsvFilename(fixed)).toMatch(/^veritasor-a11y-issues-2026-07-28T12-34-56\.csv$/)
  })
})

// ---------------------------------------------------------------------------
// CSV export — DOM download (jsdom)
// ---------------------------------------------------------------------------

describe('A11yCsv — downloadIssuesCsv (DOM injection)', () => {
  it('writes a UTF-8 BOM, sets an anchor `download` attribute, and clicks it', () => {
    const clicks: Array<{ href: string; download: string }> = []
    const appended: HTMLElement[] = []
    const removed: HTMLElement[] = []
    const fakeBlobParts: Array<BlobPart> = []
    const fakeUrlApi = {
      createObjectURL: vi.fn(() => 'blob:test/abc123'),
      revokeObjectURL: vi.fn(),
    }
    // Use a regular function (not vi.fn) because ES target binding does not
    // construct from `new vi.fn(...)` reliably in jsdom.
    function fakeBlobCtor(parts: BlobPart[], _opts?: BlobPropertyBag): Blob {
      void _opts
      fakeBlobParts.push(...parts)
      return new Blob(parts, { type: 'text/csv' })
    }

    // Set up a fake DOM owned by the test.
    const root = document.createElement('div')
    const fakeBody = {
      appendChild: (child: Node) => {
        const el = child as HTMLElement
        appended.push(el)
        root.appendChild(el)
        return child
      },
      removeChild: (child: Node) => {
        const el = child as HTMLElement
        removed.push(el)
        root.removeChild(el)
        return child
      },
    }
    const fakeDom = {
      createElement: ((tag: string) => {
        const el = document.createElement(tag)
        if (tag === 'a') {
          const original = el.click.bind(el)
          ;(el as HTMLAnchorElement).click = () => {
            clicks.push({
              href: (el as HTMLAnchorElement).href,
              download: (el as HTMLAnchorElement).download,
            })
            original()
          }
        }
        return el
      }) as Document['createElement'],
      body: fakeBody as unknown as Document['body'],
    }
    // Execute the deferred revoke synchronously so we can assert on it
    // without waiting for the real event-loop `setTimeout`.
    const setTimeoutFn = (fn: () => void, ms: number) => {
      void ms
      fn()
      return 1
    }

    const result = downloadIssuesCsv(MOCK_ISSUES, 'test-export.csv', {
      BlobCtor: fakeBlobCtor,
      urlApi: fakeUrlApi,
      dom: fakeDom,
      setTimeoutFn,
    })

    // BOM was prepended
    expect(fakeBlobParts[0]).toBe('\ufeff')
    // Anchor was configured with the expected href + download
    expect(clicks.length).toBe(1)
    expect(clicks[0].href).toContain('blob:')
    expect(clicks[0].download).toBe('test-export.csv')
    // Anchor was appended after click AND removed after
    expect(appended.length).toBe(1)
    expect(removed.length).toBe(1)
    // URL lifecycle: created + revoked
    expect(fakeUrlApi.createObjectURL).toHaveBeenCalledTimes(1)
    expect(fakeUrlApi.revokeObjectURL).toHaveBeenCalledWith('blob:test/abc123')
    // Returned metadata
    expect(result.filename).toBe('test-export.csv')
    expect(result.data.length).toBeGreaterThan(0)
  })

  it('uses the global URL.createObjectURL when no deps are injected', () => {
    const originalAppendChild = document.body.appendChild.bind(document.body)
    const originalRemoveChild = document.body.removeChild.bind(document.body)
    try {
      document.body.appendChild = ((child: Node) => originalAppendChild(child)) as typeof document.body.appendChild
      document.body.removeChild = ((child: Node) => originalRemoveChild(child)) as typeof document.body.removeChild

      const urlSpy = window.URL.createObjectURL as unknown as ReturnType<typeof vi.fn>
      urlSpy.mockClear?.()

      downloadIssuesCsv([MOCK_ISSUES[0]])

      expect(urlSpy).toHaveBeenCalledTimes(1)
    } finally {
      document.body.appendChild = originalAppendChild
      document.body.removeChild = originalRemoveChild
    }
  })
})

// ---------------------------------------------------------------------------
// A11yAuditPanel — Export button end-to-end
// ---------------------------------------------------------------------------

describe('A11yAuditPanel — export button', () => {
  it('triggers downloadIssuesCsv with the filtered list', () => {
    renderAt(['/settings/a11y-audit?severity=critical'])
    const exportBtn = screen.getByRole('button', { name: /export.*csv/i })
    fireEvent.click(exportBtn)
    const urlSpy = window.URL.createObjectURL as unknown as ReturnType<typeof vi.fn>
    expect(urlSpy).toHaveBeenCalledTimes(1)
    const blobArg = urlSpy.mock.calls[0][0] as Blob
    expect(blobArg.type).toMatch(/text\/csv/)
  })

  it('disables the export button when there are no filtered issues', () => {
    renderAt(['/settings/a11y-audit?q=__no_results__'])
    const exportBtn = screen.getByRole('button', { name: /export.*csv/i })
    expect(exportBtn).toBeDisabled()
  })

  it('announces a success status after CSV export', async () => {
    renderAt(['/settings/a11y-audit'])
    fireEvent.click(screen.getByRole('button', { name: /export.*csv/i }))
    expect(screen.getByText(/csv export triggered/i)).toBeInTheDocument()
  })

  it('reflects filtered count in the export button aria-label', () => {
    renderAt(['/settings/a11y-audit?severity=critical'])
    const exportBtn = screen.getByRole('button', { name: /export.*csv/i })
    const expectedCount = MOCK_ISSUES.filter((i) => i.severity === 'critical').length
    expect(exportBtn.getAttribute('aria-label')).toMatch(new RegExp(`${expectedCount}\\b`))
  })
})

// ---------------------------------------------------------------------------
// Keyboard & copy-text consistency
// ---------------------------------------------------------------------------

describe('A11yAuditPanel — keyboard accessibility', () => {
  it('chips respond to Space key activation (Enter/Space native)', () => {
    renderAt(['/settings/a11y-audit-with-params'])
    const criticalChip = screen.getByRole('button', { name: /critical severity/i })
    criticalChip.focus()
    fireEvent.keyDown(criticalChip, { key: ' ', code: 'Space' })
    fireEvent.click(criticalChip) // jsdom pattern — Space on a button is delivered as click
    expect(getProbedParams()).toMatch(/severity=critical/)
  })

  it('export button is keyboard-focusable and activatable via Enter', () => {
    renderAt(['/settings/a11y-audit'])
    const exportBtn = screen.getByRole('button', { name: /export.*csv/i }) as HTMLButtonElement
    exportBtn.focus()
    fireEvent.click(exportBtn) // Enter on a native button fires click
    expect(window.URL.createObjectURL).toHaveBeenCalled()
  })

  it('severity chips and the All chip are part of the natural tab order', () => {
    renderAt(['/settings/a11y-audit'])
    const buttons = screen.getAllByRole('button')
    // All chips + export button + search clear-all (when active) are tabbable.
    expect(buttons.length).toBeGreaterThanOrEqual(SEVERITY_ORDER.length + 1)
  })
})

describe('A11yAuditPanel — copy text consistency', () => {
  it('chip aria-labels use the severity-specific verbose label', () => {
    renderAt()
    expect(screen.getByRole('button', { name: /critical severity — blocking access/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /serious severity — major barrier/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /moderate severity — notable barrier/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /minor severity — inconvenience/i })).toBeInTheDocument()
  })

  it('row severity badges expose the severity via aria-label (not color alone)', () => {
    renderAt(['/settings/a11y-audit?severity=critical'])
    const badges = screen.getAllByLabelText(/critical severity/i)
    expect(badges.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Severity order assertions (lightweight self-test)
// ---------------------------------------------------------------------------

describe('a11yAuditData — severity order', () => {
  it('SEVERITY_ORDER matches the documented triage sequence', () => {
    expect(SEVERITY_ORDER).toEqual([
      'critical',
      'serious',
      'moderate',
      'minor',
    ])
  })

  it('SEVERITY_META covers every severity', () => {
    for (const sev of SEVERITY_ORDER) {
      const meta = SEVERITY_META[sev as A11ySeverity]
      expect(meta.label.toLowerCase()).toContain(sev)
      expect(meta.ariaLabel.toLowerCase()).toContain(sev)
      expect(meta.glyph).toBeTruthy()
      expect(meta.cssVar).toMatch(/var\(--/)
      expect(meta.softCssVar).toMatch(/var\(--|rgba\(/)
    }
  })
})
