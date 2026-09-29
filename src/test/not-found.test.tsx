import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import NotFound from '../pages/NotFound'

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderNotFound({ path = '/missing-page' }: { path?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotFound', () => {
  describe('document title', () => {
    beforeEach(() => {
      document.title = 'Veritasor'
    })

    afterEach(() => {
      document.title = 'Veritasor'
    })

    it('sets the page title to "Page not found - Veritasor"', () => {
      renderNotFound()
      expect(document.title).toBe('Page not found - Veritasor')
    })

    it('keeps the page title after re-render and restores deterministic state on unmount', () => {
      const { rerender, unmount } = renderNotFound()
      rerender(
        <MemoryRouter initialEntries={['/missing-page']}>
          <Routes>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MemoryRouter>,
      )
      expect(document.title).toBe('Page not found - Veritasor')
      unmount()
      // Effect runs once per mount; the title set at mount time is stable.
      expect(document.title).toBe('Page not found - Veritasor')
    })
  })

  describe('rendering', () => {
    it('renders a section landmark labelled by the heading', () => {
      renderNotFound()
      const section = screen.getByRole('region', {
        name: /we could not find that page/i,
      })
      expect(section).toBeInTheDocument()
    })

    it('renders the 404 eyebrow', () => {
      renderNotFound()
      expect(screen.getByText('404 error')).toBeInTheDocument()
    })

    it('renders the main heading "We could not find that page"', () => {
      renderNotFound()
      const heading = screen.getByRole('heading', {
        name: /we could not find that page/i,
      })
      expect(heading).toHaveAttribute('id', 'not-found-title')
    })

    it('renders explanatory copy about the invalid address', () => {
      renderNotFound()
      expect(
        screen.getByText(/outdated, mistyped, or no longer available/i),
      ).toBeInTheDocument()
    })
  })

  describe('safe navigation actions', () => {
    it('renders the primary action linking to the dashboard', () => {
      renderNotFound()
      const link = screen.getByRole('link', { name: /back to dashboard/i })
      expect(link).toHaveAttribute('href', '/')
      expect(link).toHaveClass('not-found-button-primary')
    })

    it('renders the secondary action linking to login', () => {
      renderNotFound()
      const link = screen.getByRole('link', { name: /go to login/i })
      expect(link).toHaveAttribute('href', '/login')
      expect(link).toHaveClass('not-found-button-secondary')
    })
  })

  describe('support links', () => {
    it('renders the "Review attestations" support link with its description', () => {
      renderNotFound()
      const support = screen.getByLabelText(/additional support links/i)
      const link = within(support).getByRole('link', {
        name: /review attestations/i,
      })
      expect(link).toHaveAttribute('href', '/attestations')
      expect(
        within(link).getByText(/recent revenue evidence/i),
      ).toBeInTheDocument()
    })

    it('renders the "Sign in again" support link with its description', () => {
      renderNotFound()
      const support = screen.getByLabelText(/additional support links/i)
      const link = within(support).getByRole('link', {
        name: /sign in again/i,
      })
      expect(link).toHaveAttribute('href', '/login')
      expect(
        within(link).getByText(/secure access flow/i),
      ).toBeInTheDocument()
    })
  })

  describe('route rendering', () => {
    it('renders for any unmatched path (representative invalid input)', () => {
      renderNotFound({ path: '/totally-unknown/nested/route?ref=404' })
      expect(
        screen.getByRole('heading', { name: /we could not find that page/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: /back to dashboard/i }),
      ).toBeInTheDocument()
    })

    it('renders the full safe-destination set from an unmatched path', () => {
      renderNotFound({ path: '/missing-page' })
      const actions = screen.getByLabelText(/safe destinations/i)
      const links = within(actions).getAllByRole('link')
      expect(links).toHaveLength(2)
      expect(links[0]).toHaveAttribute('href', '/')
      expect(links[1]).toHaveAttribute('href', '/login')
    })
  })
})
