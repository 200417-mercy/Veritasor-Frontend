/**
 * Dedicated test suite for ApiKeyDetailPanel (#614)
 *
 * Primary focus: regression coverage for the early-return branch at line ~255:
 *   if (!isOpen || !keyData) return null;
 *
 * Covers:
 *  Failure / null paths (the branch under test):
 *    - Renders null when keyData is null (panel closed)
 *    - Renders null when keyData is explicitly undefined-like (null)
 *
 *  Normal / happy path:
 *    - Renders the drawer dialog when keyData is provided
 *    - Displays the key name in the header
 *    - Displays the key prefix
 *    - Displays the status badge
 *    - Displays allowed scopes
 *    - Displays the key ID in the metadata section
 *    - Displays recent IPs
 *    - Renders a close button with an accessible label
 *    - Close button calls onClose when clicked
 *
 *  Keyboard / interaction:
 *    - Pressing Escape calls onClose
 *    - Backdrop click calls onClose
 *
 *  Accessibility:
 *    - Drawer has role="dialog" with aria-modal="true"
 *    - Dialog is labelled by the key name heading (aria-labelledby)
 *    - Sparkline wrapper has role="img" with an aria-label
 */

import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiKeyDetailPanel } from './ApiKeyDetailPanel'
import type { ApiKey } from '../../pages/ApiKeyManagement'

// ─── fixtures ────────────────────────────────────────────────────────────────

const CALL_VOLUME = Array.from({ length: 14 }, (_, i) => ({
  date: `2026-06-${String(i + 1).padStart(2, '0')}`,
  count: 100 + i * 10,
}))

const sampleKey: ApiKey = {
  id: 'key_abc123',
  name: 'Test Production Key',
  prefix: 'vts_live_abc1...',
  scopes: ['read', 'write'],
  status: 'active',
  createdAt: '2026-05-01',
  lastUsedAt: '2026-06-20',
  recentIps: ['192.0.2.1', '198.51.100.5'],
  callVolume: CALL_VOLUME,
}

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return { ...sampleKey, ...overrides }
}

// ─── Failure / null path ─────────────────────────────────────────────────────
// This is the primary regression target: `if (!isOpen || !keyData) return null`

describe('ApiKeyDetailPanel – null / closed state (failure path)', () => {
  it('renders nothing when keyData is null (panel is closed)', () => {
    const { container } = render(
      <ApiKeyDetailPanel keyData={null} onClose={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null – no dialog role present when keyData is null', () => {
    render(<ApiKeyDetailPanel keyData={null} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('returns null – no heading present when keyData is null', () => {
    render(<ApiKeyDetailPanel keyData={null} onClose={() => {}} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('does not call onClose on mount when keyData is null', () => {
    const onClose = vi.fn()
    render(<ApiKeyDetailPanel keyData={null} onClose={onClose} />)
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ─── Normal / happy path ─────────────────────────────────────────────────────

describe('ApiKeyDetailPanel – open / rendered state (happy path)', () => {
  it('renders the drawer dialog when keyData is provided', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('displays the key name in the header', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByText('Test Production Key')).toBeInTheDocument()
  })

  it('displays the key prefix below the name', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByText('vts_live_abc1...')).toBeInTheDocument()
  })

  it('displays the status badge with correct text', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    // "Active" is rendered by charAt(0).toUpperCase() + slice(1)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
  })

  it('displays all allowed scopes as badges', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByText('read')).toBeInTheDocument()
    expect(screen.getByText('write')).toBeInTheDocument()
  })

  it('displays the key ID in the metadata section', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByText('key_abc123')).toBeInTheDocument()
  })

  it('displays each recent IP address', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByText('192.0.2.1')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.5')).toBeInTheDocument()
  })

  it('renders a close button with accessible label', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(
      screen.getByRole('button', { name: /close api key detail panel/i }),
    ).toBeInTheDocument()
  })

  it('renders the "Allowed Scopes" section heading', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByText(/allowed scopes/i)).toBeInTheDocument()
  })

  it('renders the "Usage Details" section heading', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByText(/usage details/i)).toBeInTheDocument()
  })

  it('renders the "Recent Calling IPs" section heading', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByText(/recent calling ips/i)).toBeInTheDocument()
  })

  it('renders the "Call Volume" section heading', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByText(/call volume/i)).toBeInTheDocument()
  })
})

// ─── Boundary inputs ─────────────────────────────────────────────────────────

describe('ApiKeyDetailPanel – boundary inputs', () => {
  it('renders a revoked key with correct status badge', () => {
    render(
      <ApiKeyDetailPanel
        keyData={makeKey({ status: 'revoked' })}
        onClose={() => {}}
      />,
    )
    expect(screen.getAllByText('Revoked').length).toBeGreaterThan(0)
  })

  it('renders with empty scopes array without crashing', () => {
    render(
      <ApiKeyDetailPanel
        keyData={makeKey({ scopes: [] })}
        onClose={() => {}}
      />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders with empty recentIps array without crashing', () => {
    render(
      <ApiKeyDetailPanel
        keyData={makeKey({ recentIps: [] })}
        onClose={() => {}}
      />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders with empty callVolume array without crashing', () => {
    render(
      <ApiKeyDetailPanel
        keyData={makeKey({ callVolume: [] })}
        onClose={() => {}}
      />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders with a single scope without crashing', () => {
    render(
      <ApiKeyDetailPanel
        keyData={makeKey({ scopes: ['admin'] })}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('handles lastUsedAt = "Never" without crashing', () => {
    render(
      <ApiKeyDetailPanel
        keyData={makeKey({ lastUsedAt: 'Never' })}
        onClose={() => {}}
      />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// ─── Keyboard / interaction ──────────────────────────────────────────────────

describe('ApiKeyDetailPanel – interactions', () => {
  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close api key detail panel/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={onClose} />)
    // The backdrop is aria-hidden and contains onClick={onClose}
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={onClose} />)
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT call onClose when Escape is pressed while panel is closed (null)', () => {
    const onClose = vi.fn()
    render(<ApiKeyDetailPanel keyData={null} onClose={onClose} />)
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ─── Accessibility ───────────────────────────────────────────────────────────

describe('ApiKeyDetailPanel – accessibility', () => {
  it('drawer has role="dialog"', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('drawer has aria-modal="true"', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('drawer is labelled by the key name heading via aria-labelledby', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const labelEl = document.getElementById(labelId!)
    expect(labelEl).toBeInTheDocument()
    expect(labelEl!.textContent).toBe('Test Production Key')
  })

  it('sparkline has role="img" with an aria-label', () => {
    render(<ApiKeyDetailPanel keyData={sampleKey} onClose={() => {}} />)
    const sparkline = document.querySelector('[role="img"]')
    expect(sparkline).toBeInTheDocument()
    expect(sparkline).toHaveAttribute('aria-label')
  })
})
