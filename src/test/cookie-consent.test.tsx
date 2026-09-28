import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CookieBanner from '../components/CookieBanner'
import {
  CookieConsentContext,
  CookieConsentProvider,
  STORAGE_KEY,
  useCookieConsent,
} from '../components/CookieConsentContext'
import type { ConsentState } from '../components/CookieConsentContext'

// ─── Helpers ─────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})


/** Helper component that exercises the context API */
function ConsentConsumer() {
  const { hasDecided, consent, bannerVisible, openSettings } = useCookieConsent()
  return (
    <div>
      <span data-testid="decided">{String(hasDecided)}</span>
      <span data-testid="analytics">{String(consent.analytics)}</span>
      <span data-testid="marketing">{String(consent.marketing)}</span>
      <span data-testid="visible">{String(bannerVisible)}</span>
      <button onClick={openSettings}>Open settings</button>
    </div>
  )
}

function renderConsumer(initialStorage?: ConsentState | null) {
  if (initialStorage !== undefined) {
    if (initialStorage === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialStorage))
    }
  }
  return render(
    <MemoryRouter>
      <CookieConsentProvider>
        <ConsentConsumer />
        <CookieBanner />
      </CookieConsentProvider>
    </MemoryRouter>,
  )
}

// ─── CookieConsentContext ─────────────────────────────────────────────────────

describe('CookieConsentContext — first visit', () => {
  it('defaults hasDecided to false when no storage', () => {
    renderConsumer(null)
    expect(screen.getByTestId('decided')).toHaveTextContent('false')
  })

  it('defaults consent to analytics=false, marketing=false', () => {
    renderConsumer(null)
    expect(screen.getByTestId('analytics')).toHaveTextContent('false')
    expect(screen.getByTestId('marketing')).toHaveTextContent('false')
  })

  it('bannerVisible is true on first visit', () => {
    renderConsumer(null)
    expect(screen.getByTestId('visible')).toHaveTextContent('true')
  })
})

describe('CookieConsentContext — returning visit', () => {
  it('reads hasDecided=true from localStorage', () => {
    renderConsumer({ analytics: true, marketing: false })
    expect(screen.getByTestId('decided')).toHaveTextContent('true')
  })

  it('reads stored analytics value', () => {
    renderConsumer({ analytics: true, marketing: false })
    expect(screen.getByTestId('analytics')).toHaveTextContent('true')
  })

  it('reads stored marketing value', () => {
    renderConsumer({ analytics: false, marketing: true })
    expect(screen.getByTestId('marketing')).toHaveTextContent('true')
  })

  it('bannerVisible is false when consent already stored', () => {
    renderConsumer({ analytics: true, marketing: true })
    expect(screen.getByTestId('visible')).toHaveTextContent('false')
  })
})

describe('CookieConsentContext — openSettings', () => {
  it('setting bannerVisible to true via openSettings', () => {
    renderConsumer({ analytics: false, marketing: false })
    expect(screen.getByTestId('visible')).toHaveTextContent('false')
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }))
    expect(screen.getByTestId('visible')).toHaveTextContent('true')
  })
})

describe('CookieConsentContext — invalid localStorage', () => {
  it('treats corrupt storage as first visit', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{{')
    renderConsumer()
    expect(screen.getByTestId('decided')).toHaveTextContent('false')
    expect(screen.getByTestId('visible')).toHaveTextContent('true')
  })
})

describe('useCookieConsent — guard', () => {
  it('throws when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <MemoryRouter>
          <ConsentConsumer />
        </MemoryRouter>,
      ),
    ).toThrow('useCookieConsent must be used within CookieConsentProvider')
    spy.mockRestore()
  })
})

// ─── CookieBanner — initial render ───────────────────────────────────────────

// ─── CookieConsentContext — context value access via exported context ──────────

describe('CookieConsentContext — direct context value', () => {
  it('CookieConsentContext is exported and not undefined initially', () => {
    expect(CookieConsentContext).toBeDefined()
  })

  it('acceptAll updates consent to all-true', () => {
    let capturedAcceptAll: (() => void) | undefined
    function Capture() {
      const { acceptAll } = useCookieConsent()
      capturedAcceptAll = acceptAll
      return null
    }
    render(
      <MemoryRouter>
        <CookieConsentProvider>
          <Capture />
          <ConsentConsumer />
        </CookieConsentProvider>
      </MemoryRouter>,
    )
    act(() => { capturedAcceptAll!() })
    expect(screen.getByTestId('analytics')).toHaveTextContent('true')
    expect(screen.getByTestId('marketing')).toHaveTextContent('true')
  })

  it('rejectAll updates consent to all-false', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: true, marketing: true }))
    let capturedRejectAll: (() => void) | undefined
    function Capture() {
      const { rejectAll } = useCookieConsent()
      capturedRejectAll = rejectAll
      return null
    }
    render(
      <MemoryRouter>
        <CookieConsentProvider>
          <Capture />
          <ConsentConsumer />
        </CookieConsentProvider>
      </MemoryRouter>,
    )
    act(() => { capturedRejectAll!() })
    expect(screen.getByTestId('analytics')).toHaveTextContent('false')
    expect(screen.getByTestId('marketing')).toHaveTextContent('false')
  })

  it('savePreferences persists custom state', () => {
    let capturedSave: ((s: ConsentState) => void) | undefined
    function Capture() {
      const { savePreferences } = useCookieConsent()
      capturedSave = savePreferences
      return null
    }
    render(
      <MemoryRouter>
        <CookieConsentProvider>
          <Capture />
          <ConsentConsumer />
        </CookieConsentProvider>
      </MemoryRouter>,
    )
    act(() => { capturedSave!({ analytics: true, marketing: false }) })
    expect(screen.getByTestId('analytics')).toHaveTextContent('true')
    expect(screen.getByTestId('marketing')).toHaveTextContent('false')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored).toEqual({ analytics: true, marketing: false })
  })

  it('closeBanner only closes when hasDecided=true', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: false, marketing: false }))
    let capturedClose: (() => void) | undefined
    function Capture() {
      const { closeBanner } = useCookieConsent()
      capturedClose = closeBanner
      return null
    }
    render(
      <MemoryRouter>
        <CookieConsentProvider>
          <Capture />
          <ConsentConsumer />
          <CookieBanner />
        </CookieConsentProvider>
      </MemoryRouter>,
    )
    // Banner is hidden initially (hasDecided=true but bannerVisible=false)
    // Re-open it
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    act(() => { capturedClose!() })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

