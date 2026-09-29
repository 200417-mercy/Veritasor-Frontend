import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import LocalePicker from './LocalePicker'
import { LocaleContext } from '../../i18n/provider'
import messages from '../../i18n/messages/en.json'
import { IntlProvider } from 'react-intl'

function renderWithIntlProvider(ui: React.ReactElement, providerProps: { locale: string, setLocale: (val: string) => void, dir: string }) {
  return render(
    <LocaleContext.Provider value={providerProps}>
      <IntlProvider locale="en" messages={messages}>
        {ui}
      </IntlProvider>
    </LocaleContext.Provider>
  )
}

describe('LocalePicker', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the current locale on the trigger button', () => {
    const setLocale = vi.fn()
    renderWithIntlProvider(<LocalePicker />, { locale: 'en', setLocale, dir: 'ltr' })
    const trigger = screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] })
    expect(trigger).toHaveTextContent('English')
  })

  it('opens and closes the listbox correctly on click', () => {
    const setLocale = vi.fn()
    renderWithIntlProvider(<LocalePicker />, { locale: 'en', setLocale, dir: 'ltr' })
    const trigger = screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] })
    
    // Initial state: closed
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    
    // Open
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    
    // Close
    fireEvent.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('filters locales by search string deterministically (debounced)', async () => {
    const setLocale = vi.fn()
    renderWithIntlProvider(<LocalePicker />, { locale: 'en', setLocale, dir: 'ltr' })
    
    fireEvent.click(screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] }))
    
    const input = screen.getByPlaceholderText(messages['settings.locale.search.placeholder'])
    
    act(() => {
      fireEvent.change(input, { target: { value: 'espa' } })
    })
    
    // Before debounce, it should still show all options (debouncedSearch isn't updated yet)
    // Actually, in standard RTL, we might need to advance timers
    act(() => {
      vi.advanceTimersByTime(250)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Español')).toBeInTheDocument()
      expect(screen.queryByText('Français')).not.toBeInTheDocument()
    })
  })

  it('shows empty state for invalid search inputs', async () => {
    const setLocale = vi.fn()
    renderWithIntlProvider(<LocalePicker />, { locale: 'en', setLocale, dir: 'ltr' })
    
    fireEvent.click(screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] }))
    const input = screen.getByPlaceholderText(messages['settings.locale.search.placeholder'])
    
    act(() => {
      fireEvent.change(input, { target: { value: 'xyz123' } })
      vi.advanceTimersByTime(250)
    })
    
    await waitFor(() => {
      expect(screen.getByText(messages['settings.locale.empty'])).toBeInTheDocument()
      expect(screen.queryByRole('option')).not.toBeInTheDocument()
    })
  })

  it('calls setLocale and onClose when a locale is selected via click', () => {
    const setLocale = vi.fn()
    const onClose = vi.fn()
    renderWithIntlProvider(<LocalePicker onClose={onClose} />, { locale: 'en', setLocale, dir: 'ltr' })
    
    fireEvent.click(screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] }))
    const option = screen.getByRole('option', { name: /Español/i })
    
    fireEvent.click(option)
    expect(setLocale).toHaveBeenCalledWith('es')
    expect(onClose).toHaveBeenCalledTimes(1)
    
    // Dropdown should be closed
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('announces locale changes for screen readers', () => {
    const setLocale = vi.fn()
    renderWithIntlProvider(<LocalePicker />, { locale: 'en', setLocale, dir: 'ltr' })
    
    fireEvent.click(screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] }))
    fireEvent.click(screen.getByText('Español'))
    
    const announcement = screen.getByText(messages['settings.locale.announce'].replace('{locale}', 'Español'))
    expect(announcement).toBeInTheDocument()
    expect(announcement).toHaveClass('sr-only')
  })

  it('handles keyboard interactions on the trigger correctly', () => {
    const setLocale = vi.fn()
    renderWithIntlProvider(<LocalePicker />, { locale: 'en', setLocale, dir: 'ltr' })
    const trigger = screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] })
    
    // Open with Enter
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    
    // Close with Escape
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    
    // Open with Space
    fireEvent.keyDown(trigger, { key: ' ' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('navigates options via keyboard and selects with Enter', () => {
    const setLocale = vi.fn()
    renderWithIntlProvider(<LocalePicker />, { locale: 'en', setLocale, dir: 'ltr' })
    const trigger = screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] })
    
    // Open listbox
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    
    // The first item is visually focused. Let's move down one item.
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    
    // Press Enter to select
    fireEvent.keyDown(trigger, { key: 'Enter' })
    
    // Should have selected 'es' since it's the second in SUPPORTED_LOCALES
    expect(setLocale).toHaveBeenCalledWith('es')
  })

  it('wraps keyboard navigation correctly', () => {
    const setLocale = vi.fn()
    renderWithIntlProvider(<LocalePicker />, { locale: 'en', setLocale, dir: 'ltr' })
    const trigger = screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] })
    
    fireEvent.keyDown(trigger, { key: 'Enter' })
    
    // Arrow up from index 0 should wrap to the last element
    fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    
    // Assuming Finnish ('fi') is the last supported locale
    expect(setLocale).toHaveBeenCalledWith('fi')
  })

  it('selects option with Space key', () => {
    const setLocale = vi.fn()
    renderWithIntlProvider(<LocalePicker />, { locale: 'en', setLocale, dir: 'ltr' })
    const trigger = screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] })
    
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // Select 'es'
    
    fireEvent.keyDown(trigger, { key: ' ' }) // Select via Space
    expect(setLocale).toHaveBeenCalledWith('es')
  })
  
  it('resets focus index when search results change', async () => {
    const setLocale = vi.fn()
    renderWithIntlProvider(<LocalePicker />, { locale: 'en', setLocale, dir: 'ltr' })
    
    fireEvent.click(screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] }))
    const input = screen.getByPlaceholderText(messages['settings.locale.search.placeholder'])
    
    act(() => {
      fireEvent.change(input, { target: { value: 'e' } })
      vi.advanceTimersByTime(250)
    })
    
    // After search changes, focus index is reset to 0. We verify this by pressing Enter.
    fireEvent.keyDown(screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] }), { key: 'Enter' })
    
    // Assuming 'English' ('en') is the first matching locale
    expect(setLocale).toHaveBeenCalledWith('en')
  })

  it('gracefully handles missing locale data', () => {
    const setLocale = vi.fn()
    // Test with an unknown locale
    renderWithIntlProvider(<LocalePicker />, { locale: 'unknown', setLocale, dir: 'ltr' })
    const trigger = screen.getByRole('button', { name: messages['locale.picker.trigger.ariaLabel'] })
    // It should render the locale code as fallback
    expect(trigger).toHaveTextContent('unknown')
  })
})
