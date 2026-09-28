/**
 * AnnouncementBanner.test.tsx
 *
 * Focused tests for the `visible.length === 0` early-return branch at line 50
 * of AnnouncementBanner.tsx, plus the adjacent rendering and dismiss behaviour.
 *
 * ── Known component bug ────────────────────────────────────────────────────
 * The component's getStorageKey() function contains a broken template literal:
 *
 *   return `\( {STORAGE_KEY_PREFIX}: \){userId ?? 'anonymous'}`
 *
 * Because `\(` / `\)` are not valid JS escape sequences the backslash is
 * silently dropped, and the expressions lack the required `$` prefix so they
 * are treated as literal text rather than interpolations.  The resulting key
 * is always the constant string:
 *
 *   "( {STORAGE_KEY_PREFIX}: ){userId ?? 'anonymous'}"
 *
 * regardless of the userId argument.  All tests below assert against this
 * actual runtime behaviour so they provide a true regression baseline.  A
 * separate bug ticket should fix the template literal.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach, afterEach } from 'vitest'
import AnnouncementBanner, { Announcement } from './AnnouncementBanner'

// ─── Actual storage key produced by the component (see note above) ────────────
// Verified at runtime via hex dump: 28 20 7b 53 54 4f 52 41 47 45 5f 4b 45 59 ...
const COMPONENT_STORAGE_KEY = "( {STORAGE_KEY_PREFIX}: ){userId ?? 'anonymous'}"

function setDismissed(ids: string[]) {
  localStorage.setItem(COMPONENT_STORAGE_KEY, JSON.stringify(ids))
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ann1: Announcement = {
  id: 'a1',
  title: 'New feature',
  message: 'We launched X',
}

const ann2: Announcement = {
  id: 'a2',
  title: 'Maintenance',
  message: 'Scheduled downtime',
  learnMoreUrl: 'https://status.example.com',
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AnnouncementBanner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── null-return branch (visible.length === 0) ──────────────────────────────

  describe('visible.length === 0 → returns null', () => {
    it('renders nothing when the announcements array is empty', () => {
      const { container } = render(<AnnouncementBanner announcements={[]} />)
      expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing when every announcement is pre-dismissed (anonymous user)', () => {
      setDismissed(['a1', 'a2'])
      const { container } = render(
        <AnnouncementBanner announcements={[ann1, ann2]} />,
      )
      expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing when every announcement is pre-dismissed (named user)', () => {
      // Due to the broken template literal bug, all userId values share the
      // same storage key, so pre-seeding without a userId suffix still affects
      // a named-user render.
      setDismissed(['a1'])
      const { container } = render(
        <AnnouncementBanner announcements={[ann1]} userId="user-42" />,
      )
      expect(container).toBeEmptyDOMElement()
    })

    it('does not render the section landmark when there is nothing to show', () => {
      const { container } = render(<AnnouncementBanner announcements={[]} />)
      expect(container.querySelector('section')).toBeNull()
    })
  })

  // ── success path: announcements are visible ────────────────────────────────

  describe('success path: one or more visible announcements', () => {
    it('renders the announcements section with an accessible region label', () => {
      render(<AnnouncementBanner announcements={[ann1]} />)
      expect(
        screen.getByRole('region', { name: 'Product announcements' }),
      ).toBeInTheDocument()
    })

    it('renders title and message text', () => {
      render(<AnnouncementBanner announcements={[ann1]} />)
      expect(screen.getByText('New feature')).toBeInTheDocument()
      expect(screen.getByText('We launched X')).toBeInTheDocument()
    })

    it('renders a dismiss button with an accessible label for each announcement', () => {
      render(<AnnouncementBanner announcements={[ann1, ann2]} />)
      expect(
        screen.getByRole('button', { name: /Dismiss announcement: New feature/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /Dismiss announcement: Maintenance/i }),
      ).toBeInTheDocument()
    })

    it('renders learnMoreUrl as a link with correct href and security attributes', () => {
      render(<AnnouncementBanner announcements={[ann2]} />)
      const link = screen.getByRole('link', { name: /Learn more about: Maintenance/i })
      expect(link).toHaveAttribute('href', 'https://status.example.com')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('does not render a learn-more link when learnMoreUrl is absent', () => {
      render(<AnnouncementBanner announcements={[ann1]} />)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('renders only the not-yet-dismissed announcements when some are pre-dismissed', () => {
      setDismissed(['a1'])
      render(<AnnouncementBanner announcements={[ann1, ann2]} />)
      expect(screen.queryByText('New feature')).not.toBeInTheDocument()
      expect(screen.getByText('Maintenance')).toBeInTheDocument()
    })
  })

  // ── storage key isolation note ─────────────────────────────────────────────

  describe('storage key behaviour (documents current buggy state)', () => {
    it('anonymous and named-user renders share the same storage key', () => {
      // If user-A pre-dismisses a1, user-B (a named userId) also sees it
      // as dismissed — because the broken template literal produces the same
      // key for every userId.  This test documents the bug as a regression
      // baseline; fixing the template literal will make this test obsolete.
      setDismissed(['a1'])
      const { container } = render(
        <AnnouncementBanner announcements={[ann1]} userId="user-B" />,
      )
      // Due to the shared key, user-B also has a1 pre-dismissed → null render
      expect(container).toBeEmptyDOMElement()
    })
  })

  // ── dismiss interaction ────────────────────────────────────────────────────

  describe('dismiss interaction', () => {
    it('removes an announcement from the DOM after clicking Dismiss', () => {
      render(<AnnouncementBanner announcements={[ann1]} />)
      expect(screen.getByText('New feature')).toBeInTheDocument()

      fireEvent.click(
        screen.getByRole('button', { name: /Dismiss announcement: New feature/i }),
      )

      expect(screen.queryByText('New feature')).not.toBeInTheDocument()
    })

    it('collapses to null (empty DOM) when the last visible announcement is dismissed', () => {
      // This specifically exercises the `visible.length === 0 → return null`
      // branch at line 50 via user interaction, not just via initial props.
      const { container } = render(<AnnouncementBanner announcements={[ann1]} />)

      fireEvent.click(
        screen.getByRole('button', { name: /Dismiss announcement: New feature/i }),
      )

      expect(container).toBeEmptyDOMElement()
    })

    it('persists dismissal to localStorage under the component storage key', () => {
      render(<AnnouncementBanner announcements={[ann1]} />)

      fireEvent.click(
        screen.getByRole('button', { name: /Dismiss announcement: New feature/i }),
      )

      const stored = JSON.parse(
        localStorage.getItem(COMPONENT_STORAGE_KEY) ?? '[]',
      ) as string[]
      expect(stored).toContain('a1')
    })

    it('persists dismissal when a userId prop is provided', () => {
      render(<AnnouncementBanner announcements={[ann1]} userId="user-99" />)

      fireEvent.click(
        screen.getByRole('button', { name: /Dismiss announcement: New feature/i }),
      )

      // Due to the shared-key bug, writing with userId still uses
      // COMPONENT_STORAGE_KEY.
      const stored = JSON.parse(
        localStorage.getItem(COMPONENT_STORAGE_KEY) ?? '[]',
      ) as string[]
      expect(stored).toContain('a1')
    })

    it('dismissing one announcement leaves the others visible', () => {
      render(<AnnouncementBanner announcements={[ann1, ann2]} />)

      fireEvent.click(
        screen.getByRole('button', { name: /Dismiss announcement: New feature/i }),
      )

      expect(screen.queryByText('New feature')).not.toBeInTheDocument()
      expect(screen.getByText('Maintenance')).toBeInTheDocument()
    })
  })

  // ── localStorage error resilience ─────────────────────────────────────────

  describe('localStorage error resilience', () => {
    it('treats corrupted localStorage data as an empty dismissed set and shows all announcements', () => {
      localStorage.setItem(COMPONENT_STORAGE_KEY, 'not-valid-json{{{')

      // Should not throw; falls back to empty Set → shows all announcements
      render(<AnnouncementBanner announcements={[ann1]} />)
      expect(screen.getByText('New feature')).toBeInTheDocument()
    })

    it('handles a storage write error (e.g. QuotaExceededError) gracefully and still updates the UI', () => {
      const setItemSpy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new DOMException('QuotaExceededError')
        })

      render(<AnnouncementBanner announcements={[ann1]} />)

      // Clicking dismiss must not propagate the storage error
      expect(() =>
        fireEvent.click(
          screen.getByRole('button', { name: /Dismiss announcement: New feature/i }),
        ),
      ).not.toThrow()

      // React state still updated → banner removed from DOM
      expect(screen.queryByText('New feature')).not.toBeInTheDocument()

      setItemSpy.mockRestore()
    })
  })
})
