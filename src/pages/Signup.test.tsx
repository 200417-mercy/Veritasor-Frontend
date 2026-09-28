import { MemoryRouter } from 'react-router-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Signup from './Signup'
import { ToastProvider } from '../components/ToastContext'
import { SUBMIT_DEMO_MS } from '../components/SubmitButton'

function renderSignup() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Signup />
      </ToastProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

// ─── Initial render ──────────────────────────────────────────────────────────

describe('Signup – initial render', () => {
  it('renders the page heading and description', () => {
    renderSignup()
    expect(screen.getByRole('heading', { name: /set up your workspace/i })).toBeInTheDocument()
    expect(screen.getByText(/create a secure veritasor account/i)).toBeInTheDocument()
  })

  it('renders all form fields with correct types and autocomplete', () => {
    renderSignup()
    const name = screen.getByLabelText(/full name/i)
    expect(name).toHaveAttribute('type', 'text')
    expect(name).toHaveAttribute('autocomplete', 'name')

    const company = screen.getByLabelText(/company/i)
    expect(company).toHaveAttribute('type', 'text')
    expect(company).toHaveAttribute('autocomplete', 'organization')

    const email = screen.getByLabelText(/work email/i)
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('autocomplete', 'email')

    const password = screen.getByLabelText(/^password$/i)
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('autocomplete', 'new-password')
  })

  it('links the password field to its hint via aria-describedby', () => {
    renderSignup()
    const password = screen.getByLabelText(/^password$/i)
    const hintId = password.getAttribute('aria-describedby')
    expect(hintId).toBeTruthy()
    expect(document.getElementById(hintId!)).toHaveTextContent(
      /use 12\+ characters with uppercase, lowercase, number, and symbol/i,
    )
  })

  it('renders the password strength preview region', () => {
    renderSignup()
    expect(screen.getByLabelText(/password strength preview/i)).toBeInTheDocument()
    expect(screen.getByText(/strong enough for a production workspace/i)).toBeInTheDocument()
  })

  it('renders the "sign in" footer link pointing to /login', () => {
    renderSignup()
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })
})

// ─── Submit button – disabled until TOS acknowledged ────────────────────────

describe('Signup – submit button initial state', () => {
  it('disables the create-account button before TOS is acknowledged', () => {
    renderSignup()
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
  })

  it('does not enter a busy state when the form is submitted without TOS acknowledgement', () => {
    renderSignup()
    // The button is disabled so a form submit via Enter shouldn't fire handleSubmit,
    // but fire the form submit event directly to guard the guard clause.
    const form = document.querySelector('form.auth-form')!
    fireEvent.submit(form)
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /creating account/i })).not.toBeInTheDocument()
  })
})

// ─── TOS modal – open / close ────────────────────────────────────────────────

describe('Signup – TOS modal open and close', () => {
  it('opens the modal when "Review changes" is clicked', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes the modal via the Cancel button without acknowledging', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Submit is still locked
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
  })

  it('closes the modal via the ✕ close button without acknowledging', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
  })

  it('closes the modal when the backdrop is clicked', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    const backdrop = document.querySelector('.modal-backdrop')!
    fireEvent.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the modal on Escape key', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

// ─── TOS modal – content ─────────────────────────────────────────────────────

describe('Signup – TOS modal content', () => {
  it('shows the current (v2.4.0) and previous (v2.3.0) version pills', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    const strip = screen.getByRole('region', { name: /terms version summary/i })
    expect(strip).toHaveTextContent('v2.4.0')
    expect(strip).toHaveTextContent('v2.3.0')
  })

  it('exposes download links for the full text and PDF', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    expect(screen.getByRole('link', { name: /download full text/i })).toHaveAttribute(
      'href',
      '/legal/terms-of-service-v2-4-0.txt',
    )
    expect(screen.getByRole('link', { name: /download pdf/i })).toHaveAttribute(
      'href',
      '/legal/terms-of-service-v2-4-0.pdf',
    )
  })

  it('lists the three diff entries (Added, Updated, Removed)', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    expect(screen.getByText(/versioned changelog and comparison view/i)).toBeInTheDocument()
    expect(screen.getByText(/data retention and export language/i)).toBeInTheDocument()
    expect(screen.getByText(/ambiguous third-party sharing wording/i)).toBeInTheDocument()
  })

  it('keeps "Acknowledge and continue" disabled until the checkbox is checked', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    expect(screen.getByRole('button', { name: /acknowledge and continue/i })).toBeDisabled()
  })

  it('enables "Acknowledge and continue" after checking the confirmation checkbox', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    fireEvent.click(screen.getByLabelText(/i have reviewed version v2\.4\.0/i))
    expect(screen.getByRole('button', { name: /acknowledge and continue/i })).toBeEnabled()
  })

  it('resets the checkbox when the modal is reopened after being dismissed', () => {
    renderSignup()
    // Open, check, cancel (without acknowledging)
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    fireEvent.click(screen.getByLabelText(/i have reviewed version v2\.4\.0/i))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    // Reopen – checkbox must be unchecked again
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    expect(screen.getByLabelText(/i have reviewed version v2\.4\.0/i)).not.toBeChecked()
    expect(screen.getByRole('button', { name: /acknowledge and continue/i })).toBeDisabled()
  })
})

// ─── TOS acknowledgement flow ────────────────────────────────────────────────

describe('Signup – TOS acknowledgement', () => {
  it('closes the modal and enables the submit button after acknowledgement', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    fireEvent.click(screen.getByLabelText(/i have reviewed version v2\.4\.0/i))
    fireEvent.click(screen.getByRole('button', { name: /acknowledge and continue/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
  })

  it('shows the acknowledged confirmation message after TOS is accepted', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    fireEvent.click(screen.getByLabelText(/i have reviewed version v2\.4\.0/i))
    fireEvent.click(screen.getByRole('button', { name: /acknowledge and continue/i }))

    const confirmation = screen.getByRole('status')
    expect(confirmation).toHaveTextContent(/terms v2\.4\.0 acknowledged/i)
    expect(confirmation).toHaveAttribute('aria-live', 'polite')
  })

  it('does not show the confirmation message before acknowledgement', () => {
    renderSignup()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

// ─── Submit state machine ────────────────────────────────────────────────────

describe('Signup – submit state machine', () => {
  function acknowledgeAndSubmit() {
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    fireEvent.click(screen.getByLabelText(/i have reviewed version v2\.4\.0/i))
    fireEvent.click(screen.getByRole('button', { name: /acknowledge and continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
  }

  it('enters a busy state immediately on submit', () => {
    vi.useFakeTimers()
    renderSignup()
    acknowledgeAndSubmit()

    const busy = screen.getByRole('button', { name: /creating account/i })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelector('.auth-submit-spinner')).toBeInTheDocument()
  })

  it('returns to idle after SUBMIT_DEMO_MS elapses', () => {
    vi.useFakeTimers()
    renderSignup()
    acknowledgeAndSubmit()

    act(() => { vi.advanceTimersByTime(SUBMIT_DEMO_MS) })

    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /creating account/i })).not.toBeInTheDocument()
  })

  it('ignores a second click while the button is busy', () => {
    vi.useFakeTimers()
    renderSignup()
    acknowledgeAndSubmit()

    // Second click on the now-disabled busy button must not restart the timer
    const busy = screen.getByRole('button', { name: /creating account/i })
    fireEvent.click(busy)

    act(() => { vi.advanceTimersByTime(SUBMIT_DEMO_MS) })

    // Should settle back to idle once, not hang
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
  })

  it('does not show a spinner before the form is submitted', () => {
    renderSignup()
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }))
    fireEvent.click(screen.getByLabelText(/i have reviewed version v2\.4\.0/i))
    fireEvent.click(screen.getByRole('button', { name: /acknowledge and continue/i }))

    expect(document.querySelector('.auth-submit-spinner')).not.toBeInTheDocument()
  })
})

// ─── Supplementary actions ───────────────────────────────────────────────────

describe('Signup – supplementary actions', () => {
  it('renders the "Book onboarding call" secondary button', () => {
    renderSignup()
    expect(screen.getByRole('button', { name: /book onboarding call/i })).toBeInTheDocument()
  })

  it('renders the TOS update notice with version references', () => {
    renderSignup()
    const notice = screen.getByRole('note')
    expect(notice).toHaveTextContent(/updated terms need review/i)
    expect(notice).toHaveTextContent(/v2\.4\.0/)
    expect(notice).toHaveTextContent(/v2\.3\.0/)
  })
})
