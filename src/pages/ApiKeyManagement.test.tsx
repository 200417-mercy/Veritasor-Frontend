import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiKeyManagement, type ApiKey } from './ApiKeyManagement'

/**
 * Behaviour suite for the API key management page.
 *
 * The issue asks for coverage of the exported `ApiKey` model and the
 * `ApiKeyManagement` page, including representative invalid inputs and the
 * primary state transitions. The two child panels are stubbed so the assertions
 * stay focused on the page's own state machine (modal open, detail selection,
 * create prepend, revoke guard).
 */

const mockCreatedKey: ApiKey = {
  id: 'key_new',
  name: 'Fresh Admin Token',
  prefix: 'vts_live_newadmin...',
  scopes: ['admin'],
  status: 'active',
  createdAt: '2026-01-01',
  lastUsedAt: 'Never',
  recentIps: [],
  callVolume: [],
}

vi.mock('../components/CreateKeyModal', () => ({
  CreateKeyModal: ({ isOpen, onClose, onCreated }: any) =>
    isOpen ? (
      <div role="dialog" aria-label="Create key modal">
        <button type="button" onClick={() => onCreated(mockCreatedKey)}>
          stub-create-key
        </button>
        <button type="button" onClick={onClose}>
          stub-close-create
        </button>
      </div>
    ) : null,
}))

vi.mock('../components/api-keys/ApiKeyDetailPanel', () => ({
  ApiKeyDetailPanel: ({ keyData, onClose }: any) =>
    keyData ? (
      <div role="dialog" aria-label="Key detail panel">
        <span data-testid="detail-key-name">{keyData.name}</span>
        <button type="button" onClick={onClose}>
          stub-close-detail
        </button>
      </div>
    ) : null,
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ApiKeyManagement - rendering', () => {
  it('renders the page heading and description', () => {
    render(<ApiKeyManagement />)

    expect(screen.getByRole('heading', { level: 1, name: 'API Key Management' })).toBeInTheDocument()
    expect(
      screen.getByText('Authenticate external software components with the Veritasor attestation pipeline.'),
    ).toBeInTheDocument()
  })

  it('renders the table columns', () => {
    render(<ApiKeyManagement />)

    for (const column of ['Name', 'Secret Key Token', 'Allowed Scopes', 'Status', 'Actions']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
  })

  it('lists the seeded keys with their prefix, scopes and status', () => {
    render(<ApiKeyManagement />)

    expect(screen.getByText('Production Read-Only Client')).toBeInTheDocument()
    expect(screen.getByText('vts_live_7k2x...')).toBeInTheDocument()
    expect(screen.getByText('CI/CD Automated Attestation Worker')).toBeInTheDocument()
    expect(screen.getByText('vts_live_9p1m...')).toBeInTheDocument()

    expect(screen.getAllByText('active')).toHaveLength(2)
    expect(screen.getAllByText('read')).toHaveLength(2)
    expect(screen.getByText('write')).toBeInTheDocument()
  })

  it('exposes a polite live region for toast announcements', () => {
    render(<ApiKeyManagement />)

    const toast = document.getElementById('sr-toast-container')
    expect(toast).toHaveAttribute('role', 'status')
    expect(toast).toHaveAttribute('aria-live', 'polite')
  })

  it('exports the ApiKey model consumed by the page', () => {
    const sample: ApiKey = { ...mockCreatedKey }
    expect(Object.keys(sample)).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'prefix',
        'scopes',
        'status',
        'createdAt',
        'lastUsedAt',
        'recentIps',
        'callVolume',
      ]),
    )
    expect(typeof ApiKeyManagement).toBe('function')
  })
})

describe('ApiKeyManagement - create key transition', () => {
  it('opens and closes the create-key modal', async () => {
    const user = userEvent.setup()
    render(<ApiKeyManagement />)

    expect(screen.queryByRole('dialog', { name: 'Create key modal' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create New Key' }))
    expect(screen.getByRole('dialog', { name: 'Create key modal' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'stub-close-create' }))
    expect(screen.queryByRole('dialog', { name: 'Create key modal' })).not.toBeInTheDocument()
  })

  it('prepends a newly created key to the table', async () => {
    const user = userEvent.setup()
    render(<ApiKeyManagement />)

    await user.click(screen.getByRole('button', { name: 'Create New Key' }))
    await user.click(screen.getByRole('button', { name: 'stub-create-key' }))

    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(4) // header + 2 seeded + 1 created
    expect(rows[1]).toHaveTextContent('Fresh Admin Token')
  })
})

describe('ApiKeyManagement - detail panel transition', () => {
  it('opens the detail panel for the selected key', async () => {
    const user = userEvent.setup()
    render(<ApiKeyManagement />)

    await user.click(
      screen.getByRole('button', { name: 'View details for Production Read-Only Client' }),
    )

    expect(screen.getByRole('dialog', { name: 'Key detail panel' })).toBeInTheDocument()
    expect(screen.getByTestId('detail-key-name')).toHaveTextContent('Production Read-Only Client')
  })

  it('closes the detail panel without revoking anything', async () => {
    const user = userEvent.setup()
    render(<ApiKeyManagement />)

    await user.click(
      screen.getByRole('button', { name: 'View details for CI/CD Automated Attestation Worker' }),
    )
    await user.click(screen.getByRole('button', { name: 'stub-close-detail' }))

    expect(screen.queryByRole('dialog', { name: 'Key detail panel' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2)
  })
})

describe('ApiKeyManagement - revoke flow', () => {
  it('revokes an active key when the confirmation is accepted', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ApiKeyManagement />)

    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2)

    await user.click(screen.getAllByRole('button', { name: 'Revoke' })[0])

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('revoked')).toHaveLength(1)
    // A revoked key no longer offers the revoke action.
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1)
  })

  it('keeps the key active when the confirmation is dismissed', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ApiKeyManagement />)

    await user.click(screen.getAllByRole('button', { name: 'Revoke' })[0])

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('revoked')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2)
  })

  it('blocks revoking the last remaining administrator token', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ApiKeyManagement />)

    // Create the only admin key so the last-admin guard becomes reachable.
    await user.click(screen.getByRole('button', { name: 'Create New Key' }))
    await user.click(screen.getByRole('button', { name: 'stub-create-key' }))

    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(3)

    await user.click(screen.getAllByRole('button', { name: 'Revoke' })[0])

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('last remaining administrator token'),
    )
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.queryByText('revoked')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(3)
  })
})
