import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Footer from './Footer'
import { CookieConsentContext, CookieConsentProvider } from './CookieConsentContext'

describe('Footer', () => {
  it('renders correctly with the current year', () => {
    render(
      <CookieConsentProvider>
        <Footer />
      </CookieConsentProvider>
    )

    const currentYear = new Date().getFullYear().toString()
    expect(screen.getByText(new RegExp(currentYear))).toBeInTheDocument()
    expect(screen.getByText(/Veritasor/i)).toBeInTheDocument()
  })

  it('renders a "Cookie preferences" button', () => {
    render(
      <CookieConsentProvider>
        <Footer />
      </CookieConsentProvider>
    )

    const button = screen.getByRole('button', { name: /cookie preferences/i })
    expect(button).toBeInTheDocument()
  })

  it('calls openSettings when the "Cookie preferences" button is clicked', () => {
    const mockOpenSettings = vi.fn()

    // Create a mock context value that matches CookieConsentContextValue
    const mockContextValue = {
      hasDecided: false,
      consent: { analytics: false, marketing: false, productCommunications: false },
      bannerVisible: false,
      acceptAll: vi.fn(),
      rejectAll: vi.fn(),
      savePreferences: vi.fn(),
      openSettings: mockOpenSettings,
      closeBanner: vi.fn(),
    }

    render(
      <CookieConsentContext.Provider value={mockContextValue}>
        <Footer />
      </CookieConsentContext.Provider>
    )

    const button = screen.getByRole('button', { name: /cookie preferences/i })
    fireEvent.click(button)

    expect(mockOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('throws an error if rendered outside of CookieConsentProvider', () => {
    // Suppress console.error for the expected error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Footer />)).toThrow(
      'useCookieConsent must be used within CookieConsentProvider'
    )

    consoleErrorSpy.mockRestore()
  })
})
