import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import ContextualHelpSearch, { HELP_ARTICLES, type HelpArticle } from './ContextualHelpSearch'

// Mocking useLocation if necessary, but MemoryRouter initialEntries might be enough
describe('ContextualHelpSearch Data', () => {
  it('exports HELP_ARTICLES array with items', () => {
    expect(HELP_ARTICLES).toBeInstanceOf(Array)
    expect(HELP_ARTICLES.length).toBeGreaterThan(0)
  })

  it('contains correctly typed HelpArticle items', () => {
    const article = HELP_ARTICLES[0]
    expect(article).toHaveProperty('id')
    expect(article).toHaveProperty('title')
    expect(article).toHaveProperty('description')
    expect(article).toHaveProperty('keywords')
    expect(article).toHaveProperty('href')
    expect(article).toHaveProperty('categories')
  })
})

describe('ContextualHelpSearch Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  const renderComponent = (props = { open: true, onClose: vi.fn() }, initialEntries = ['/dashboard']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <ContextualHelpSearch {...props} />
      </MemoryRouter>
    )
  }

  it('renders nothing when not open', () => {
    const { container } = renderComponent({ open: false, onClose: vi.fn() })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the dialog when open', () => {
    renderComponent()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Help & Support')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    renderComponent({ open: true, onClose })
    fireEvent.click(screen.getByLabelText('Close help search'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when clicking the overlay', () => {
    const onClose = vi.fn()
    renderComponent({ open: true, onClose })
    const overlay = document.querySelector('.hs-overlay')
    expect(overlay).not.toBeNull()
    if (overlay) {
      fireEvent.click(overlay)
    }
    expect(onClose).toHaveBeenCalled()
  })

  it('filters articles based on search query', () => {
    renderComponent()
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Stripe' } })
    
    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Connecting Revenue Sources should be visible
    expect(screen.getByText('Connecting Revenue Sources')).toBeInTheDocument()
  })

  it('shows empty state for representative invalid inputs', () => {
    renderComponent()
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'xyznonexistent123' } })
    
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByText(/No articles match/)).toBeInTheDocument()
    expect(screen.getByText(/xyznonexistent123/)).toBeInTheDocument()
  })

  it('handles contextual suggestions based on current path', () => {
    renderComponent({ open: true, onClose: vi.fn() }, ['/api-keys'])
    // Based on PAGE_CONTEXT_SUGGESTIONS for /api-keys: ['api-keys', 'security', 'webhooks']
    expect(screen.getByText('Managing API Keys')).toBeInTheDocument()
    expect(screen.getByText('Security Best Practices')).toBeInTheDocument()
    expect(screen.getByText('Configuring Webhooks')).toBeInTheDocument()
  })

  it('saves recently clicked articles to localStorage and shows them', () => {
    const onClose = vi.fn()
    renderComponent({ open: true, onClose })
    
    // Click an article to add to recents
    const firstArticle = screen.getByText('Getting Started with Veritasor')
    fireEvent.click(firstArticle)
    
    // Close should have been called
    expect(onClose).toHaveBeenCalled()

    // Re-render to see if it shows up in Recents
    renderComponent()
    expect(screen.getByText('Recent searches')).toBeInTheDocument()
    expect(screen.getByText('Getting Started with Veritasor')).toBeInTheDocument()
    // It should have the Recent badge
    expect(screen.getByLabelText('Recently viewed')).toBeInTheDocument()
  })

  it('clears search input when clear button is clicked', () => {
    renderComponent()
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Stripe' } })
    expect(input).toHaveValue('Stripe')
    
    const clearButton = screen.getByLabelText('Clear search')
    fireEvent.click(clearButton)
    expect(input).toHaveValue('')
  })
  
  it('supports keyboard navigation (Arrow keys)', () => {
    renderComponent()
    const input = screen.getByRole('combobox')
    
    // First article should be active by default? Actually, activeIndex = 0
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // We expect the activeIndex to change. The active item has aria-selected=true
    const options = screen.getAllByRole('option')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    
    fireEvent.keyDown(input, { key: 'End' })
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true')
    
    fireEvent.keyDown(input, { key: 'Home' })
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('supports keyboard navigation (Enter key)', () => {
    const onClose = vi.fn()
    renderComponent({ open: true, onClose })
    const input = screen.getByRole('combobox')
    
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onClose).toHaveBeenCalled()
  })
  
  it('closes dialog on Escape key', () => {
    const onClose = vi.fn()
    renderComponent({ open: true, onClose })
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
