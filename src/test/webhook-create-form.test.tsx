/**
 * WebhookCreateForm tests
 *
 * Covers the webhook creation form for issue #269:
 * - Rendering all form fields (URL, description, event picker)
 * - URL validation (empty, invalid format, HTTP rejected, HTTPS accepted)
 * - TLS required — HTTP URLs are rejected
 * - Event selection requirement validation
 * - Form submission with valid data
 * - Cancel button behavior
 * - Submitting state
 * - Accessibility (labels, aria attributes, form landmarks)
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import WebhookCreateForm from '../components/webhooks/WebhookCreateForm'

function renderForm(overrides: {
  onSubmit?: (data: { url: string; description: string; events: string[] }) => void
  onCancel?: () => void
  isSubmitting?: boolean
} = {}) {
  const onSubmit = overrides.onSubmit ?? vi.fn()
  const onCancel = overrides.onCancel ?? vi.fn()
  return {
    onSubmit,
    onCancel,
    ...render(
      <WebhookCreateForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isSubmitting={overrides.isSubmitting}
      />,
    ),
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('WebhookCreateForm — rendering', () => {
  it('renders the form with accessible label', () => {
    renderForm()
    expect(screen.getByRole('form', { name: /create webhook endpoint/i })).toBeInTheDocument()
  })

  it('renders an endpoint URL input', () => {
    renderForm()
    expect(screen.getByLabelText(/endpoint url/i)).toBeInTheDocument()
  })

  it('renders a description input', () => {
    renderForm()
    expect(screen.getByLabelText(/webhook description/i)).toBeInTheDocument()
  })

  it('renders the event subscriptions picker', () => {
    renderForm()
    expect(screen.getByText(/event subscriptions/i)).toBeInTheDocument()
  })

  it('renders a submit button', () => {
    renderForm()
    expect(screen.getByRole('button', { name: /create endpoint/i })).toBeInTheDocument()
  })

  it('renders a cancel button when onCancel is provided', () => {
    renderForm({ onCancel: vi.fn() })
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('does not render cancel button when onCancel is not provided', () => {
    render(
      <WebhookCreateForm onSubmit={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  it('URL input has required attribute and aria-required', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    expect(urlInput).toBeRequired()
    expect(urlInput).toHaveAttribute('aria-required', 'true')
  })
})

// ─── URL Validation ───────────────────────────────────────────────────────────

describe('WebhookCreateForm — URL validation', () => {
  it('shows an error for an empty URL on submit', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/url is required/i)).toBeInTheDocument()
  })

  it('shows an error for an invalid URL format', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: 'not-a-url' } })
    fireEvent.blur(urlInput)
    expect(screen.getByText(/enter a valid url/i)).toBeInTheDocument()
  })

  it('marks the input as invalid when URL is empty on blur', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.focus(urlInput)
    fireEvent.blur(urlInput)
    expect(urlInput).toHaveAttribute('aria-invalid', 'true')
  })

  it('rejects HTTP URLs as a validation error (TLS required)', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: 'http://example.com/webhook' } })
    fireEvent.blur(urlInput)

    expect(screen.getByText(/http is not encrypted/i)).toBeInTheDocument()
    expect(urlInput).toHaveAttribute('aria-invalid', 'true')
  })

  it('accepts valid HTTPS URLs without error', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: 'https://example.com/webhook' } })
    fireEvent.blur(urlInput)

    expect(screen.queryByText(/url is required/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/enter a valid url/i)).not.toBeInTheDocument()
  })

  it('rejects non-HTTP protocols', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: 'ftp://example.com/hook' } })
    fireEvent.blur(urlInput)

    expect(screen.getByText(/url must use https protocol/i)).toBeInTheDocument()
  })

  it('aria-describedby points to error when invalid', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: 'invalid' } })
    fireEvent.blur(urlInput)

    expect(urlInput).toHaveAttribute('aria-describedby', expect.stringContaining('error'))
  })

  it('does not submit with an HTTP URL', () => {
    const { onSubmit } = renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: 'http://example.com/webhook' } })
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))

    expect(onSubmit).not.toHaveBeenCalled()
  })
})

// ─── Event selection validation ───────────────────────────────────────────────

describe('WebhookCreateForm — event validation', () => {
  it('shows event error when submitting with no events selected', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: 'https://example.com/webhook' } })
    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))

    expect(screen.getByText(/select at least one event/i)).toBeInTheDocument()
  })
})

// ─── Successful submission ────────────────────────────────────────────────────

describe('WebhookCreateForm — submission', () => {
  it('calls onSubmit with form data when valid', () => {
    const { onSubmit } = renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    const descInput = screen.getByLabelText(/webhook description/i)

    fireEvent.change(urlInput, { target: { value: 'https://example.com/webhook' } })
    fireEvent.change(descInput, { target: { value: 'My webhook for CI' } })

    // Select an event
    const eventCheckbox = screen.getByLabelText(/attestation completed/i)
    fireEvent.click(eventCheckbox)

    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      url: 'https://example.com/webhook',
      description: 'My webhook for CI',
      events: ['attestation.completed'],
    })
  })

  it('trims whitespace from URL and description', () => {
    const { onSubmit } = renderForm()
    fireEvent.change(screen.getByLabelText(/endpoint url/i), {
      target: { value: '  https://example.com/webhook  ' },
    })
    fireEvent.change(screen.getByLabelText(/webhook description/i), {
      target: { value: '  My webhook  ' },
    })
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/webhook',
        description: 'My webhook',
      }),
    )
  })
})

// ─── Cancel behavior ──────────────────────────────────────────────────────────

describe('WebhookCreateForm — cancel', () => {
  it('calls onCancel when cancel button is clicked', () => {
    const { onCancel } = renderForm({ onCancel: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

// ─── Submitting state ─────────────────────────────────────────────────────────

describe('WebhookCreateForm — submitting state', () => {
  it('disables submit button when isSubmitting is true', () => {
    renderForm({ isSubmitting: true })
    expect(screen.getByRole('button', { name: /creating…/i })).toBeDisabled()
  })

  it('disables cancel button when isSubmitting is true', () => {
    renderForm({ onCancel: vi.fn(), isSubmitting: true })
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('shows "Creating…" text when submitting', () => {
    renderForm({ isSubmitting: true })
    expect(screen.getByRole('button', { name: /creating…/i })).toBeInTheDocument()
  })

  it('has aria-busy when submitting', () => {
    renderForm({ isSubmitting: true })
    expect(screen.getByRole('button', { name: /creating…/i })).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })
})

// ─── Accessibility ────────────────────────────────────────────────────────────

describe('WebhookCreateForm — accessibility', () => {
  it('URL input has aria-invalid when invalid', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: 'bad' } })
    fireEvent.blur(urlInput)
    expect(urlInput).toHaveAttribute('aria-invalid', 'true')
  })

  it('form uses noValidate to use custom validation', () => {
    renderForm()
    const form = screen.getByRole('form', { name: /create webhook endpoint/i })
    expect(form).toHaveAttribute('noValidate')
  })

  it('URL field is auto-focused on mount', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    expect(document.activeElement).toBe(urlInput)
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('WebhookCreateForm — edge cases', () => {
  it('clears events error when events are selected after failed submit', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: 'https://example.com/webhook' } })

    // Submit with no events
    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))
    expect(screen.getByText(/select at least one event/i)).toBeInTheDocument()

    // Now select an event
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    // The event error should disappear
    expect(screen.queryByText(/select at least one event/i)).not.toBeInTheDocument()
  })

  it('treats an empty description as empty string', () => {
    const { onSubmit } = renderForm()
    fireEvent.change(screen.getByLabelText(/endpoint url/i), {
      target: { value: 'https://example.com/webhook' },
    })
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ description: '' }),
    )
  })

  it('does not call onSubmit when URL is invalid', () => {
    const { onSubmit } = renderForm()
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))

    expect(onSubmit).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════
//  URL/TLS boundaries and form state transitions
//
//  Complements the suite above with the boundary behaviours that are
//  easy to regress: the empty-submit TLS hint, whitespace-only inputs,
//  first-change (pre-blur) validation, error clearing, raw-vs-normalised
//  URL submission, multi-event ordering, and the isSubmitting default.
// ════════════════════════════════════════════════════════════════════

describe('WebhookCreateForm — URL/TLS boundaries', () => {
  it('shows the TLS hint only after an empty submit attempt', () => {
    renderForm()
    expect(screen.queryByText(/all webhook endpoints must use https/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))

    expect(screen.getByText(/all webhook endpoints must use https/i)).toBeInTheDocument()
  })

  it('treats a whitespace-only URL as required, not as an invalid format', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: '     ' } })
    fireEvent.blur(urlInput)

    expect(screen.getByText(/url is required/i)).toBeInTheDocument()
    expect(screen.queryByText(/enter a valid url/i)).not.toBeInTheDocument()
  })

  it('validates on the first change without waiting for blur', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: 'http://example.com/hook' } })

    expect(screen.getByText(/http is not encrypted/i)).toBeInTheDocument()
  })

  it('clears the error and aria-invalid once the URL becomes valid', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)

    fireEvent.change(urlInput, { target: { value: 'http://example.com/hook' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(urlInput).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(urlInput, { target: { value: 'https://example.com/hook' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(urlInput).toHaveAttribute('aria-invalid', 'false')
  })

  it('rejects a whitespace-padded invalid URL', () => {
    renderForm()
    const urlInput = screen.getByLabelText(/endpoint url/i)
    fireEvent.change(urlInput, { target: { value: '  not-a-url  ' } })
    fireEvent.blur(urlInput)

    expect(screen.getByText(/enter a valid url/i)).toBeInTheDocument()
  })

  it('accepts an upper-case HTTPS scheme and submits the raw trimmed URL', () => {
    const { onSubmit } = renderForm()
    fireEvent.change(screen.getByLabelText(/endpoint url/i), {
      target: { value: 'HTTPS://example.com/hook' },
    })
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))

    // validateUrl normalises via `new URL` for the scheme check, but the
    // submitted payload is the caller's own (trimmed) string.
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'HTTPS://example.com/hook' }),
    )
  })
})

describe('WebhookCreateForm — selection and submission state', () => {
  it('passes every selected event through, preserving selection order', () => {
    const { onSubmit } = renderForm()
    fireEvent.change(screen.getByLabelText(/endpoint url/i), {
      target: { value: 'https://example.com/hook' },
    })
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    fireEvent.click(screen.getByLabelText(/attestation failed/i))
    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ events: ['attestation.completed', 'attestation.failed'] }),
    )
  })

  it('trims a whitespace-only description to the empty string', () => {
    const { onSubmit } = renderForm()
    fireEvent.change(screen.getByLabelText(/endpoint url/i), {
      target: { value: 'https://example.com/hook' },
    })
    fireEvent.change(screen.getByLabelText(/webhook description/i), {
      target: { value: '    ' },
    })
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    fireEvent.click(screen.getByRole('button', { name: /create endpoint/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ description: '' }))
  })

  it('is enabled and not busy when isSubmitting is omitted', () => {
    renderForm()
    const submit = screen.getByRole('button', { name: /create endpoint/i })
    expect(submit).not.toBeDisabled()
    expect(submit).toHaveAttribute('aria-busy', 'false')
  })

  it('invokes onSubmit on every valid submit (no client-side re-entrancy guard)', () => {
    const { onSubmit } = renderForm()
    fireEvent.change(screen.getByLabelText(/endpoint url/i), {
      target: { value: 'https://example.com/hook' },
    })
    fireEvent.click(screen.getByLabelText(/attestation completed/i))

    const submit = screen.getByRole('button', { name: /create endpoint/i })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(onSubmit).toHaveBeenCalledTimes(2)
  })
})
