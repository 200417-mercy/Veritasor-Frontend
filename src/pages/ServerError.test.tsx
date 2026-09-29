import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import ServerError from './ServerError'

function renderPage(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ServerError />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── document title side effect (the useEffect branch) ─────────────────────

describe('ServerError - document title', () => {
  it('sets a descriptive document title on mount', () => {
    document.title = 'previous title'
    renderPage()

    expect(document.title).toBe('Something went wrong - Veritasor')
  })
})

// ─── static content / accessibility contract ──────────────────────────────

describe('ServerError - content', () => {
  it('renders the 500 eyebrow and an accessible heading', () => {
    renderPage()

    expect(screen.getByText('500 error')).toBeInTheDocument()

    const section = screen.getByRole('region', { name: 'Something went wrong on our side' })
    expect(section).toHaveAttribute('aria-labelledby', 'server-error-title')

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveAttribute('id', 'server-error-title')
    expect(heading).toHaveTextContent('Something went wrong on our side')

    expect(
      screen.getByText(/We hit an unexpected problem while processing your request/i),
    ).toBeInTheDocument()
  })

  it('exposes the recovery actions in a labelled group', () => {
    renderPage()

    expect(screen.getByLabelText('Recovery actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View status page' })).toBeInTheDocument()
  })

  it('links the status page safely in a new tab', () => {
    renderPage()

    const statusLink = screen.getByRole('link', { name: 'View status page' })
    expect(statusLink).toHaveAttribute('href', 'https://status.veritasor.com')
    expect(statusLink).toHaveAttribute('target', '_blank')
    expect(statusLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders the support links with their helper copy', () => {
    renderPage()

    const support = screen.getByLabelText('Additional support links')
    expect(support).toBeInTheDocument()

    const dashboard = screen.getByRole('link', { name: /Back to dashboard/ })
    const contact = screen.getByRole('link', { name: /Contact support/ })

    expect(dashboard).toHaveAttribute('href', '/')
    expect(contact).toHaveAttribute('href', '/help')
    expect(dashboard).toHaveTextContent('Return to a known working page.')
    expect(contact).toHaveTextContent('Let us know if the problem continues.')
  })

  it('renders the decorative illustration as aria-hidden', () => {
    const { container } = renderPage()

    const illustration = container.querySelector('svg')
    expect(illustration).toBeInTheDocument()
    expect(illustration?.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})

// ─── retry behavior ────────────────────────────────────────────────────────

describe('ServerError - retry', () => {
  it('reloads the page when Try again is clicked', () => {
    const reload = vi.fn()
    const original = window.location.reload

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload, href: original ? window.location.href : '' },
    })

    try {
      renderPage()

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: window.location,
      })
    }
  })
})
