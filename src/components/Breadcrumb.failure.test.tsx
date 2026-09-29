import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Breadcrumb, { type BreadcrumbItem } from './Breadcrumb'

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderBreadcrumb(
  props: Partial<React.ComponentProps<typeof Breadcrumb>> = {},
) {
  return render(
    <MemoryRouter>
      <Breadcrumb items={[]} {...props} />
    </MemoryRouter>,
  )
}

/** Render with an item list that may violate the declared prop type on purpose. */
function renderItems(items: unknown, maxLabelLength?: number) {
  return render(
    <MemoryRouter>
      <Breadcrumb items={items as BreadcrumbItem[]} maxLabelLength={maxLabelLength} />
    </MemoryRouter>,
  )
}

function jsonLdRoot(): HTMLScriptElement | null {
  return document.querySelector('script[type="application/ld+json"]')
}

function jsonLd(): Record<string, unknown> | null {
  const el = jsonLdRoot()
  return el ? (JSON.parse(el.innerHTML) as Record<string, unknown>) : null
}

/** A rendered crumb's visible text, via the list the component marks for tests. */
function crumbTexts(): string[] {
  const list = screen.getByTestId('breadcrumb-list')
  return within(list)
    .getAllByRole('listitem')
    .map((li) => li.textContent?.replace(/\/$/, '') ?? '')
}

// ─── The named failure path: the `!items || items.length === 0` guard ────────

describe('Breadcrumb empty-result guard', () => {
  it('renders nothing when items is undefined', () => {
    const { container } = renderItems(undefined)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
    expect(jsonLdRoot()).toBeNull()
  })

  it('renders nothing when items is null at runtime', () => {
    const { container } = renderItems(null)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(jsonLdRoot()).toBeNull()
  })

  it('renders nothing when items is an empty array', () => {
    const { container } = renderItems([])

    expect(container).toBeEmptyDOMElement()
    expect(jsonLdRoot()).toBeNull()
  })

  it('injects no JSON-LD itemListElement entries for an empty guard hit', () => {
    renderItems([])

    expect(jsonLd()).toBeNull()
  })

  it('emits no console error on the empty-result path', () => {
    // React logs a recoverable render error; the guard must stay silent.
    const spy = vi.spyOn(console, 'error')

    renderItems(undefined)
    renderItems(null)
    renderItems([])

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('recovers and renders normally when items go from empty to populated', () => {
    const { container, rerender } = renderItems([])
    expect(container).toBeEmptyDOMElement()

    rerender(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Detail' }]} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
    expect(crumbTexts()).toEqual(['Home', 'Detail'])
  })
})

// ─── Neighbouring normal path ───────────────────────────────────────────────

describe('Breadcrumb success path', () => {
  it('renders one nav landmark, one link per ancestor, and a current crumb', () => {
    renderItems([
      { label: 'Home', href: '/' },
      { label: 'Attestations', href: '/attestations' },
      { label: 'att-001' },
    ])

    expect(screen.getAllByRole('navigation', { name: 'Breadcrumb' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Attestations' })).toHaveAttribute('href', '/attestations')
    expect(screen.getByText('att-001')).toHaveAttribute('aria-current', 'page')
    expect(crumbTexts()).toEqual(['Home', 'Attestations', 'att-001'])
  })

  it('separates crumbs with n-1 separators', () => {
    renderItems([
      { label: 'A', href: '/a' },
      { label: 'B', href: '/b' },
      { label: 'C', href: '/c' },
      { label: 'D' },
    ])

    const list = screen.getByTestId('breadcrumb-list')
    expect(list.querySelectorAll('.breadcrumb-separator')).toHaveLength(3)
  })

  it('emits a JSON-LD BreadcrumbList with 1-based positions and absolute urls', () => {
    renderItems([
      { label: 'Home', href: '/' },
      { label: 'Detail' },
    ])

    const data = jsonLd()
    expect(data?.['@type']).toBe('BreadcrumbList')
    expect(data?.['@context']).toBe('https://schema.org')

    const elements = data?.itemListElement as Array<Record<string, unknown>>
    expect(elements).toHaveLength(2)
    expect(elements[0]).toMatchObject({ position: 1, name: 'Home' })
    expect(elements[1]).toMatchObject({ position: 2, name: 'Detail' })
    expect(String(elements[0].item)).toMatch(/^https?:\/\/.+\/$/)
    expect(elements[1].item).toBeUndefined()
  })
})

// ─── Boundary inputs ────────────────────────────────────────────────────────

describe('Breadcrumb item boundaries', () => {
  it('renders a single item as the current page with no link or separator', () => {
    renderItems([{ label: 'Only' }])

    const list = screen.getByTestId('breadcrumb-list')
    expect(list.querySelectorAll('.breadcrumb-item')).toHaveLength(1)
    expect(list.querySelectorAll('.breadcrumb-separator')).toHaveLength(0)
    expect(screen.getByText('Only')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders a two-item trail with exactly one separator', () => {
    renderItems([{ label: 'Home', href: '/' }, { label: 'Detail' }])

    const list = screen.getByTestId('breadcrumb-list')
    expect(list.querySelectorAll('.breadcrumb-separator')).toHaveLength(1)
  })

  it('never links the final crumb, even when it carries an href', () => {
    renderItems([{ label: 'Home', href: '/' }, { label: 'Detail', href: '/attestations/att-001' }])

    expect(screen.queryByRole('link', { name: 'Detail' })).not.toBeInTheDocument()
    expect(screen.getByText('Detail')).toHaveAttribute('aria-current', 'page')
  })

  it('renders a mid-trail item without an href as plain text', () => {
    renderItems([{ label: 'Home' }, { label: 'Middle' }, { label: 'Current' }])

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(crumbTexts()).toEqual(['Home', 'Middle', 'Current'])
  })

  it('renders an empty label as an empty current crumb rather than crashing', () => {
    renderItems([{ label: '' }])

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
    expect(crumbTexts()).toEqual([''])
    expect((jsonLd()?.itemListElement as Array<Record<string, unknown>>)[0].name).toBe('')
  })

  it('coerces a missing label to empty text instead of throwing', () => {
    // `label` is required by the type, but items often come from route
    // definitions or API payloads that are not type-checked at runtime.
    expect(() => renderItems([{ label: undefined }, { label: 'Detail' }])).not.toThrow()

    expect(crumbTexts()).toEqual(['', 'Detail'])
    const elements = jsonLd()?.itemListElement as Array<Record<string, unknown>>
    expect(elements[0].name).toBe('')
  })

  it('coerces a non-string label to empty text instead of throwing', () => {
    expect(() => renderItems([{ label: 42 }, { label: null }])).not.toThrow()
    expect(crumbTexts()).toEqual(['', ''])
  })
})

// ─── Truncation boundaries ──────────────────────────────────────────────────

describe('Breadcrumb maxLabelLength boundaries', () => {
  it('leaves a label at exactly the limit untouched', () => {
    renderItems([{ label: 'abcde' }], 5)

    expect(screen.getByText('abcde')).toBeInTheDocument()
    expect(screen.queryByTitle('abcde')).toBeNull()
  })

  it('truncates a label one character over the limit', () => {
    renderItems([{ label: 'abcdef' }], 5)

    expect(screen.getByText('abcd…')).toBeInTheDocument()
    expect(screen.getByTitle('abcdef')).toBeInTheDocument()
  })

  it('truncates to exactly the limit length', () => {
    renderItems([{ label: 'x'.repeat(60) }], 10)

    const display = screen.getByTitle('x'.repeat(60))
    expect(display.textContent).toHaveLength(10)
    expect(display.textContent).toBe(`${'x'.repeat(9)}…`)
  })

  it('clamps a maxLabelLength of 0 to the ellipsis instead of lengthening the label', () => {
    renderItems([{ label: 'Business details' }], 0)

    // Regression: slice(0, -1) previously returned "Business detail…", which is
    // as long as the original label — the limit was not applied at all.
    const display = screen.getByTitle('Business details')
    expect(display.textContent).toBe('…')
    expect(display.textContent!.length).toBeLessThan('Business details'.length)
  })

  it('clamps a negative maxLabelLength to the ellipsis', () => {
    renderItems([{ label: 'Business details' }], -5)

    expect(screen.getByTitle('Business details').textContent).toBe('…')
  })

  it('clamps a fractional maxLabelLength down to a whole number of characters', () => {
    renderItems([{ label: 'abcdefgh' }], 4.7)

    expect(screen.getByTitle('abcdefgh').textContent).toBe('abc…')
  })

  it('falls back to the default limit for a non-finite maxLabelLength', () => {
    renderItems([{ label: 'A'.repeat(24) }], Number.NaN)
    expect(screen.getByText('A'.repeat(24))).toBeInTheDocument()

    renderItems([{ label: 'B'.repeat(25) }], Number.POSITIVE_INFINITY)
    expect(screen.getByText(`${'B'.repeat(23)}…`)).toBeInTheDocument()
  })

  it('keeps the full label available as the title whenever it is truncated', () => {
    renderItems([{ label: 'Home', href: '/' }, { label: 'An extremely long final label here' }], 10)

    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('title')
    expect(screen.getByTitle('An extremely long final label here')).toBeInTheDocument()
  })
})

// ─── Malformed href: the component must not throw ────────────────────────────

describe('Breadcrumb malformed href handling', () => {
  it('renders the trail when an href cannot be parsed as a URL', () => {
    // Regression: new URL() threw during render, unmounting the whole subtree.
    expect(() =>
      renderItems([{ label: 'Home', href: 'http://%' }, { label: 'Detail' }]),
    ).not.toThrow()

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
    expect(crumbTexts()).toEqual(['Home', 'Detail'])
  })

  it('omits the JSON-LD item url for an unparseable href but keeps the name', () => {
    renderItems([{ label: 'Home', href: 'http://a b c/' }, { label: 'Detail' }])

    const elements = jsonLd()?.itemListElement as Array<Record<string, unknown>>
    expect(elements[0].name).toBe('Home')
    expect(elements[0].item).toBeUndefined()
  })

  it('still percent-encodes a relative href that merely contains spaces', () => {
    renderItems([{ label: 'Home', href: 'not a url at all' }, { label: 'Detail' }])

    const elements = jsonLd()?.itemListElement as Array<Record<string, unknown>>
    expect(elements[0].item).toBe(`${window.location.origin}/not%20a%20url%20at%20all`)
  })

  it('keeps valid hrefs resolvable alongside a malformed sibling', () => {
    renderItems([
      { label: 'A', href: 'http://[' },
      { label: 'B', href: '/b' },
      { label: 'C' },
    ])

    const elements = jsonLd()?.itemListElement as Array<Record<string, unknown>>
    expect(elements).toHaveLength(3)
    expect(elements[0].item).toBeUndefined()
    expect(String(elements[1].item)).toMatch(/\/b$/)
  })

  it('treats an empty-string href as "no link"', () => {
    renderItems([{ label: 'Home', href: '' }, { label: 'Detail' }])

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    const elements = jsonLd()?.itemListElement as Array<Record<string, unknown>>
    expect(elements[0].item).toBeUndefined()
  })

  it('resolves a relative href against the current origin', () => {
    renderItems([{ label: 'Detail', href: '/attestations/att-001' }])

    const elements = jsonLd()?.itemListElement as Array<Record<string, unknown>>
    expect(String(elements[0].item)).toBe(`${window.location.origin}/attestations/att-001`)
  })
})

// ─── JSON-LD serialization must not be escapable out of its script tag ──────

describe('Breadcrumb JSON-LD escaping', () => {
  it('escapes a closing script tag inside a label', () => {
    renderItems([{ label: '</script><img src=x onerror=alert(1)>' }])

    // Regression: the raw label closed the <script> element when parsed.
    const raw = jsonLdRoot()!.innerHTML
    expect(raw).not.toContain('</script><img')
    expect(raw).toContain('\\u003c/script\\u003e')
    expect(document.querySelectorAll('img')).toHaveLength(0)
  })

  it('still decodes to the original label for JSON-LD consumers', () => {
    const label = '</script><img src=x onerror=alert(1)>'
    renderItems([{ label }])

    const elements = jsonLd()?.itemListElement as Array<Record<string, unknown>>
    expect(elements[0].name).toBe(label)
  })

  it('escapes ampersands and angle brackets in labels', () => {
    renderItems([{ label: 'R&D <lab> "q"' }])

    const raw = jsonLdRoot()!.innerHTML
    expect(raw).not.toMatch(/[<>]/)
    expect(raw).toContain('\\u0026')
    expect((jsonLd()?.itemListElement as Array<Record<string, unknown>>)[0].name).toBe('R&D <lab> "q"')
  })

  it('keeps the JSON-LD payload parseable for quotes, newlines and tabs', () => {
    renderItems([{ label: 'He said "hi"\nnewline\ttab\\backslash' }])

    const elements = jsonLd()?.itemListElement as Array<Record<string, unknown>>
    expect(elements[0].name).toBe('He said "hi"\nnewline\ttab\\backslash')
  })
})

// ─── Prop contract ──────────────────────────────────────────────────────────

describe('Breadcrumb prop contract', () => {
  it('defaults maxLabelLength to 24', () => {
    renderBreadcrumb({ items: [{ label: 'A'.repeat(24) }] })
    expect(screen.getByText('A'.repeat(24))).toBeInTheDocument()

    renderBreadcrumb({ items: [{ label: 'B'.repeat(25) }] })
    expect(screen.getByText(`${'B'.repeat(23)}…`)).toBeInTheDocument()
  })

  it('keeps item order stable for duplicate labels', () => {
    renderItems([{ label: 'Same', href: '/a' }, { label: 'Same', href: '/b' }, { label: 'Same' }])

    const list = screen.getByTestId('breadcrumb-list')
    expect(list.querySelectorAll('.breadcrumb-item')).toHaveLength(3)
    const links = screen.getAllByRole('link', { name: 'Same' })
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/a', '/b'])
  })

  it('renders long trails without dropping first or last crumb', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      label: `Crumb ${i}`,
      href: i === 11 ? undefined : `/c/${i}`,
    }))
    renderItems(items)

    expect(screen.getByRole('link', { name: 'Crumb 0' })).toBeInTheDocument()
    expect(screen.getByText('Crumb 11')).toHaveAttribute('aria-current', 'page')
  })
})
