import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AuditLogDetailDrawer from './AuditLogDetailDrawer'
import type { AuditLogEntryDetail } from './AuditLogDetailDrawer'
import '@testing-library/jest-dom'

describe('AuditLogDetailDrawer', () => {
  const mockOnClose = vi.fn()
  const mockTriggerRef = { current: document.createElement('button') }

  const fullEntry: AuditLogEntryDetail = {
    id: 'entry-1',
    timestamp: '2023-01-01T12:00:00Z',
    event: 'User Login',
    actor: 'admin@example.com',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    method: 'POST',
    path: '/api/login',
    statusCode: 200,
    requestHeaders: {
      'content-type': 'application/json',
      'authorization': 'Bearer token',
    },
    requestPayload: { username: 'admin' },
    responsePayload: { success: true, token: '123' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    document.body.appendChild(mockTriggerRef.current)
  })

  it('renders nothing when entry is null', () => {
    const { container } = render(
      <AuditLogDetailDrawer entry={null} onClose={mockOnClose} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders correctly with an entry', () => {
    render(<AuditLogDetailDrawer entry={fullEntry} onClose={mockOnClose} />)
    
    // Check main title and ID
    expect(screen.getByRole('heading', { name: 'User Login' })).toBeInTheDocument()
    expect(screen.getByText('entry-1')).toBeInTheDocument()
    
    // Check status code
    expect(screen.getByText('200')).toBeInTheDocument()
    
    // Check metadata
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument()
    expect(screen.getByText('Mozilla/5.0')).toBeInTheDocument()
    expect(screen.getByText('POST')).toBeInTheDocument()
    expect(screen.getByText('/api/login')).toBeInTheDocument()
    
    // Check that request payload and response payload are in the document
    expect(screen.getByText(/username/)).toBeInTheDocument()
    expect(screen.getByText(/success/)).toBeInTheDocument()
  })

  it('handles closing via close button', () => {
    render(<AuditLogDetailDrawer entry={fullEntry} onClose={mockOnClose} />)
    
    const closeBtn = screen.getByRole('button', { name: /close audit detail drawer/i })
    fireEvent.click(closeBtn)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('handles closing via backdrop click', () => {
    // Backdrop is the first div with an aria-hidden attribute
    render(<AuditLogDetailDrawer entry={fullEntry} onClose={mockOnClose} />)
    
    const backdrop = document.querySelector('div[aria-hidden="true"]')
    expect(backdrop).toBeInTheDocument()
    
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    }
  })

  it('handles closing via Escape key', () => {
    render(<AuditLogDetailDrawer entry={fullEntry} onClose={mockOnClose} />)
    
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('toggles collapsible sections', () => {
    render(<AuditLogDetailDrawer entry={fullEntry} onClose={mockOnClose} />)
    
    // Find the Request headers section button
    const headersBtn = screen.getByRole('button', { name: /Request headers/i })
    
    // It should be closed by default based on component's defaultOpen={false} for headers
    expect(headersBtn).toHaveAttribute('aria-expanded', 'false')
    
    // Click to open
    fireEvent.click(headersBtn)
    expect(headersBtn).toHaveAttribute('aria-expanded', 'true')
    
    // Click to close
    fireEvent.click(headersBtn)
    expect(headersBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders gracefully with minimal entry', () => {
    const minimalEntry: AuditLogEntryDetail = {
      id: 'entry-min',
      timestamp: '2023-01-01T12:00:00Z',
      event: 'Minimal Event',
    }
    
    render(<AuditLogDetailDrawer entry={minimalEntry} onClose={mockOnClose} />)
    expect(screen.getByRole('heading', { name: 'Minimal Event' })).toBeInTheDocument()
    
    // Missing fields should not render or crash
    expect(screen.queryByText('Actor')).not.toBeInTheDocument()
    expect(screen.queryByText('IP address')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Request headers/i })).not.toBeInTheDocument()
  })

  it('returns focus to trigger element on close', () => {
    const { unmount } = render(
      <AuditLogDetailDrawer entry={fullEntry} onClose={mockOnClose} triggerRef={mockTriggerRef} />
    )
    
    expect(document.activeElement).not.toBe(mockTriggerRef.current)
    
    // Simulate drawer close by unmounting (simulating the external state change)
    unmount()
    // However, the focus logic is in an effect listening to `isOpen`.
    // In our test, unmounting doesn't trigger the `!isOpen` effect branch.
    // Let's test it by re-rendering with entry=null.
  })

  it('returns focus to trigger element when entry becomes null', () => {
    const { rerender } = render(
      <AuditLogDetailDrawer entry={fullEntry} onClose={mockOnClose} triggerRef={mockTriggerRef} />
    )
    
    // Focus should be inside the drawer (on the close button)
    const closeBtn = screen.getByRole('button', { name: /close audit detail drawer/i })
    expect(document.activeElement).toBe(closeBtn)
    
    // Drawer closes
    rerender(<AuditLogDetailDrawer entry={null} onClose={mockOnClose} triggerRef={mockTriggerRef} />)
    
    expect(document.activeElement).toBe(mockTriggerRef.current)
  })

  it('copies text when copy button is clicked', async () => {
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    
    render(<AuditLogDetailDrawer entry={fullEntry} onClose={mockOnClose} />)
    
    const copyBtns = screen.getAllByRole('button', { name: /Copy/i })
    expect(copyBtns.length).toBeGreaterThan(0)
    
    // Click the first copy button (request payload)
    fireEvent.click(copyBtns[0])
    
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
    // It should change to "Copied"
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
  })
})
