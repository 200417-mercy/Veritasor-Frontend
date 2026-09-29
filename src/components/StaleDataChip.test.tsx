import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StaleDataChip, { type StaleDataChipProps } from './StaleDataChip'

const FETCHED_AT = '2026-07-27T10:00:00Z'

/**
 * Compile-time guard on the public prop surface: this annotation fails to
 * type-check if `StaleDataChipProps` gains, loses, or renames a key.
 */
const PROP_KEYS: Array<keyof StaleDataChipProps> = ['fetchedAt', 'className']

/** Falsy values that are not `string` but can reach the component from untyped JS. */
const FALSY_RUNTIME_VALUES: Array<[label: string, value: unknown]> = [
  ['null', null],
  ['zero', 0],
  ['false', false],
  ['NaN', Number.NaN],
]

/**
 * Truthy non-string values. The component only guards on truthiness, so these
 * render a chip and are interpolated into the label by the template literal.
 */
const TRUTHY_RUNTIME_VALUES: Array<[label: string, value: unknown, expected: string]> = [
  ['empty array', [], ''],
  ['plain object', {}, '[object Object]'],
  ['fractional number', 0.5, '0.5'],
]

/**
 * Truthy strings that are not valid ISO-8601 timestamps. The component never
 * parses `fetchedAt`, so these must be echoed back verbatim.
 */
const MALFORMED_TIMESTAMPS: Array<[label: string, value: string]> = [
  ['free text', 'not-a-date'],
  ['impossible date', '2026-13-45T99:99:99Z'],
  ['leading space', ' 2026-07-27T10:00:00Z'],
  ['whitespace only', '   '],
  ['single character', 'x'],
  ['html-ish', '<b>2026</b>'],
  ['very long', '2'.repeat(500)],
]

/** Casts a runtime-invalid value into the `fetchedAt` prop slot. */
const asFetchedAt = (value: unknown) => value as unknown as string

function renderChip(props: StaleDataChipProps) {
  return render(<StaleDataChip {...props} />)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('StaleDataChip behavior', () => {
  describe('StaleDataChipProps contract', () => {
    it('exposes exactly the fetchedAt and className props', () => {
      expect(PROP_KEYS).toHaveLength(2)
      expect([...PROP_KEYS]).toEqual(['fetchedAt', 'className'])
    })

    it('treats both props as optional', () => {
      const noProps: StaleDataChipProps = {}
      const { container } = render(<StaleDataChip {...noProps} />)
      expect(container).toBeEmptyDOMElement()
    })

    it('accepts a fully populated props object', () => {
      const props: StaleDataChipProps = { fetchedAt: FETCHED_AT, className: 'chip-inline' }
      renderChip(props)
      expect(screen.getByRole('status')).toHaveClass('stale-data-chip', 'chip-inline')
    })

    it('accepts each prop independently', () => {
      const { container, rerender } = render(<StaleDataChip fetchedAt={FETCHED_AT} />)
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', expect.stringContaining(FETCHED_AT))

      // className alone is not enough to render: fetchedAt gates visibility.
      rerender(<StaleDataChip className="chip-inline" />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('rendering on the success path', () => {
    it('renders a single span with the base class and status role', () => {
      const { container } = renderChip({ fetchedAt: FETCHED_AT })

      expect(container.children).toHaveLength(1)
      const chip = container.firstElementChild
      expect(chip?.tagName).toBe('SPAN')
      expect(chip).toHaveClass('stale-data-chip')
      expect(chip).toHaveAttribute('role', 'status')
    })

    it('builds the accessible name from the fetchedAt timestamp', () => {
      renderChip({ fetchedAt: FETCHED_AT })

      expect(screen.getByRole('status')).toHaveAccessibleName(
        `Data fetched ${FETCHED_AT} may be outdated`,
      )
    })

    it('keeps the visible Stale label for sighted users', () => {
      renderChip({ fetchedAt: FETCHED_AT })

      const chip = screen.getByText('Stale')
      expect(chip).toBe(screen.getByRole('status'))
      expect(chip.textContent).toBe('Stale')
    })

    it('renders no child elements beyond the label text', () => {
      renderChip({ fetchedAt: FETCHED_AT, className: 'chip-inline' })

      const chip = screen.getByRole('status')
      expect(chip.children).toHaveLength(0)
      expect(chip.innerHTML).toBe('Stale')
    })

    it('appends className after the base class', () => {
      renderChip({ fetchedAt: FETCHED_AT, className: 'chip-inline' })

      expect(screen.getByRole('status').getAttribute('class')).toBe(
        'stale-data-chip chip-inline',
      )
    })

    it('preserves multiple classes passed through className', () => {
      renderChip({ fetchedAt: FETCHED_AT, className: 'chip-inline is-compact' })

      expect(screen.getByRole('status')).toHaveClass(
        'stale-data-chip',
        'chip-inline',
        'is-compact',
      )
    })

    it('trims the joined class string when className is whitespace only', () => {
      renderChip({ fetchedAt: FETCHED_AT, className: '   ' })

      expect(screen.getByRole('status').getAttribute('class')).toBe('stale-data-chip')
    })

    it('trims only the ends of the joined class string', () => {
      // `stale-data-chip ${className}`.trim() trims the outer edges only, so
      // padding the caller value survives as extra inner whitespace.
      renderChip({ fetchedAt: FETCHED_AT, className: '  chip-inline  ' })

      expect(screen.getByRole('status').getAttribute('class')).toBe(
        'stale-data-chip   chip-inline',
      )
    })
  })

  describe('invalid and boundary inputs', () => {
    it('renders nothing when the prop is omitted', () => {
      const { container } = render(<StaleDataChip />)

      expect(container).toBeEmptyDOMElement()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByText('Stale')).not.toBeInTheDocument()
    })

    it('renders nothing when the prop is explicitly undefined', () => {
      const { container } = render(<StaleDataChip fetchedAt={undefined} />)

      expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing for an empty fetchedAt string', () => {
      const { container } = renderChip({ fetchedAt: '' })

      expect(container).toBeEmptyDOMElement()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it.each(FALSY_RUNTIME_VALUES)(
      'renders nothing for the falsy runtime value %s',
      (_label, value) => {
        const { container } = render(<StaleDataChip fetchedAt={asFetchedAt(value)} />)

        expect(container).toBeEmptyDOMElement()
      },
    )

    it.each(FALSY_RUNTIME_VALUES)(
      'does not throw when rendered with the falsy runtime value %s',
      (_label, value) => {
        expect(() => render(<StaleDataChip fetchedAt={asFetchedAt(value)} />)).not.toThrow()
      },
    )

    it.each(TRUTHY_RUNTIME_VALUES)(
      'renders the chip for the truthy non-string value %s',
      (_label, value, expected) => {
        render(<StaleDataChip fetchedAt={asFetchedAt(value)} />)

        const chip = screen.getByRole('status')
        expect(chip).toHaveAttribute(
          'aria-label',
          `Data fetched ${expected} may be outdated`,
        )
        expect(chip).toHaveTextContent('Stale')
      },
    )

    it.each(MALFORMED_TIMESTAMPS)(
      'renders the chip and echoes the %s timestamp verbatim into the aria-label',
      (_label, value) => {
        renderChip({ fetchedAt: value })

        const chip = screen.getByRole('status')
        // The raw attribute is the contract: nothing is trimmed or parsed, so
        // no `Invalid Date` and no normalisation can leak into the label.
        expect(chip.getAttribute('aria-label')).toBe(
          `Data fetched ${value} may be outdated`,
        )
        expect(chip).toHaveTextContent('Stale')
        expect(chip.textContent).not.toContain('Invalid Date')
      },
    )

    it('normalises whitespace only in the computed accessible name', () => {
      // accname collapses runs of whitespace, but the attribute keeps them.
      const padded = '   '
      renderChip({ fetchedAt: padded })

      const chip = screen.getByRole('status')
      expect(chip.getAttribute('aria-label')).toBe(
        `Data fetched ${padded} may be outdated`,
      )
      expect(chip).toHaveAccessibleName('Data fetched may be outdated')
    })

    it('does not read the system clock when building the accessible name', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('1999-12-31T23:59:59Z'))

      renderChip({ fetchedAt: FETCHED_AT })

      expect(screen.getByRole('status')).toHaveAccessibleName(
        `Data fetched ${FETCHED_AT} may be outdated`,
      )
    })

    it('renders a chip for a boundary ISO-8601 value without normalising it', () => {
      const boundary = '0000-01-01T00:00:00.000Z'
      renderChip({ fetchedAt: boundary })

      expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
        `Data fetched ${boundary} may be outdated`,
      )
    })

    it('renders a chip for a non-ISO but plausible local timestamp', () => {
      const local = '2026-07-27 10:00:00'
      renderChip({ fetchedAt: local })

      expect(screen.getByRole('status')).toHaveAccessibleName(
        `Data fetched ${local} may be outdated`,
      )
    })
  })

  describe('primary state transitions', () => {
    it('appears when fetchedAt is added after the first render', () => {
      const { container, rerender } = render(<StaleDataChip />)
      expect(container).toBeEmptyDOMElement()

      rerender(<StaleDataChip fetchedAt={FETCHED_AT} />)
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(container.children).toHaveLength(1)
    })

    it('disappears when fetchedAt is removed after the first render', () => {
      const { container, rerender } = renderChip({ fetchedAt: FETCHED_AT })
      expect(screen.getByRole('status')).toBeInTheDocument()

      rerender(<StaleDataChip />)
      expect(container).toBeEmptyDOMElement()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('moves from hidden to visible when an empty timestamp is filled in', () => {
      const { container, rerender } = renderChip({ fetchedAt: '' })
      expect(container).toBeEmptyDOMElement()

      rerender(<StaleDataChip fetchedAt={FETCHED_AT} />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('moves back to hidden when a valid timestamp is cleared', () => {
      const { container, rerender } = renderChip({ fetchedAt: FETCHED_AT })

      rerender(<StaleDataChip fetchedAt="" />)
      expect(container).toBeEmptyDOMElement()
    })

    it('updates the accessible name in place when the timestamp changes', () => {
      const { rerender } = renderChip({ fetchedAt: FETCHED_AT })
      const first = screen.getByRole('status')

      const newer = '2026-07-27T10:05:00Z'
      rerender(<StaleDataChip fetchedAt={newer} />)

      const second = screen.getByRole('status')
      expect(second).toHaveAccessibleName(`Data fetched ${newer} may be outdated`)
      expect(second).toBe(first)
    })

    it('keeps the base class while className comes and goes', () => {
      const { rerender } = renderChip({ fetchedAt: FETCHED_AT, className: 'chip-inline' })
      expect(screen.getByRole('status')).toHaveClass('stale-data-chip', 'chip-inline')

      rerender(<StaleDataChip fetchedAt={FETCHED_AT} />)
      expect(screen.getByRole('status').getAttribute('class')).toBe('stale-data-chip')

      rerender(<StaleDataChip fetchedAt={FETCHED_AT} className="is-compact" />)
      expect(screen.getByRole('status')).toHaveClass('stale-data-chip', 'is-compact')
    })

    it('preserves its invariants across repeated visible/hidden toggles', () => {
      const { container, rerender } = renderChip({ fetchedAt: FETCHED_AT })

      const cycle: Array<string | undefined> = [undefined, FETCHED_AT, '', FETCHED_AT, undefined]

      for (const fetchedAt of cycle) {
        rerender(<StaleDataChip fetchedAt={fetchedAt} />)

        if (fetchedAt) {
          expect(screen.getByRole('status')).toHaveAccessibleName(
            `Data fetched ${fetchedAt} may be outdated`,
          )
          expect(container.children).toHaveLength(1)
        } else {
          expect(container).toBeEmptyDOMElement()
          expect(screen.queryByRole('status')).not.toBeInTheDocument()
        }
      }
    })
  })

  describe('accessibility contract', () => {
    it('exposes a status role with an explicit aria-label', () => {
      renderChip({ fetchedAt: FETCHED_AT })

      const chip = screen.getByRole('status')
      expect(chip).toHaveAttribute('aria-label')
      expect(chip.getAttribute('aria-label')).toContain(FETCHED_AT)
    })

    it('is not focusable and holds no interactive descendants', () => {
      renderChip({ fetchedAt: FETCHED_AT, className: 'chip-inline' })

      const chip = screen.getByRole('status')
      expect(chip).not.toHaveAttribute('tabindex')
      expect(chip.querySelector('[tabindex]')).toBeNull()
      expect(chip.querySelector('a, button, input, select, textarea')).toBeNull()
    })

    it('is not hidden from assistive technology', () => {
      renderChip({ fetchedAt: FETCHED_AT })

      const chip = screen.getByRole('status')
      expect(chip).not.toHaveAttribute('aria-hidden')
      expect(chip).not.toHaveAttribute('hidden')
    })
  })
})
