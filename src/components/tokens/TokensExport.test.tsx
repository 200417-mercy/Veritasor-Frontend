/**
 * Dedicated test suite for TokensExport (#631)
 *
 * Covers:
 *  - Default render (heading, buttons, preview textarea, live region)
 *  - Scope radio group – all three variants present and default selection
 *  - Variant switching – CSS output updates when a different radio is chosen
 *  - Copy to clipboard – success notification appears, clipboard API is called
 *  - Download – <a> element is created and a click is triggered
 *  - Preview content – comment header with version present
 *  - Boundary: invalid / missing clipboard API falls back silently
 *  - Accessibility: aria-live region, readonly textarea, radiogroup label
 */

import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import TokensExport from './TokensExport'

// ─── helpers ─────────────────────────────────────────────────────────────────

function renderComponent() {
  return render(<TokensExport />)
}

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('TokensExport – rendering', () => {
  it('renders the "Export design tokens" heading', () => {
    renderComponent()
    expect(
      screen.getByRole('heading', { name: /export design tokens/i }),
    ).toBeInTheDocument()
  })

  it('renders the introductory description paragraph', () => {
    renderComponent()
    expect(screen.getByText(/export a snapshot of veritasor design tokens/i)).toBeInTheDocument()
  })

  it('renders the "Copy to clipboard" button', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument()
  })

  it('renders the "Download file" button', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /download file/i })).toBeInTheDocument()
  })

  it('renders a read-only preview textarea', () => {
    renderComponent()
    const textarea = screen.getByRole('textbox', { name: /css custom properties preview/i })
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveAttribute('readonly')
  })

  it('renders a polite aria-live region for announcements', () => {
    renderComponent()
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()
  })

  it('renders the scope fieldset/legend', () => {
    renderComponent()
    expect(screen.getByRole('group', { name: /scope/i })).toBeInTheDocument()
  })
})

// ─── Scope radio group ───────────────────────────────────────────────────────

describe('TokensExport – scope radio group', () => {
  it('renders the :root radio option', () => {
    renderComponent()
    expect(
      screen.getByRole('radio', { name: ':root (default dark)' }),
    ).toBeInTheDocument()
  })

  it('renders the [data-theme="light"] radio option', () => {
    renderComponent()
    expect(
      screen.getByRole('radio', { name: '[data-theme="light"]' }),
    ).toBeInTheDocument()
  })

  it('renders the [data-theme="dark"] radio option', () => {
    renderComponent()
    expect(
      screen.getByRole('radio', { name: '[data-theme="dark"]' }),
    ).toBeInTheDocument()
  })

  it('defaults to the :root radio selected', () => {
    renderComponent()
    const rootRadio = screen.getByRole('radio', { name: ':root (default dark)' })
    expect(rootRadio).toBeChecked()
  })

  it('light and dark radios are unchecked by default', () => {
    renderComponent()
    expect(screen.getByRole('radio', { name: '[data-theme="light"]' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: '[data-theme="dark"]' })).not.toBeChecked()
  })
})

// ─── Variant switching ───────────────────────────────────────────────────────

describe('TokensExport – variant switching', () => {
  it('default preview contains dark theme --bg token', () => {
    renderComponent()
    const textarea = screen.getByRole('textbox', {
      name: /css custom properties preview/i,
    }) as HTMLTextAreaElement
    expect(textarea.value).toContain('--bg: #07111f;')
  })

  it('switching to light updates the preview with light --bg token', () => {
    renderComponent()
    act(() => {
      screen.getByRole('radio', { name: /light/i }).click()
    })
    const textarea = screen.getByRole('textbox', {
      name: /css custom properties preview/i,
    }) as HTMLTextAreaElement
    expect(textarea.value).toContain('--bg: #f8fafc;')
  })

  it('switching to dark generates the no-tokens comment for the dark variant', () => {
    renderComponent()
    act(() => {
      screen.getByRole('radio', { name: /\[data-theme="dark"\]/i }).click()
    })
    const textarea = screen.getByRole('textbox', {
      name: /css custom properties preview/i,
    }) as HTMLTextAreaElement
    expect(textarea.value).toContain('[data-theme="dark"]')
  })

  it('switching back to root restores the dark --bg token', () => {
    renderComponent()
    // Switch to light first
    act(() => {
      screen.getByRole('radio', { name: /light/i }).click()
    })
    // Then back to root
    act(() => {
      screen.getByRole('radio', { name: ':root (default dark)' }).click()
    })
    const textarea = screen.getByRole('textbox', {
      name: /css custom properties preview/i,
    }) as HTMLTextAreaElement
    expect(textarea.value).toContain('--bg: #07111f;')
  })
})

// ─── Preview content ─────────────────────────────────────────────────────────

describe('TokensExport – preview content', () => {
  it('preview contains the Veritasor Design Tokens comment header', () => {
    renderComponent()
    const textarea = screen.getByRole('textbox', {
      name: /css custom properties preview/i,
    }) as HTMLTextAreaElement
    expect(textarea.value).toContain('Veritasor Design Tokens')
  })

  it('preview contains a version string', () => {
    renderComponent()
    const textarea = screen.getByRole('textbox', {
      name: /css custom properties preview/i,
    }) as HTMLTextAreaElement
    expect(textarea.value).toContain('Version: 0.1.0')
  })

  it('preview contains a :root { opening rule for the default variant', () => {
    renderComponent()
    const textarea = screen.getByRole('textbox', {
      name: /css custom properties preview/i,
    }) as HTMLTextAreaElement
    expect(textarea.value).toContain(':root {')
  })
})

// ─── Copy to clipboard ───────────────────────────────────────────────────────

describe('TokensExport – copy to clipboard', () => {
  let originalClipboard: Clipboard

  beforeEach(() => {
    originalClipboard = navigator.clipboard
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    })
  })

  it('calls clipboard.writeText with the current CSS on copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    renderComponent()
    await act(async () => {
      screen.getByRole('button', { name: /copy to clipboard/i }).click()
    })

    expect(writeText).toHaveBeenCalledOnce()
    const [arg] = writeText.mock.calls[0]
    expect(typeof arg).toBe('string')
    expect(arg.length).toBeGreaterThan(0)
  })

  it('shows "Copied to clipboard ✓" success notification after copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    renderComponent()
    await act(async () => {
      screen.getByRole('button', { name: /copy to clipboard/i }).click()
    })

    expect(screen.getByText(/copied to clipboard ✓/i)).toBeInTheDocument()
  })

  it('does not throw when the clipboard API is unavailable', async () => {
    // Simulate clipboard API unavailability by rejecting the promise
    const writeText = vi.fn().mockRejectedValue(new Error('Not allowed'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    renderComponent()
    // Should not throw
    await act(async () => {
      screen.getByRole('button', { name: /copy to clipboard/i }).click()
    })

    // Success notification should NOT appear since clipboard failed
    expect(screen.queryByText(/copied to clipboard ✓/i)).toBeNull()
  })
})

// ─── Download ────────────────────────────────────────────────────────────────

describe('TokensExport – download', () => {
  it('creates an <a> element when the download button is clicked', () => {
    const createElementSpy = vi.spyOn(document, 'createElement')
    renderComponent()
    act(() => {
      screen.getByRole('button', { name: /download file/i }).click()
    })
    expect(createElementSpy).toHaveBeenCalledWith('a')
  })

  it('triggers a click on the created anchor (download behaviour)', () => {
    const mockClick = vi.fn()
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag)
      if (tag === 'a') {
        el.click = mockClick
      }
      return el
    })

    renderComponent()
    act(() => {
      screen.getByRole('button', { name: /download file/i }).click()
    })

    expect(mockClick).toHaveBeenCalledOnce()
    vi.restoreAllMocks()
  })
})

// ─── Accessibility ───────────────────────────────────────────────────────────

describe('TokensExport – accessibility', () => {
  it('the live region is aria-atomic', () => {
    renderComponent()
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
  })

  it('the radiogroup has an accessible label "Token export scope"', () => {
    renderComponent()
    expect(
      screen.getByRole('radiogroup', { name: /token export scope/i }),
    ).toBeInTheDocument()
  })

  it('the preview textarea has an explicit id for the label association', () => {
    renderComponent()
    const textarea = screen.getByRole('textbox', { name: /css custom properties preview/i })
    expect(textarea).toHaveAttribute('id', 'tokens-preview')
  })
})
