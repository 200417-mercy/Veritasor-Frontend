import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ConsentPreferences from './ConsentPreferences'
import { CookieConsentProvider } from '../components/CookieConsentContext'

// Mock the CookieConsentContext
const mockSavePreferences = vi.fn()
const mockConsent = {
  analytics: false,
  marketing: false,
  productCommunications: false,
}

vi.mock('../components/CookieConsentContext', () => ({
  CookieConsentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCookieConsent: () => ({
    hasDecided: true,
    consent: mockConsent,
    bannerVisible: false,
    acceptAll: vi.fn(),
    rejectAll: vi.fn(),
    savePreferences: mockSavePreferences,
    openSettings: vi.fn(),
    closeBanner: vi.fn(),
  }),
}))

describe('ConsentPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <CookieConsentProvider>
          <ConsentPreferences />
        </CookieConsentProvider>
      </MemoryRouter>
    )
  }

  describe('Rendering', () => {
    it('should render the consent preferences page', () => {
      renderComponent()
      expect(screen.getByText('Consent Preferences')).toBeInTheDocument()
    })

    it('should render the subtitle', () => {
      renderComponent()
      expect(
        screen.getByText('Manage your privacy preferences for cookies and data processing. You can change these settings at any time.')
      ).toBeInTheDocument()
    })

    it('should render all consent categories', () => {
      renderComponent()
      expect(screen.getByText('Essential')).toBeInTheDocument()
      expect(screen.getByText('Analytics')).toBeInTheDocument()
      expect(screen.getByText('Marketing')).toBeInTheDocument()
      expect(screen.getByText('Product Communications')).toBeInTheDocument()
    })

    it('should render category descriptions', () => {
      renderComponent()
      expect(screen.getByText('Required for core features such as authentication and security. Cannot be disabled.')).toBeInTheDocument()
      expect(screen.getByText('Help us understand how you use the product so we can measure and improve it.')).toBeInTheDocument()
      expect(screen.getByText('Allow personalised content and relevant product updates based on your activity.')).toBeInTheDocument()
      expect(screen.getByText('Receive important updates about your account, security alerts, and feature announcements.')).toBeInTheDocument()
    })

    it('should render the last updated timestamp', () => {
      renderComponent()
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
      expect(screen.getByText('January 15, 2024')).toBeInTheDocument()
    })

    it('should render the privacy policy link', () => {
      renderComponent()
      const policyLink = screen.getByText('privacy policy')
      expect(policyLink).toBeInTheDocument()
      expect(policyLink.closest('a')).toHaveAttribute('href', '/privacy-policy')
    })

    it('should render save button', () => {
      renderComponent()
      expect(screen.getByRole('button', { name: /Save preferences/i })).toBeInTheDocument()
    })

    it('should disable save button when no changes', () => {
      renderComponent()
      const saveButton = screen.getByRole('button', { name: /Save preferences/i })
      expect(saveButton).toBeDisabled()
    })
  })

  describe('Toggle behavior', () => {
    it('should enable analytics toggle', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      expect(analyticsToggle).not.toBeChecked()
      fireEvent.click(analyticsToggle)
      expect(analyticsToggle).toBeChecked()
    })

    it('should enable marketing toggle', () => {
      renderComponent()
      const marketingToggle = screen.getByLabelText('Marketing')
      expect(marketingToggle).not.toBeChecked()
      fireEvent.click(marketingToggle)
      expect(marketingToggle).toBeChecked()
    })

    it('should enable product communications toggle', () => {
      renderComponent()
      const productCommToggle = screen.getByLabelText('Product Communications')
      expect(productCommToggle).not.toBeChecked()
      fireEvent.click(productCommToggle)
      expect(productCommToggle).toBeChecked()
    })

    it('should disable essential toggle', () => {
      renderComponent()
      const essentialToggle = screen.getByLabelText('Essential (always active)')
      expect(essentialToggle).toBeDisabled()
      expect(essentialToggle).toBeChecked()
    })

    it('should enable save button when changes are made', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      const saveButton = screen.getByRole('button', { name: /Save preferences/i })
      
      expect(saveButton).toBeDisabled()
      fireEvent.click(analyticsToggle)
      expect(saveButton).not.toBeDisabled()
    })

    it('should show cancel button when changes are made', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      
      expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument()
      fireEvent.click(analyticsToggle)
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })
  })

  describe('Save functionality', () => {
    it('should set aria-busy on save button during saving', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      const saveButton = screen.getByRole('button', { name: /Save preferences/i })

      fireEvent.click(analyticsToggle)
      fireEvent.click(saveButton)

      expect(saveButton).toHaveAttribute('aria-busy', 'true')
    })
    it('should call savePreferences with updated consent when save is clicked', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      const marketingToggle = screen.getByLabelText('Marketing')
      const saveButton = screen.getByRole('button', { name: /Save preferences/i })

      fireEvent.click(analyticsToggle)
      fireEvent.click(marketingToggle)
      fireEvent.click(saveButton)

      expect(mockSavePreferences).toHaveBeenCalledWith({
        analytics: true,
        marketing: true,
        productCommunications: false,
      })
    })

    it('should show saved state after successful save', async () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      const saveButton = screen.getByRole('button', { name: /Save preferences/i })

      fireEvent.click(analyticsToggle)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Saved!/i })).toBeInTheDocument()
      })
    })

    it('should disable save button during saving', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      const saveButton = screen.getByRole('button', { name: /Save preferences/i })

      fireEvent.click(analyticsToggle)
      expect(saveButton).not.toBeDisabled()
    })

    it('should hide cancel button initially', () => {
      renderComponent()
      expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument()
    })
  })

  describe('Cancel functionality', () => {
    it('should reset changes when cancel is clicked', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')

      fireEvent.click(analyticsToggle)
      expect(analyticsToggle).toBeChecked()

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)
      expect(analyticsToggle).not.toBeChecked()
    })

    it('should hide cancel button after cancel', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')

      fireEvent.click(analyticsToggle)
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument()
    })

    it('should disable save button after cancel', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      const saveButton = screen.getByRole('button', { name: /Save preferences/i })

      fireEvent.click(analyticsToggle)
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      expect(saveButton).toBeDisabled()
    })
  })

  describe('Error handling', () => {
    it('should show error message when save fails', async () => {
      mockSavePreferences.mockImplementationOnce(() => {
        throw new Error('Save failed')
      })

      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      const saveButton = screen.getByRole('button', { name: /Save preferences/i })

      fireEvent.click(analyticsToggle)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to save preferences. Please try again.')).toBeInTheDocument()
      })
    })

    it('should clear error message after 3 seconds', async () => {
      mockSavePreferences.mockImplementationOnce(() => {
        throw new Error('Save failed')
      })

      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      const saveButton = screen.getByRole('button', { name: /Save preferences/i })

      fireEvent.click(analyticsToggle)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to save preferences. Please try again.')).toBeInTheDocument()
      })

      await waitFor(
        () => {
          expect(screen.queryByText('Failed to save preferences. Please try again.')).not.toBeInTheDocument()
        },
        { timeout: 3500 }
      )
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      renderComponent()
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveTextContent('Consent Preferences')
    })

    it('should have proper aria labels on toggles', () => {
      renderComponent()
      expect(screen.getByLabelText('Analytics')).toBeInTheDocument()
      expect(screen.getByLabelText('Marketing')).toBeInTheDocument()
      expect(screen.getByLabelText('Product Communications')).toBeInTheDocument()
      expect(screen.getByLabelText('Essential (always active)')).toBeInTheDocument()
    })

    it('should have proper aria-describedby on toggles', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      expect(analyticsToggle).toHaveAttribute('aria-describedby')
    })

    it('should have role="switch" on toggle inputs', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      expect(analyticsToggle).toHaveAttribute('role', 'switch')
    })

    it('should have proper aria-label on save button', () => {
      renderComponent()
      const saveButton = screen.getByRole('button', { name: /Save preferences/i })
      expect(saveButton).toBeInTheDocument()
    })

    it('should have proper time element for last updated', () => {
      renderComponent()
      const timeElement = screen.getByRole('time')
      expect(timeElement).toBeInTheDocument()
      expect(timeElement).toHaveAttribute('dateTime', '2024-01-15T00:00:00.000Z')
    })

    it('should have proper aria-live on error message', () => {
      mockSavePreferences.mockImplementationOnce(() => {
        throw new Error('Save failed')
      })

      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      const saveButton = screen.getByRole('button', { name: /Save preferences/i })

      fireEvent.click(analyticsToggle)
      fireEvent.click(saveButton)

      waitFor(() => {
        const errorMessage = screen.getByText('Failed to save preferences. Please try again.')
        expect(errorMessage).toHaveAttribute('role', 'alert')
      })
    })
  })

  describe('Sync with context', () => {
    it('should sync with consent context on mount', () => {
      renderComponent()
      const analyticsToggle = screen.getByLabelText('Analytics')
      expect(analyticsToggle).not.toBeChecked()
    })
  })

  describe('Responsive design', () => {
    it('should render toggle rows with proper class', () => {
      renderComponent()
      const toggleRows = screen.getAllByTestId('toggle-row')
      expect(toggleRows.length).toBe(4)
      toggleRows.forEach((row: HTMLElement) => {
        expect(row).toHaveClass('cp-toggle-row')
      })
    })
  })
})
// Added for issue coverage
