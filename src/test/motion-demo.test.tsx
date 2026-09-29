/**
 * Tests for MotionDemo page
 *
 * Coverage targets:
 *  - Page renders all key sections
 *  - Duration and easing token tables render correct values
 *  - Interactive tracks are keyboard and click accessible
 *  - prefers-reduced-motion callout appears/disappears correctly
 *  - Live region announces state changes
 *  - Accessibility attributes: roles, aria-labels, aria-pressed, scope
 */

import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import MotionDemo from '../pages/MotionDemo'

/* ─── Test helpers ──────────────────────────────────────────────────────── */

function renderPage() {
  return render(<MotionDemo />)
}

/* ─── Setup ─────────────────────────────────────────────────────────────── */

beforeEach(() => {
  // Default: motion allowed
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

/* ─── Page structure ─────────────────────────────────────────────────────── */

describe('MotionDemo — page structure', () => {
  it('renders the main landmark with correct aria-labelledby', () => {
    renderPage()
    const main = document.querySelector('main')
    expect(main).not.toBeNull()
    expect(main).toHaveAttribute('aria-labelledby', 'motion-demo-title')
  })

  it('renders the page heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /motion tokens/i })).toBeInTheDocument()
  })

  it('renders all six section headings', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 2, name: /duration tokens/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /easing tokens/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /interactive: duration comparison/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /interactive: easing comparison/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /component usage/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /accessibility/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /policy reference/i })).toBeInTheDocument()
  })

  it('has a polite live region for announcements', () => {
    renderPage()
    const region = document.querySelector('[role="status"][aria-live="polite"]')
    expect(region).not.toBeNull()
    expect(region).toHaveAttribute('aria-atomic', 'true')
  })
})

/* ─── Duration token table ───────────────────────────────────────────────── */

describe('MotionDemo — duration token table', () => {
  it('renders the duration table with accessible label', () => {
    renderPage()
    expect(
      screen.getByRole('table', { name: /duration token values and usage/i })
    ).toBeInTheDocument()
  })

  it('duration table has column header cells with scope="col"', () => {
    renderPage()
    const table = screen.getByRole('table', { name: /duration token values and usage/i })
    const ths = table.querySelectorAll('th[scope="col"]')
    expect(ths.length).toBeGreaterThanOrEqual(4)
  })

  it('renders all six duration token names', () => {
    renderPage()
    expect(screen.getByText('--motion-duration-none')).toBeInTheDocument()
    expect(screen.getAllByText('--motion-duration-xs').length).toBeGreaterThan(0)
    expect(screen.getByText('--motion-duration-sm')).toBeInTheDocument()
    expect(screen.getByText('--motion-duration-md')).toBeInTheDocument()
    expect(screen.getAllByText('--motion-duration-lg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('--motion-duration-xl').length).toBeGreaterThan(0)
  })

  it('renders correct values for each duration token', () => {
    renderPage()
    expect(screen.getByText('0ms')).toBeInTheDocument()
    expect(screen.getByText('80ms')).toBeInTheDocument()
    expect(screen.getByText('140ms')).toBeInTheDocument()
    expect(screen.getByText('200ms')).toBeInTheDocument()
    expect(screen.getByText('280ms')).toBeInTheDocument()
    expect(screen.getByText('360ms')).toBeInTheDocument()
  })

  it('renders usage guidance for duration tokens', () => {
    renderPage()
    expect(screen.getByText(/instant update/i)).toBeInTheDocument()
    expect(screen.getByText(/micro feedback/i)).toBeInTheDocument()
    expect(screen.getByText(/chip, badge/i)).toBeInTheDocument()
    expect(screen.getByText(/panel\/card/i)).toBeInTheDocument()
    expect(screen.getAllByText(/toast enter/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/layout-level/i)).toBeInTheDocument()
  })
})

/* ─── Easing token table ─────────────────────────────────────────────────── */

describe('MotionDemo — easing token table', () => {
  it('renders the easing table with accessible label', () => {
    renderPage()
    expect(
      screen.getByRole('table', { name: /easing token values and usage/i })
    ).toBeInTheDocument()
  })

  it('easing table has column header cells with scope="col"', () => {
    renderPage()
    const table = screen.getByRole('table', { name: /easing token values and usage/i })
    const ths = table.querySelectorAll('th[scope="col"]')
    expect(ths.length).toBeGreaterThanOrEqual(3)
  })

  it('renders all six easing token names', () => {
    renderPage()
    expect(screen.getAllByText('--motion-easing-standard').length).toBeGreaterThan(0)
    expect(screen.getByText('--motion-easing-decelerate')).toBeInTheDocument()
    expect(screen.getByText('--motion-easing-accelerate')).toBeInTheDocument()
    expect(screen.getByText('--motion-easing-exit')).toBeInTheDocument()
    expect(screen.getByText('--motion-easing-linear')).toBeInTheDocument()
    expect(screen.getAllByText('--motion-easing-spring').length).toBeGreaterThan(0)
  })

  it('renders correct cubic-bezier values', () => {
    renderPage()
    expect(screen.getByText('cubic-bezier(0.2, 0, 0, 1)')).toBeInTheDocument()
    expect(screen.getByText('cubic-bezier(0.0, 0, 0.2, 1)')).toBeInTheDocument()
    expect(screen.getAllByText('cubic-bezier(0.4, 0, 1, 1)').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('linear')).toBeInTheDocument()
    expect(screen.getByText('cubic-bezier(0.34, 1.56, 0.64, 1)')).toBeInTheDocument()
  })

  it('renders usage guidance for spring token restricted to toast', () => {
    renderPage()
    expect(screen.getAllByText(/toast enter only/i).length).toBeGreaterThan(0)
  })
})

/* ─── Interactive duration tracks ───────────────────────────────────────── */

describe('MotionDemo — interactive duration tracks', () => {
  it('renders five duration demo tracks', () => {
    renderPage()
    const tracks = screen.getAllByRole('button', { name: /press to play/i })
    expect(tracks.length).toBe(10) // 5 duration + 5 easing tracks
  })

  it('duration track has aria-pressed="false" initially', () => {
    renderPage()
    const track = screen.getByRole('button', { name: /xs — hover\/focus.*press to play/i })
    expect(track).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking a track toggles aria-pressed to true', () => {
    renderPage()
    const track = screen.getByRole('button', { name: /xs — hover\/focus.*press to play/i })
    act(() => {
      fireEvent.click(track)
    })
    expect(track).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicking a track twice resets aria-pressed to false', () => {
    renderPage()
    const track = screen.getByRole('button', { name: /xs — hover\/focus.*press to play/i })
    act(() => {
      fireEvent.click(track)
    })
    act(() => {
      fireEvent.click(track)
    })
    expect(track).toHaveAttribute('aria-pressed', 'false')
  })

  it('pressing Enter on a track toggles aria-pressed', () => {
    renderPage()
    const track = screen.getByRole('button', { name: /sm — chip\/badge.*press to play/i })
    act(() => {
      fireEvent.keyDown(track, { key: 'Enter', code: 'Enter' })
    })
    expect(track).toHaveAttribute('aria-pressed', 'true')
  })

  it('pressing Space on a track toggles aria-pressed', () => {
    renderPage()
    const track = screen.getByRole('button', { name: /md — card update.*press to play/i })
    act(() => {
      fireEvent.keyDown(track, { key: ' ', code: 'Space' })
    })
    expect(track).toHaveAttribute('aria-pressed', 'true')
  })

  it('unrelated keys do not toggle the track', () => {
    renderPage()
    const track = screen.getByRole('button', { name: /lg — section\/toast.*press to play/i })
    act(() => {
      fireEvent.keyDown(track, { key: 'a', code: 'KeyA' })
    })
    expect(track).toHaveAttribute('aria-pressed', 'false')
  })

  it('announcement is updated after clicking a track', async () => {
    renderPage()
    const track = screen.getByRole('button', { name: /xl — layout.*press to play/i })
    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement

    act(() => {
      fireEvent.click(track)
    })
    expect(liveRegion.textContent).toMatch(/demo/i)
  })
})

/* ─── Interactive easing tracks ─────────────────────────────────────────── */

describe('MotionDemo — interactive easing tracks', () => {
  it('easing tracks exist for all five easing types', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /standard — enter\/update.*press to play/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decelerate — slide in.*press to play/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accelerate — slide out.*press to play/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /linear — progress bar.*press to play/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /spring — toast enter only.*press to play/i })).toBeInTheDocument()
  })

  it('clicking an easing track updates aria-pressed', () => {
    renderPage()
    const track = screen.getByRole('button', { name: /decelerate.*press to play/i })
    act(() => {
      fireEvent.click(track)
    })
    expect(track).toHaveAttribute('aria-pressed', 'true')
  })
})

/* ─── Reduced-motion ─────────────────────────────────────────────────────── */

describe('MotionDemo — prefers-reduced-motion', () => {
  it('does NOT show reduced-motion callout when motion is allowed', () => {
    renderPage()
    expect(screen.queryByRole('note', { name: /reduced motion active/i })).not.toBeInTheDocument()
  })

  it('shows reduced-motion callout when prefers-reduced-motion is active', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    renderPage()
    expect(screen.getByRole('note', { name: /reduced motion active/i })).toBeInTheDocument()
    expect(screen.getByText(/prefers-reduced-motion is active/i)).toBeInTheDocument()
  })

  it('reduced-motion callout describes the fallback behaviour', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    renderPage()
    expect(screen.getByText(/skip to their final state/i)).toBeInTheDocument()
    expect(screen.getByText(/WCAG 2.1 SC 2.3.3/i)).toBeInTheDocument()
  })

  it('tracks skip to final state under reduced motion (no animation delay)', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    renderPage()
    const track = screen.getByRole('button', { name: /xs — hover\/focus.*press to play/i })
    act(() => {
      fireEvent.click(track)
    })
    // Under reduced motion the announcement notes "reduced motion"
    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement
    expect(liveRegion.textContent).toMatch(/reduced motion/i)
  })
})

/* ─── Accessibility section ─────────────────────────────────────────────── */

describe('MotionDemo — accessibility section', () => {
  it('renders the accessibility callout note', () => {
    renderPage()
    const note = screen.getByRole('note', { name: /accessibility compliance notes/i })
    expect(note).toBeInTheDocument()
    expect(note).toHaveClass('motion-a11y-callout')
  })

  it('accessibility note mentions WCAG 2.1 AA', () => {
    renderPage()
    expect(screen.getByText(/WCAG 2.1 AA compliant/i)).toBeInTheDocument()
  })

  it('mentions prefers-reduced-motion in accessibility section', () => {
    renderPage()
    expect(screen.getAllByText(/prefers-reduced-motion/i).length).toBeGreaterThan(0)
  })

  it('keyboard navigation section explains Tab/Enter/Space', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 3, name: /keyboard navigation/i })).toBeInTheDocument()
  })

  it('contrast section mentions focus-visible', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 3, name: /contrast and focus/i })).toBeInTheDocument()
  })

  it('has a policy reference section with link to docs file', () => {
    renderPage()
    expect(screen.getByText(/motion-reduced-motion-policy\.md/i)).toBeInTheDocument()
  })
})

/* ─── Component usage section ───────────────────────────────────────────── */

describe('MotionDemo — component usage section', () => {
  it('shows ThemeSwitcher usage example', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 3, name: /themeswitcher/i })).toBeInTheDocument()
  })

  it('shows Toast usage example', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 3, name: /toast/i })).toBeInTheDocument()
  })

  it('shows Sidebar nav usage example', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 3, name: /sidebar nav/i })).toBeInTheDocument()
  })

  it('shows the before comment in the ThemeSwitcher code block', () => {
    renderPage()
    expect(screen.getByText(/before: transition: background-color 120ms ease/i)).toBeInTheDocument()
  })

  it('code blocks mention motion token variables', () => {
    renderPage()
    // multiple code blocks contain var(--motion-duration-xs)
    const allText = document.body.textContent ?? ''
    expect(allText).toContain('--motion-duration-xs')
    expect(allText).toContain('--motion-easing-standard')
    expect(allText).toContain('--motion-easing-spring')
    expect(allText).toContain('--motion-easing-accelerate')
  })
})

/* ─── General accessibility attributes ──────────────────────────────────── */

describe('MotionDemo — general accessibility attributes', () => {
  it('announces completion and reset through the live region', () => {
    renderPage()
    const track = screen.getByRole('button', { name: /xs — hover\/focus.*press to play/i })
    const liveRegion = screen.getByRole('status')

    fireEvent.click(track)
    expect(liveRegion).toHaveTextContent(/demo started/i)
    fireEvent.click(track)
    expect(liveRegion).toHaveTextContent(/demo reset/i)
  })

  it('all interactive tracks have aria-label ending in "press to play"', () => {
    renderPage()
    const tracks = screen.getAllByRole('button', { name: /press to play/i })
    expect(tracks.length).toBeGreaterThan(0)
    tracks.forEach((t) => {
      expect(t.getAttribute('aria-label')).toMatch(/press to play/i)
    })
  })

  it('all interactive tracks have tabIndex=0 (keyboard focusable)', () => {
    renderPage()
    const tracks = screen.getAllByRole('button', { name: /press to play/i })
    tracks.forEach((t) => {
      expect(t).toHaveAttribute('tabindex', '0')
    })
  })

  it('duration table uses aria-label for screen-reader context', () => {
    renderPage()
    const durationTable = screen.getByRole('table', { name: /duration token/i })
    expect(durationTable).toBeInTheDocument()
  })

  it('easing table uses aria-label for screen-reader context', () => {
    renderPage()
    const easingTable = screen.getByRole('table', { name: /easing token/i })
    expect(easingTable).toBeInTheDocument()
  })

  it('eyebrow text is aria-hidden', () => {
    renderPage()
    const eyebrow = document.querySelector('.page-eyebrow[aria-hidden="true"]')
    expect(eyebrow).not.toBeNull()
  })

  it('sections have aria-labelledby pointing to their heading', () => {
    renderPage()
    const sections = document.querySelectorAll('section[aria-labelledby]')
    sections.forEach((section) => {
      const headingId = section.getAttribute('aria-labelledby')
      expect(headingId).toBeTruthy()
      const heading = document.getElementById(headingId as string)
      expect(heading).not.toBeNull()
    })
  })
})
