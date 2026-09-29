import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import IntegrationCard from './IntegrationCard'
import type { Integration } from './IntegrationCard'

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'test-integration',
    name: 'Test Integration',
    description: 'A test integration description',
    icon: '🔬',
    status: 'available',
    statusText: 'Available',
    ...overrides,
  }
}

function renderCard(integration: Integration, actions?: {
  onConfigure?: (id: string) => void
  onConnect?: (id: string) => void
  onDisconnect?: (id: string) => void
}) {
  return render(
    <IntegrationCard
      integration={integration}
      onConfigure={actions?.onConfigure}
      onConnect={actions?.onConnect}
      onDisconnect={actions?.onDisconnect}
    />,
  )
}

describe('IntegrationCard', () => {
  it('renders the integration name', () => {
    renderCard(makeIntegration())
    expect(screen.getByText('Test Integration')).toBeInTheDocument()
  })

  it('renders the integration description', () => {
    renderCard(makeIntegration())
    expect(screen.getByText('A test integration description')).toBeInTheDocument()
  })

  it('renders as an article with aria-label', () => {
    renderCard(makeIntegration())
    const article = screen.getByRole('article')
    expect(article).toHaveAttribute('aria-label', 'Test Integration integration')
  })

  it('shows Connect button when status is available', () => {
    renderCard(makeIntegration({ status: 'available', statusText: 'Available' }))
    expect(screen.getByRole('button', { name: /connect test integration/i })).toBeInTheDocument()
  })

  it('shows Configure and Disconnect buttons when status is connected', () => {
    renderCard(makeIntegration({ status: 'connected', statusText: 'Connected' }))
    expect(screen.getByRole('button', { name: /configure test integration/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /disconnect test integration/i })).toBeInTheDocument()
  })

  it('shows status chip with correct text', () => {
    renderCard(makeIntegration({ status: 'connected', statusText: 'Connected' }))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Connected')
  })

  it('calls onConnect when Connect button is clicked', () => {
    const onConnect = vi.fn()
    renderCard(makeIntegration({ status: 'available' }), { onConnect })
    fireEvent.click(screen.getByRole('button', { name: /connect/i }))
    expect(onConnect).toHaveBeenCalledWith('test-integration')
  })

  it('calls onConfigure when Configure button is clicked', () => {
    const onConfigure = vi.fn()
    renderCard(makeIntegration({ status: 'connected' }), { onConfigure })
    fireEvent.click(screen.getByRole('button', { name: /configure/i }))
    expect(onConfigure).toHaveBeenCalledWith('test-integration')
  })

  it('calls onDisconnect when Disconnect button is clicked', () => {
    const onDisconnect = vi.fn()
    renderCard(makeIntegration({ status: 'connected' }), { onDisconnect })
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))
    expect(onDisconnect).toHaveBeenCalledWith('test-integration')
  })

  it('shows error status chip', () => {
    renderCard(makeIntegration({ status: 'error', statusText: 'Reconnect needed' }))
    expect(screen.getByRole('status')).toHaveTextContent('Reconnect needed')
  })

  it('shows Connect button for error status (not connected)', () => {
    renderCard(makeIntegration({ status: 'error', statusText: 'Reconnect needed' }))
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
  })
})

describe('IntegrationCard — action wiring', () => {
  it('does not throw when optional action callbacks are omitted', () => {
    renderCard(makeIntegration({ status: 'connected' }), {})
    expect(() => fireEvent.click(screen.getByRole('button', { name: /configure/i }))).not.toThrow()
    expect(() => fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))).not.toThrow()
  })

  it('does not throw when onConnect is omitted for an unconnected integration', () => {
    renderCard(makeIntegration({ status: 'available' }))
    expect(() => fireEvent.click(screen.getByRole('button', { name: /connect/i }))).not.toThrow()
  })

  it('invokes only the matching handler for each status', () => {
    const onConfigure = vi.fn()
    const onConnect = vi.fn()
    const onDisconnect = vi.fn()

    renderCard(makeIntegration({ status: 'connected' }), { onConfigure, onConnect, onDisconnect })
    fireEvent.click(screen.getByRole('button', { name: /configure/i }))
    expect(onConfigure).toHaveBeenCalledWith('test-integration')
    expect(onConnect).not.toHaveBeenCalled()
    expect(onDisconnect).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))
    expect(onDisconnect).toHaveBeenCalledWith('test-integration')
    expect(onConnect).not.toHaveBeenCalled()
    expect(onConfigure).toHaveBeenCalledTimes(1)
  })

  it('rebinds handlers to the current id after a re-render', () => {
    const onConnect = vi.fn()
    const { rerender } = render(
      <IntegrationCard
        integration={makeIntegration({ id: 'first', status: 'available', name: 'First' })}
        onConnect={onConnect}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /connect first/i }))
    expect(onConnect).toHaveBeenLastCalledWith('first')

    rerender(
      <IntegrationCard
        integration={makeIntegration({ id: 'second', status: 'available', name: 'Second' })}
        onConnect={onConnect}
      />,
    )
    expect(screen.queryByRole('button', { name: /connect first/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /connect second/i }))
    expect(onConnect).toHaveBeenLastCalledWith('second')
    expect(onConnect).toHaveBeenCalledTimes(2)
  })

  it('dispatches per-card ids when several cards are rendered together', () => {
    const onConnect = vi.fn()
    render(
      <>
        <IntegrationCard integration={makeIntegration({ id: 'a', name: 'Alpha' })} onConnect={onConnect} />
        <IntegrationCard integration={makeIntegration({ id: 'b', name: 'Beta' })} onConnect={onConnect} />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: /connect beta/i }))
    expect(onConnect).toHaveBeenCalledOnce()
    expect(onConnect).toHaveBeenCalledWith('b')
  })

  it('does not render Configure/Disconnect for the error status', () => {
    renderCard(makeIntegration({ status: 'error', statusText: 'Reconnect needed' }))
    expect(screen.queryByRole('button', { name: /configure/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument()
  })
})

describe('IntegrationCard — presentation contract', () => {
  it('exposes the status text through the chip aria-label', () => {
    renderCard(makeIntegration({ status: 'connected', statusText: 'Connected' }))
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Status: Connected')
  })

  it('renders statusText verbatim even when it diverges from status', () => {
    renderCard(makeIntegration({ status: 'connected', statusText: 'Syncing changes' }))
    expect(screen.getByRole('status')).toHaveTextContent('Syncing changes')
    // status === 'connected' still drives the action set.
    expect(screen.getByRole('button', { name: /configure test integration/i })).toBeInTheDocument()
  })

  it('renders the icon as decorative content', () => {
    renderCard(makeIntegration({ icon: '🔬' }))
    const icon = screen.getByText('🔬')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('article')).toHaveAccessibleName('Test Integration integration')
  })

  it('renders without crashing when the payload carries an unknown status', () => {
    const unknown = 'paused' as Integration['status']
    renderCard(makeIntegration({ status: unknown, statusText: 'Paused by admin' }))
    expect(screen.getByRole('status')).toHaveTextContent('Paused by admin')
    // Unknown statuses are not "connected": only the non-destructive CTA shows.
    expect(screen.getByRole('button', { name: /connect test integration/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument()
  })

  it('renders an empty label and description without throwing', () => {
    renderCard(makeIntegration({ id: '', name: '', description: '' }))
    expect(screen.getByRole('article')).toHaveAttribute('aria-label', ' integration')
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeInTheDocument()
  })
})
