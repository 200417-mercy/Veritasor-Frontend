/**
 * MfaMethodChooser — dedicated focused test suite
 * Closes issue #586
 *
 * Covers:
 *  - MfaMethod type: all valid values ('totp', 'sms', 'security-key')
 *  - MfaMethodChooser public contract: value, onChange, aria-label props
 *  - Initial render with value=null (no radio selected)
 *  - Selecting each MFA method triggers onChange with the correct MfaMethod value
 *  - Controlled value prop is reflected in the checked radio state
 *  - Recommended badge: present only on security-key, exactly once
 *  - Pros/cons lists rendered for all three methods
 *  - Learn-more popover: open/close, mutual exclusion, Escape key, backdrop click
 *  - Accessibility: fieldset/legend, aria-describedby, radio group name sharing,
 *    aria-expanded, aria-controls on learn-more triggers
 *  - Invalid / boundary inputs: null value, rapid toggling (no crash),
 *    custom aria-label override, re-render stability
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MfaMethodChooser, { type MfaMethod } from './MfaMethodChooser'

// ─── Render helper ─────────────────────────────────────────────────────────────

function renderChooser(value: MfaMethod | null = null, ariaLabel?: string) {
  const onChange = vi.fn()
  const result = render(
    <MfaMethodChooser
      value={value}
      onChange={onChange}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
    />,
  )
  return { ...result, onChange }
}

// ─── 1. MfaMethod type: valid values ──────────────────────────────────────────

describe('MfaMethod type — valid values', () => {
  it('accepts "totp" as a valid MfaMethod', () => {
    expect(() => renderChooser('totp')).not.toThrow()
  })

  it('accepts "sms" as a valid MfaMethod', () => {
    expect(() => renderChooser('sms')).not.toThrow()
  })

  it('accepts "security-key" as a valid MfaMethod', () => {
    expect(() => renderChooser('security-key')).not.toThrow()
  })

  it('accepts null as a valid initial value (no selection)', () => {
    expect(() => renderChooser(null)).not.toThrow()
  })
})

// ─── 2. Rendering ─────────────────────────────────────────────────────────────

describe('MfaMethodChooser — rendering', () => {
  it('renders a fieldset with a legend', () => {
    renderChooser()
    expect(screen.getByRole('group')).toBeInTheDocument()
    expect(screen.getByText(/choose a two-factor authentication method/i)).toBeInTheDocument()
  })

  it('renders exactly 3 radio buttons', () => {
    renderChooser()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('renders TOTP card title', () => {
    renderChooser()
    expect(screen.getByText(/authenticator app/i)).toBeInTheDocument()
  })

  it('renders SMS card title', () => {
    renderChooser()
    expect(screen.getByText(/sms text message/i)).toBeInTheDocument()
  })

  it('renders Security Key card title', () => {
    renderChooser()
    expect(screen.getAllByText(/security key/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders emoji icons for all three methods', () => {
    renderChooser()
    expect(screen.getAllByText(/^(📱|💬|🔐)$/).length).toBe(3)
  })

  it('renders the description paragraph', () => {
    renderChooser()
    expect(screen.getByText(/second factor during sign-in/i)).toBeInTheDocument()
  })

  it('renders exactly 3 "Learn more" buttons', () => {
    renderChooser()
    expect(screen.getAllByRole('button', { name: /learn more about/i })).toHaveLength(3)
  })
})

// ─── 3. Initial state: value=null ─────────────────────────────────────────────

describe('MfaMethodChooser — initial state (null)', () => {
  it('no radio is checked when value is null', () => {
    renderChooser(null)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    radios.forEach((r) => expect(r.checked).toBe(false))
  })

  it('onChange is not called on initial render', () => {
    const { onChange } = renderChooser(null)
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ─── 4. Selection state transitions ──────────────────────────────────────────

describe('MfaMethodChooser — selection state transitions', () => {
  it('clicking the TOTP radio calls onChange with "totp"', () => {
    const { onChange } = renderChooser()
    fireEvent.click(screen.getAllByRole('radio')[0])
    expect(onChange).toHaveBeenCalledWith('totp')
  })

  it('clicking the SMS radio calls onChange with "sms"', () => {
    const { onChange } = renderChooser()
    fireEvent.click(screen.getAllByRole('radio')[1])
    expect(onChange).toHaveBeenCalledWith('sms')
  })

  it('clicking the Security Key radio calls onChange with "security-key"', () => {
    const { onChange } = renderChooser()
    fireEvent.click(screen.getAllByRole('radio')[2])
    expect(onChange).toHaveBeenCalledWith('security-key')
  })

  it('clicking the TOTP card label selects TOTP', () => {
    const { onChange } = renderChooser()
    const cards = document.querySelectorAll<HTMLElement>('.mfa-choice-card')
    fireEvent.click(cards[0])
    expect(onChange).toHaveBeenCalledWith('totp')
  })

  it('controlled value "totp" checks the first radio', () => {
    renderChooser('totp')
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios[0].checked).toBe(true)
    expect(radios[1].checked).toBe(false)
    expect(radios[2].checked).toBe(false)
  })

  it('controlled value "sms" checks the second radio', () => {
    renderChooser('sms')
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios[0].checked).toBe(false)
    expect(radios[1].checked).toBe(true)
    expect(radios[2].checked).toBe(false)
  })

  it('controlled value "security-key" checks the third radio', () => {
    renderChooser('security-key')
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios[0].checked).toBe(false)
    expect(radios[1].checked).toBe(false)
    expect(radios[2].checked).toBe(true)
  })

  it('re-rendering with a new value updates the checked radio', () => {
    const { onChange, rerender } = renderChooser(null)

    rerender(<MfaMethodChooser value="sms" onChange={onChange} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios[1].checked).toBe(true)

    rerender(<MfaMethodChooser value="security-key" onChange={onChange} />)
    expect(radios[2].checked).toBe(true)
    expect(radios[1].checked).toBe(false)
  })

  it('all radios share the same name attribute (mutually exclusive group)', () => {
    renderChooser()
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const name = radios[0].name
    expect(name).toBeTruthy()
    radios.forEach((r) => expect(r.name).toBe(name))
  })
})

// ─── 5. Recommended badge ─────────────────────────────────────────────────────

describe('MfaMethodChooser — Recommended badge', () => {
  it('shows exactly one "Recommended" badge', () => {
    renderChooser()
    expect(screen.getAllByText('Recommended')).toHaveLength(1)
  })

  it('the badge appears in the security key card', () => {
    renderChooser()
    const badge = screen.getByText('Recommended')
    expect(badge.className).toContain('mfa-recommended-badge')
  })

  it('TOTP card does not show a "Recommended" badge', () => {
    renderChooser()
    // Security key card contains the badge; TOTP card title text should not be adjacent to it
    const totpTitle = screen.getByText(/authenticator app/i)
    expect(totpTitle.closest('.mfa-choice-card')).not.toHaveTextContent('Recommended')
  })

  it('SMS card does not show a "Recommended" badge', () => {
    renderChooser()
    const smsTitle = screen.getByText(/sms text message/i)
    expect(smsTitle.closest('.mfa-choice-card')).not.toHaveTextContent('Recommended')
  })
})

// ─── 6. Pros / cons ───────────────────────────────────────────────────────────

describe('MfaMethodChooser — pros & cons', () => {
  it('renders "✓ Pros" heading in each of the 3 cards', () => {
    renderChooser()
    expect(screen.getAllByText('✓ Pros')).toHaveLength(3)
  })

  it('renders "✗ Considerations" heading in each of the 3 cards', () => {
    renderChooser()
    expect(screen.getAllByText('✗ Considerations')).toHaveLength(3)
  })

  it('shows TOTP pro: works offline', () => {
    renderChooser()
    expect(screen.getByText(/works offline/i)).toBeInTheDocument()
  })

  it('shows SMS con: SIM-swap attacks', () => {
    renderChooser()
    expect(screen.getByText(/sim-swap/i)).toBeInTheDocument()
  })

  it('shows Security Key pro: phishing-resistant', () => {
    renderChooser()
    expect(screen.getAllByText(/phishing-resistant/i).length).toBeGreaterThanOrEqual(1)
  })
})

// ─── 7. Learn-more popover state transitions ──────────────────────────────────

describe('MfaMethodChooser — learn-more popover', () => {
  it('TOTP popover opens when its Learn more button is clicked', () => {
    renderChooser()
    fireEvent.click(screen.getByRole('button', { name: /learn more about authenticator app/i }))
    expect(screen.getByText(/RFC 6238/i)).toBeInTheDocument()
  })

  it('popover trigger has aria-expanded=true when open', () => {
    renderChooser()
    const btn = screen.getByRole('button', { name: /learn more about authenticator app/i })
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
  })

  it('popover trigger has aria-expanded=false when closed', () => {
    renderChooser()
    const btn = screen.getByRole('button', { name: /learn more about authenticator app/i })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('close button inside popover closes the popover', () => {
    renderChooser()
    fireEvent.click(screen.getByRole('button', { name: /learn more about authenticator app/i }))
    expect(screen.getByText(/RFC 6238/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close learn more/i }))
    expect(screen.queryByText(/RFC 6238/i)).not.toBeInTheDocument()
  })

  it('Escape key closes the open popover', () => {
    renderChooser()
    fireEvent.click(screen.getByRole('button', { name: /learn more about authenticator app/i }))
    fireEvent.keyDown(screen.getByRole('region'), { key: 'Escape' })
    expect(screen.queryByText(/RFC 6238/i)).not.toBeInTheDocument()
  })

  it('clicking the backdrop closes the popover', () => {
    renderChooser()
    fireEvent.click(screen.getByRole('button', { name: /learn more about authenticator app/i }))
    const backdrop = document.querySelector('.mfa-learn-backdrop')!
    fireEvent.click(backdrop)
    expect(screen.queryByText(/RFC 6238/i)).not.toBeInTheDocument()
  })

  it('clicking the same Learn more button again toggles the popover closed', () => {
    renderChooser()
    const btn = screen.getByRole('button', { name: /learn more about authenticator app/i })
    fireEvent.click(btn)
    expect(screen.getByText(/RFC 6238/i)).toBeInTheDocument()
    fireEvent.click(btn)
    expect(screen.queryByText(/RFC 6238/i)).not.toBeInTheDocument()
  })

  it('only one popover can be open at a time (mutual exclusion)', () => {
    renderChooser()
    const totpBtn = screen.getByRole('button', { name: /learn more about authenticator app/i })
    const smsBtn = screen.getByRole('button', { name: /learn more about sms text message/i })

    fireEvent.click(totpBtn)
    expect(screen.getByText(/RFC 6238/i)).toBeInTheDocument()

    fireEvent.click(smsBtn)
    expect(screen.queryByText(/RFC 6238/i)).not.toBeInTheDocument()
    expect(screen.getByText(/SS7 vulnerabilities/i)).toBeInTheDocument()
  })

  it('Security Key popover shows FIDO2 content', () => {
    renderChooser()
    fireEvent.click(screen.getByRole('button', { name: /learn more about security key/i }))
    expect(screen.getByText(/public-key cryptography/i)).toBeInTheDocument()
  })

  it('SMS popover shows SMS-specific content', () => {
    renderChooser()
    fireEvent.click(screen.getByRole('button', { name: /learn more about sms text message/i }))
    expect(screen.getByText(/SS7 vulnerabilities/i)).toBeInTheDocument()
  })

  it('popover has the correct CSS class', () => {
    renderChooser()
    fireEvent.click(screen.getByRole('button', { name: /learn more about authenticator app/i }))
    expect(screen.getByRole('region')).toHaveClass('mfa-learn-popover')
  })

  it('trigger has aria-controls linking to the popover id', () => {
    renderChooser()
    const btn = screen.getByRole('button', { name: /learn more about authenticator app/i })
    expect(btn).toHaveAttribute('aria-controls')
  })
})

// ─── 8. Accessibility ─────────────────────────────────────────────────────────

describe('MfaMethodChooser — accessibility', () => {
  it('fieldset has aria-describedby pointing to the description paragraph', () => {
    renderChooser()
    const fieldset = screen.getByRole('group')
    const descId = fieldset.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    const desc = document.getElementById(descId!)
    expect(desc).toBeInTheDocument()
    expect(desc!).toHaveClass('mfa-description')
  })

  it('custom aria-label overrides the default legend text', () => {
    renderChooser(null, 'Pick your 2FA method')
    expect(screen.getByText('Pick your 2FA method')).toBeInTheDocument()
    expect(screen.queryByText(/choose a two-factor authentication method/i)).not.toBeInTheDocument()
  })

  it('radio buttons can be focused programmatically', () => {
    renderChooser()
    const radio = screen.getAllByRole('radio')[0]
    radio.focus()
    expect(document.activeElement).toBe(radio)
  })

  it('learn-more buttons are focusable', () => {
    renderChooser()
    const btn = screen.getByRole('button', { name: /learn more about authenticator app/i })
    btn.focus()
    expect(document.activeElement).toBe(btn)
  })
})

// ─── 9. Boundary / invalid-input cases ────────────────────────────────────────

describe('MfaMethodChooser — boundary & invalid inputs', () => {
  it('renders without crashing with value=null', () => {
    expect(() => renderChooser(null)).not.toThrow()
  })

  it('does not crash on rapid learn-more toggles', () => {
    renderChooser()
    const btn = screen.getByRole('button', { name: /learn more about authenticator app/i })
    expect(() => {
      fireEvent.click(btn)
      fireEvent.click(btn)
      fireEvent.click(btn)
      fireEvent.click(btn)
    }).not.toThrow()
  })

  it('does not crash when re-rendered multiple times', () => {
    const { onChange, rerender } = renderChooser(null)
    expect(() => {
      rerender(<MfaMethodChooser value="totp" onChange={onChange} />)
      rerender(<MfaMethodChooser value="sms" onChange={onChange} />)
      rerender(<MfaMethodChooser value="security-key" onChange={onChange} />)
      rerender(<MfaMethodChooser value={null} onChange={onChange} />)
    }).not.toThrow()
  })

  it('onChange receives a valid MfaMethod string, never null or undefined', () => {
    const { onChange } = renderChooser()
    const radios = screen.getAllByRole('radio')
    radios.forEach((radio) => {
      fireEvent.click(radio)
    })
    onChange.mock.calls.forEach(([value]: [MfaMethod]) => {
      expect(['totp', 'sms', 'security-key']).toContain(value)
    })
  })
})
