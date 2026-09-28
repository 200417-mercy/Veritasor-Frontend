import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  EmptyStateIllustration,
  EmptyStateIllustrations,
  ILLUSTRATION_META,
  type IllustrationType,
} from './EmptyStateIllustrations'

const TYPES = ['attestations', 'revenue-sources', 'data-export'] satisfies IllustrationType[]

describe('EmptyStateIllustrations', () => {
  it.each(TYPES)('renders %s illustration without crashing', (type) => {
    const { container } = render(<EmptyStateIllustration type={type} />)
    // Should render an SVG
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it.each(TYPES)('renders a descriptive sr-only span for %s', (type) => {
    const { container } = render(<EmptyStateIllustration type={type} />)
    const srSpan = container.querySelector('.sr-only')
    expect(srSpan).toBeInTheDocument()
    expect(srSpan).toHaveTextContent(ILLUSTRATION_META[type].description)
  })

  it('has unique descriptions for each illustration type', () => {
    const descriptions = TYPES.map((t) => ILLUSTRATION_META[t].description)
    const unique = new Set(descriptions)
    expect(unique.size).toBe(descriptions.length)
  })

  it('has meta labels for all types', () => {
    for (const type of TYPES) {
      expect(ILLUSTRATION_META[type].label).toBeTruthy()
      expect(ILLUSTRATION_META[type].description).toBeTruthy()
    }
  })

  it('keeps the public illustration type and metadata keys aligned', () => {
    expect(Object.keys(ILLUSTRATION_META).sort()).toEqual([...TYPES].sort())
    expect(EmptyStateIllustrations.Meta).toBe(ILLUSTRATION_META)
    expect(EmptyStateIllustrations.Illustration).toBe(EmptyStateIllustration)
  })

  it('wraps illustration in a presentation role div', () => {
    const { container } = render(<EmptyStateIllustration type="attestations" />)
    const wrapper = container.querySelector('[role="presentation"]')
    expect(wrapper).toBeInTheDocument()
  })

  it('updates the illustration and accessible description when its type changes', () => {
    const { container, rerender } = render(
      <EmptyStateIllustration type="attestations" />,
    )
    const wrapper = container.querySelector('[role="presentation"]')

    expect(container.querySelector('.sr-only')).toHaveTextContent(
      ILLUSTRATION_META.attestations.description,
    )
    expect(container.querySelector('svg path[d^="M100 44"]')).toBeInTheDocument()

    rerender(<EmptyStateIllustration type="revenue-sources" />)

    expect(container.querySelector('[role="presentation"]')).toBe(wrapper)
    expect(container.querySelector('.sr-only')).toHaveTextContent(
      ILLUSTRATION_META['revenue-sources'].description,
    )
    expect(container.querySelector('svg rect[x="88"][y="52"]')).toBeInTheDocument()

    rerender(<EmptyStateIllustration type="data-export" />)

    expect(container.querySelector('.sr-only')).toHaveTextContent(
      ILLUSTRATION_META['data-export'].description,
    )
    expect(container.querySelector('svg rect[x="80"][y="48"]')).toBeInTheDocument()
  })

  it.each(['unknown', 'toString', undefined])(
    'rejects invalid runtime type %s deterministically',
    (type) => {
      expect(() =>
        render(
          <EmptyStateIllustration type={type as IllustrationType} />,
        ),
      ).toThrow(RangeError)
    },
  )
})
