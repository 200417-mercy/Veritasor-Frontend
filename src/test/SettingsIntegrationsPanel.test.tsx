import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SettingsIntegrationsPanel from '../pages/SettingsIntegrationsPanel'

// Mock react-router-dom to spy on navigation calls
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the raw data to inject one valid integration and one strictly invalid one
vi.mock('../components/integrations/integrations-data', () => ({
  AVAILABLE_INTEGRATIONS: [
    { id: 'stripe-prod', name: 'Stripe', status: 'connected', statusText: 'Connected' },
    { id: '', name: 'Broken', status: 'connected', statusText: 'Connected' },
  ],
}))

// Mock the card component to isolate the onConfigure event test
vi.mock('../components/integrations/IntegrationCard', () => ({
  default: ({ integration, onConfigure }: any) => (
    <div data-testid={`integration-card-${integration.id || 'missing'}`}>
      <button onClick={onConfigure}>Configure {integration.name}</button>
    </div>
  ),
}))

describe('SettingsIntegrationsPanel (Issue #667)', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('navigates to the correct configuration route when given a valid integration ID', () => {
    render(
      <MemoryRouter>
        <SettingsIntegrationsPanel />
      </MemoryRouter>
    )

    const configureBtn = screen.getByText('Configure Stripe')
    fireEvent.click(configureBtn)

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith('/settings/integrations/stripe-prod')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rejects navigation and surfaces an observable error when integration ID is missing', () => {
    render(
      <MemoryRouter>
        <SettingsIntegrationsPanel />
      </MemoryRouter>
    )

    const invalidBtn = screen.getByText('Configure Broken')
    fireEvent.click(invalidBtn)

    // Ensure the application did not route
    expect(mockNavigate).not.toHaveBeenCalled()

    // The failure contract explicitly sets an observable error state in the UI
    expect(screen.getByRole('alert')).toHaveTextContent('Integration configuration requires a valid integration ID.')
  })
})