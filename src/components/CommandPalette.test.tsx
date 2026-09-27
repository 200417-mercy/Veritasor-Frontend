import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useNavigate, useLocation } from 'react-router-dom'
import CommandPalette, { COMMANDS } from './CommandPalette'
import { useToast } from './ToastContext'

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
  }
})

vi.mock('./ToastContext', async () => {
  const actual = await vi.importActual('./ToastContext')
  return {
    ...actual,
    useToast: vi.fn(),
  }
})

describe('CommandPalette', () => {
  const mockOnClose = vi.fn()
  const mockOnWorkspaceJump = vi.fn()
  const mockNavigate = vi.fn()
  const mockAddToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup router mocks
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    vi.mocked(useLocation).mockReturnValue({ 
      pathname: '/', 
      search: '', 
      hash: '', 
      state: null, 
      key: 'default' 
    } as unknown as ReturnType<typeof useLocation>)
    
    // Setup toast mock
    vi.mocked(useToast).mockReturnValue({
      addToast: mockAddToast,
      toasts: [],
      removeToast: vi.fn(),
      dismissTopToast: vi.fn(),
      dismissAllToasts: vi.fn(),
    })
    
    // Clear storage
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CommandPalette isOpen={false} onClose={mockOnClose} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders correctly when isOpen is true', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Search dashboard navigation/i)).toBeInTheDocument()
  })

  it('displays the correct number of commands initially in global scope', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} />)
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(COMMANDS.length)
  })

  it('filters commands based on search query', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} />)
    const input = screen.getByRole('combobox')
    
    fireEvent.change(input, { target: { value: 'Dashboard' } })
    
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
    expect(options[0]).toHaveTextContent('Go to Dashboard')
  })

  it('shows empty state when no commands match', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} />)
    const input = screen.getByRole('combobox')
    
    fireEvent.change(input, { target: { value: 'invalid_xyz123' } })
    
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText(/No results found/i)).toBeInTheDocument()
  })

  it('handles keyboard navigation correctly', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} />)
    const input = screen.getByRole('combobox')
    
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
    
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('triggers selection and closes on Enter', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} onWorkspaceJump={mockOnWorkspaceJump} />)
    const input = screen.getByRole('combobox')
    
    fireEvent.change(input, { target: { value: 'Dashboard' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    
    expect(mockNavigate).toHaveBeenCalledWith('/')
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('handles custom commands like workspace jump', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} onWorkspaceJump={mockOnWorkspaceJump} />)
    const input = screen.getByRole('combobox')
    
    fireEvent.change(input, { target: { value: 'Workspace' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    
    expect(mockOnWorkspaceJump).toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('toggles theme correctly', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    render(<CommandPalette isOpen={true} onClose={mockOnClose} />)
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Toggle Theme' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(mockAddToast).toHaveBeenCalledWith('Theme switched to dark mode', 'success')
  })

  it('can toggle page scope filtering', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} />)
    
    const pageScopeButton = screen.getByRole('radio', { name: /This page/i })
    fireEvent.click(pageScopeButton)
    
    const options = screen.getAllByRole('option')
    const pageCommands = COMMANDS.filter(cmd => !cmd.pageRoutes || cmd.pageRoutes.includes('/'))
    expect(options.length).toBe(pageCommands.length)
  })

  it('closes on Escape key', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} />)
    const input = screen.getByRole('combobox')
    
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('closes when overlay is clicked', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} />)
    const overlay = document.querySelector('.cmd-overlay')!
    
    fireEvent.click(overlay)
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('prevents event propagation for inner dialog clicks', () => {
    render(<CommandPalette isOpen={true} onClose={mockOnClose} />)
    const dialog = screen.getByRole('dialog')
    
    fireEvent.click(dialog)
    // clicking the dialog itself should not close
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('exposes the public contract for COMMANDS', () => {
    expect(COMMANDS).toBeInstanceOf(Array)
    expect(COMMANDS.length).toBeGreaterThan(0)
    expect(COMMANDS[0]).toHaveProperty('id')
    expect(COMMANDS[0]).toHaveProperty('title')
    expect(COMMANDS[0]).toHaveProperty('category')
  })
})
