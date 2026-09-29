/**
 * Focused behavior coverage for `LocaleAccountMenu`
 * (src/components/LocalePicker/LocaleAccountMenu.tsx).
 *
 * The component is an accessible account-menu entry that hosts the locale
 * picker and forwards the active locale's direction. These tests drive its
 * public behavior through the DOM: open/close state, dialog semantics, focus
 * return, outside-click dismissal, locale selection, RTL propagation, and the
 * unsupported-locale fallback.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import LocaleAccountMenu from '../components/LocalePicker/LocaleAccountMenu'
import { LocaleProvider } from '../i18n/provider'

const MOBILE_QUERY = '(max-width: 640px)'

function renderMenu() {
  return render(
    <LocaleProvider>
      <LocaleAccountMenu />
    </LocaleProvider>,
  )
}

function menuTrigger() {
  // The translated label is only present in en.json; for other locales the
  // message id itself is the accessible-name fallback, so match on the id too.
  return screen.getByRole('button', { name: /language/i })
}

function mockMatchMedia(mobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: mobile && query === MOBILE_QUERY,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('dir')
  document.documentElement.removeAttribute('lang')
  mockMatchMedia(false)
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: 'en-US',
  })
})

describe('LocaleAccountMenu — behavior coverage', () => {
  it('renders the current locale label, code badge, and closed dialog ARIA state', () => {
    renderMenu()

    const trigger = menuTrigger()
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).not.toHaveAttribute('aria-controls')

    // Native label alongside the English label and the lowercase code badge.
    expect(screen.getAllByText('English').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('en')).toBeInTheDocument()
    expect(trigger.parentElement).toHaveAttribute('dir', 'ltr')
  })

  it('opens a labelled dialog and closes it when the trigger is toggled again', () => {
    renderMenu()

    const trigger = menuTrigger()
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('aria-controls')

    const dialog = screen.getByRole('dialog', { name: 'Language' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Translator copy guidance')).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('selects a locale, closes the panel, and updates the trigger label and badge', () => {
    renderMenu()

    fireEvent.click(menuTrigger())
    fireEvent.click(screen.getByRole('button', { name: /select language/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('option', { name: /español/i }))

    expect(window.localStorage.getItem('preferred-locale')).toBe('es')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const trigger = menuTrigger()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByText('Español').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('es')).toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the trigger', () => {
    renderMenu()

    fireEvent.click(menuTrigger())
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(menuTrigger()).toHaveFocus()
  })

  it('closes on an outside pointer press but stays open on an inside press', () => {
    renderMenu()

    fireEvent.click(menuTrigger())
    const dialog = screen.getByRole('dialog')

    // Inside press must not dismiss.
    fireEvent.mouseDown(dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Outside press dismisses.
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('propagates the RTL direction for a right-to-left locale', () => {
    window.localStorage.setItem('preferred-locale', 'ar')
    renderMenu()

    const trigger = menuTrigger()
    expect(trigger.parentElement).toHaveAttribute('dir', 'rtl')
    expect(screen.getAllByText('العربية').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('ar')).toBeInTheDocument()
  })

  it('falls back to English for an unsupported stored locale', () => {
    window.localStorage.setItem('preferred-locale', 'xx-INVALID')
    renderMenu()

    expect(menuTrigger()).toHaveAccessibleName(/language: english/i)
    expect(screen.getAllByText('English').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('en')).toBeInTheDocument()
  })

  it('uses the bottom-sheet positioning class on small screens', () => {
    mockMatchMedia(true)
    renderMenu()

    fireEvent.click(menuTrigger())
    const dialog = screen.getByRole('dialog')

    expect(dialog.className).toContain('fixed')
    expect(dialog.className).toContain('bottom-0')
    expect(dialog.className).not.toContain('absolute')
  })

  it('uses the anchored dropdown positioning class on large screens', () => {
    renderMenu()

    fireEvent.click(menuTrigger())
    const dialog = screen.getByRole('dialog')

    expect(dialog.className).toContain('absolute')
    expect(dialog.className).toContain('right-0')
    expect(dialog.className).not.toContain('bottom-0')
  })
})
