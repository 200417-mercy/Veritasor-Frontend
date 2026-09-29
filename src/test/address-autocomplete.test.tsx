import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AddressAutocomplete from '../components/AddressAutocomplete'

describe('AddressAutocomplete handleKeyDown regression', () => {
  it('does not intercept keyboard events when closed (regression for line 178)', () => {
    const onChange = vi.fn()
    render(<AddressAutocomplete onChange={onChange} placeholder="Test Address" />)

    const input = screen.getByPlaceholderText('Test Address')
    
    // Attempt to press ArrowDown
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    const wasPrevented = !input.dispatchEvent(event)
    
    // When closed, it should return immediately and not call e.preventDefault()
    expect(wasPrevented).toBe(false)
  })

  it('intercepts keyboard events and allows selection when open (adjacent success behavior)', async () => {
    const onChange = vi.fn()
    const mockSuggestions = [
      { id: '1', label: '10 Downing St', fullAddress: '10 Downing St, London SW1A 2AA, UK' },
      { id: '2', label: '1600 Pennsylvania', fullAddress: '1600 Pennsylvania Ave NW, Washington, DC' }
    ]
    const fetchSuggestions = vi.fn().mockResolvedValue(mockSuggestions)
    
    render(<AddressAutocomplete onChange={onChange} fetchSuggestions={fetchSuggestions} placeholder="Test Address" />)
    const input = screen.getByPlaceholderText('Test Address')

    // Type to open the suggestions
    fireEvent.change(input, { target: { value: '10' } })

    // Wait for the listbox to appear indicating it's open
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    // Now it is open. Press ArrowDown
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    const wasPrevented = !input.dispatchEvent(event)
    
    // When open, it prevents default on ArrowDown
    expect(wasPrevented).toBe(true)

    // Press Enter to select the first suggestion
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith({
      fullAddress: '10 Downing St, London SW1A 2AA, UK',
      isManual: false,
      lat: undefined,
      lng: undefined
    })
  })
})
