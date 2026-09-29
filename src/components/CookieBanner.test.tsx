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

/**
 * Renders CookieBanner with CookieConsentProvider (and MemoryRouter for the
 * policy link inside the banner).
 */
function renderBanner(initialStorage?: ConsentState | null) {
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
        <CookieBanner />
      </CookieConsentProvider>
    </MemoryRouter>,
  )
}

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

// ─── CookieBanner — initial render ───────────────────────────────────────────

describe('CookieBanner — initial render (first visit)', () => {
  it('renders the banner dialog', () => {
    renderBanner(null)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('dialog has aria-modal="false" (not a true modal)', () => {
    renderBanner(null)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false')
  })

  it('dialog has accessible label via aria-labelledby', () => {
    renderBanner(null)
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId!)).toHaveTextContent(/your privacy choices/i)
  })

  it('shows heading "Your privacy choices"', () => {
    renderBanner(null)
    expect(screen.getByRole('heading', { name: /your privacy choices/i })).toBeInTheDocument()
  })

  it('shows description mentioning cookies', () => {
    renderBanner(null)
    expect(screen.getByText(/we use cookies/i)).toBeInTheDocument()
  })

  it('shows privacy policy link', () => {
    renderBanner(null)
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument()
  })

  it('renders the Accept all button', () => {
    renderBanner(null)
    expect(screen.getByRole('button', { name: /accept all cookies/i })).toBeInTheDocument()
  })

  it('renders the Reject all button', () => {
    renderBanner(null)
    expect(screen.getByRole('button', { name: /reject optional cookies/i })).toBeInTheDocument()
  })

  it('renders the Manage preferences button', () => {
    renderBanner(null)
    expect(screen.getByRole('button', { name: /manage preferences/i })).toBeInTheDocument()
  })

  it('does NOT show the banner when consent already stored', () => {
    renderBanner({ analytics: true, marketing: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

// ─── Equal visual weight ─────────────────────────────────────────────────────

describe('CookieBanner — equal visual weight (no dark patterns)', () => {
  it('Accept and Reject buttons share the cc-btn base class', () => {
    renderBanner(null)
    const accept = screen.getByRole('button', { name: /accept all cookies/i })
    const reject = screen.getByRole('button', { name: /reject optional cookies/i })
    expect(accept.className).toMatch(/cc-btn/)
    expect(reject.className).toMatch(/cc-btn/)
  })

  it('neither button uses a disabled attribute', () => {
    renderBanner(null)
    expect(screen.getByRole('button', { name: /accept all cookies/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /reject optional cookies/i })).not.toBeDisabled()
  })
})

// ─── Accept / Reject actions ──────────────────────────────────────────────────

describe('CookieBanner — Accept all', () => {
  it('hides the banner after accepting', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /accept all cookies/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('persists analytics=true to localStorage', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /accept all cookies/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored.analytics).toBe(true)
  })

  it('persists marketing=true to localStorage', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /accept all cookies/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored.marketing).toBe(true)
  })
})

describe('CookieBanner — Reject all', () => {
  it('hides the banner after rejecting', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /reject optional cookies/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('persists analytics=false to localStorage', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /reject optional cookies/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored.analytics).toBe(false)
  })

  it('persists marketing=false to localStorage', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /reject optional cookies/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored.marketing).toBe(false)
  })
})

// ─── Focus management ─────────────────────────────────────────────────────────

describe('CookieBanner — focus management', () => {
  it('moves focus to the Accept button when the banner renders', () => {
    renderBanner(null)
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /accept all cookies/i }),
    )
  })
})

// ─── Keyboard — ESC ──────────────────────────────────────────────────────────

describe('CookieBanner — ESC key', () => {
  it('ESC rejects all (dismiss without deciding) on first visit', () => {
    renderBanner(null)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored.analytics).toBe(false)
    expect(stored.marketing).toBe(false)
  })

  it('ESC closes the banner without changing consent when hasDecided=true', () => {
    renderConsumer({ analytics: true, marketing: true })
    // Re-open settings
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Consent unchanged
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored.analytics).toBe(true)
    expect(stored.marketing).toBe(true)
  })

  it('other keys do not close the banner', () => {
    renderBanner(null)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// ─── Manage preferences panel ────────────────────────────────────────────────

describe('CookieBanner — Manage preferences panel', () => {
  it('preference panel is hidden by default', () => {
    renderBanner(null)
    expect(screen.queryByRole('group', { name: /cookie preferences/i })).not.toBeInTheDocument()
  })

  it('clicking Manage preferences reveals the panel', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    expect(screen.getByRole('group', { name: /cookie preferences/i })).toBeInTheDocument()
  })

  it('Manage preferences button becomes "Hide preferences" when panel is open', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    expect(screen.getByRole('button', { name: /hide preferences/i })).toBeInTheDocument()
  })

  it('manage button has aria-expanded=false initially', () => {
    renderBanner(null)
    expect(screen.getByRole('button', { name: /manage preferences/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('manage button has aria-expanded=true after opening', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    expect(screen.getByRole('button', { name: /hide preferences/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('manage button aria-controls references the panel id', () => {
    renderBanner(null)
    const btn = screen.getByRole('button', { name: /manage preferences/i })
    const panelId = btn.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    fireEvent.click(btn)
    expect(document.getElementById(panelId!)).toBeInTheDocument()
  })

  it('clicking Hide preferences collapses the panel', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    fireEvent.click(screen.getByRole('button', { name: /hide preferences/i }))
    expect(screen.queryByRole('group', { name: /cookie preferences/i })).not.toBeInTheDocument()
  })
})

// ─── Toggle switches in preferences panel ────────────────────────────────────

describe('CookieBanner — toggle switches', () => {
  function openPanel() {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
  }

  it('renders Essential, Analytics, and Marketing toggles', () => {
    openPanel()
    expect(screen.getByLabelText(/essential/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/analytics/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/marketing/i)).toBeInTheDocument()
  })

  it('Essential toggle is checked', () => {
    openPanel()
    expect(screen.getByLabelText(/essential \(always active\)/i)).toBeChecked()
  })

  it('Essential toggle is disabled', () => {
    openPanel()
    expect(screen.getByLabelText(/essential \(always active\)/i)).toBeDisabled()
  })

  it('Analytics toggle is unchecked by default (first visit)', () => {
    openPanel()
    expect(screen.getByLabelText(/^analytics$/i)).not.toBeChecked()
  })

  it('Marketing toggle is unchecked by default (first visit)', () => {
    openPanel()
    expect(screen.getByLabelText(/^marketing$/i)).not.toBeChecked()
  })

  it('clicking Analytics toggle changes its state', () => {
    openPanel()
    const toggle = screen.getByLabelText(/^analytics$/i)
    fireEvent.click(toggle)
    expect(toggle).toBeChecked()
  })

  it('clicking Marketing toggle changes its state', () => {
    openPanel()
    const toggle = screen.getByLabelText(/^marketing$/i)
    fireEvent.click(toggle)
    expect(toggle).toBeChecked()
  })

  it('toggles have role=switch', () => {
    openPanel()
    const analytics = screen.getByLabelText(/^analytics$/i)
    expect(analytics).toHaveAttribute('role', 'switch')
  })

  it('Analytics pre-populated from existing consent on settings re-open', () => {
    // Render with analytics=true already stored
    render(
      <MemoryRouter>
        <CookieConsentProvider>
          <ConsentConsumer />
          <CookieBanner />
        </CookieConsentProvider>
      </MemoryRouter>,
    )
    // Set up storage as if previously accepted analytics
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: true, marketing: false }))

    cleanup()
    render(
      <MemoryRouter>
        <CookieConsentProvider>
          <ConsentConsumer />
          <CookieBanner />
        </CookieConsentProvider>
      </MemoryRouter>,
    )

    // Open settings
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }))
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    expect(screen.getByLabelText(/^analytics$/i)).toBeChecked()
    expect(screen.getByLabelText(/^marketing$/i)).not.toBeChecked()
  })
})

// ─── Save preferences ─────────────────────────────────────────────────────────

describe('CookieBanner — Save preferences', () => {
  it('renders a Save preferences button in the panel', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    expect(screen.getByRole('button', { name: /save preferences/i })).toBeInTheDocument()
  })

  it('saves custom analytics=true, marketing=false', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    fireEvent.click(screen.getByLabelText(/^analytics$/i))
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored.analytics).toBe(true)
    expect(stored.marketing).toBe(false)
  })

  it('saves custom analytics=false, marketing=true', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    fireEvent.click(screen.getByLabelText(/^marketing$/i))
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored.analytics).toBe(false)
    expect(stored.marketing).toBe(true)
  })

  it('saves with all optional off', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    // Don't toggle anything
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored.analytics).toBe(false)
    expect(stored.marketing).toBe(false)
  })

  it('hides the banner after saving preferences', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

// ─── Revisit settings (Cancel button) ────────────────────────────────────────

describe('CookieBanner — revisit settings / Cancel', () => {
  it('shows Cancel button when hasDecided and panel is open', () => {
    renderConsumer({ analytics: false, marketing: false })
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }))
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('Cancel closes the banner without persisting changes', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: true, marketing: true }))
    renderConsumer()
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }))
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    // Uncheck analytics
    fireEvent.click(screen.getByLabelText(/^analytics$/i))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    // Banner hidden
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Storage unchanged
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored.analytics).toBe(true)
  })

  it('does not show Cancel button on first visit (no prior decision)', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  it('Accept all still works when settings were re-opened', () => {
    renderConsumer({ analytics: false, marketing: false })
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }))
    fireEvent.click(screen.getByRole('button', { name: /accept all cookies/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ConsentState
    expect(stored.analytics).toBe(true)
    expect(stored.marketing).toBe(true)
  })
})

// ─── localStorage persistence ─────────────────────────────────────────────────

describe('CookieBanner — localStorage', () => {
  it('does not write to localStorage before user interacts', () => {
    renderBanner(null)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('writes to localStorage on Accept all', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /accept all cookies/i }))
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('writes to localStorage on Reject all', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /reject optional cookies/i }))
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('handles localStorage.getItem throwing gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    // Should render without throwing
    expect(() => renderBanner()).not.toThrow()
  })

  it('handles localStorage.setItem throwing gracefully', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage full')
    })
    renderBanner(null)
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: /accept all cookies/i })),
    ).not.toThrow()
  })
})

// ─── Accessibility ────────────────────────────────────────────────────────────

describe('CookieBanner — accessibility', () => {
  it('essential toggle has aria-describedby pointing to its description', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    const essential = screen.getByLabelText(/essential \(always active\)/i)
    const descId = essential.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    expect(document.getElementById(descId!)).toHaveTextContent(/required for core features/i)
  })

  it('analytics toggle has aria-describedby pointing to its description', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    const analytics = screen.getByLabelText(/^analytics$/i)
    const descId = analytics.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    expect(document.getElementById(descId!)).toHaveTextContent(/understand how you use/i)
  })

  it('marketing toggle has aria-describedby pointing to its description', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    const marketing = screen.getByLabelText(/^marketing$/i)
    const descId = marketing.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    expect(document.getElementById(descId!)).toHaveTextContent(/personalised content/i)
  })

  it('preference group has role=group with accessible label', () => {
    renderBanner(null)
    fireEvent.click(screen.getByRole('button', { name: /manage preferences/i }))
    expect(screen.getByRole('group', { name: /cookie preferences/i })).toBeInTheDocument()
  })
})
