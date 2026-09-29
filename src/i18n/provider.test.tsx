import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useContext } from 'react'
import { LocaleProvider, LocaleContext } from './provider'
import { LOCALE_STORAGE_KEY, FALLBACK_LOCALE, DEFAULT_LOCALE } from './config'

function ConsumerComponent() {
  const { locale, setLocale, dir } = useContext(LocaleContext)
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <button onClick={() => setLocale('fr')} data-testid="btn-fr">Set FR</button>
      <button onClick={() => setLocale('ar')} data-testid="btn-ar">Set AR</button>
      <button onClick={() => setLocale('invalid')} data-testid="btn-invalid">Set Invalid</button>
      <button onClick={() => setLocale('')} data-testid="btn-empty">Set Empty</button>
    </div>
  )
}

describe('LocaleProvider and LocaleContext', () => {
  const originalLanguage = window.navigator.language

  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = ''
    document.documentElement.dir = ''
    vi.restoreAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(window.navigator, 'language', {
      value: originalLanguage,
      configurable: true,
    })
  })

  it('provides default locale values when initialized without stored preference', () => {
    render(
      <LocaleProvider>
        <ConsumerComponent />
      </LocaleProvider>
    )
    
    expect(screen.getByTestId('locale').textContent).toBe(FALLBACK_LOCALE)
    expect(screen.getByTestId('dir').textContent).toBe('ltr')
    expect(document.documentElement.lang).toBe(FALLBACK_LOCALE)
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('uses the saved locale preference from localStorage on mount', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'es')
    render(
      <LocaleProvider>
        <ConsumerComponent />
      </LocaleProvider>
    )
    
    expect(screen.getByTestId('locale').textContent).toBe('es')
    expect(screen.getByTestId('dir').textContent).toBe('ltr')
    expect(document.documentElement.lang).toBe('es')
  })

  it('falls back to browser locale when no saved preference exists', () => {
    Object.defineProperty(window.navigator, 'language', { value: 'es-MX', configurable: true })
    
    render(
      <LocaleProvider>
        <ConsumerComponent />
      </LocaleProvider>
    )
    
    expect(screen.getByTestId('locale').textContent).toBe('es')
    expect(document.documentElement.lang).toBe('es')
  })

  it('updates locale, dir, document attributes, and localStorage when setLocale is called', () => {
    render(
      <LocaleProvider>
        <ConsumerComponent />
      </LocaleProvider>
    )
    
    fireEvent.click(screen.getByTestId('btn-fr'))
    
    expect(screen.getByTestId('locale').textContent).toBe('fr')
    expect(screen.getByTestId('dir').textContent).toBe('ltr')
    expect(document.documentElement.lang).toBe('fr')
    expect(document.documentElement.dir).toBe('ltr')
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('fr')

    fireEvent.click(screen.getByTestId('btn-ar'))
    
    expect(screen.getByTestId('locale').textContent).toBe('ar')
    expect(screen.getByTestId('dir').textContent).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar')
  })

  it('normalizes unsupported locales to default locale without crashing', () => {
    render(
      <LocaleProvider>
        <ConsumerComponent />
      </LocaleProvider>
    )
    
    fireEvent.click(screen.getByTestId('btn-invalid'))
    
    expect(screen.getByTestId('locale').textContent).toBe(DEFAULT_LOCALE)
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(DEFAULT_LOCALE)
  })

  it('handles empty string locale by falling back to default', () => {
    render(
      <LocaleProvider>
        <ConsumerComponent />
      </LocaleProvider>
    )
    
    fireEvent.click(screen.getByTestId('btn-empty'))
    
    expect(screen.getByTestId('locale').textContent).toBe(DEFAULT_LOCALE)
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(DEFAULT_LOCALE)
  })
})
