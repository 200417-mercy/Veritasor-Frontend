import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { FormEvent } from 'react'
import SubmitButton, { SUBMIT_DEMO_MS } from './SubmitButton'

describe('SUBMIT_DEMO_MS', () => {
  it('is a bounded demo delay', () => {
    expect(SUBMIT_DEMO_MS).toBeGreaterThanOrEqual(1)
    expect(SUBMIT_DEMO_MS).toBeLessThanOrEqual(1000)
  })
})

describe('SubmitButton', () => {
  it('renders the idle label and stays enabled', () => {
    render(<SubmitButton idleLabel="Sign in" busyLabel="Signing in…" />)

    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('aria-busy')
    expect(button).toHaveClass('auth-button', 'auth-button-primary', 'auth-submit')
    expect(button).toHaveAttribute('type', 'submit')
    expect(document.querySelector('.auth-submit-spinner')).not.toBeInTheDocument()
  })

  it('swaps to the busy label, spinner, and busy semantics', () => {
    render(<SubmitButton idleLabel="Sign in" busyLabel="Signing in…" busy />)

    const button = screen.getByRole('button', { name: /signing in/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument()
    const spinner = document.querySelector('.auth-submit-spinner')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveAttribute('aria-hidden', 'true')
    expect(spinner).toHaveAttribute('focusable', 'false')
  })

  it('disables without a spinner when only disabled is set', () => {
    render(
      <SubmitButton idleLabel="Create account" busyLabel="Creating account…" disabled />,
    )

    const button = screen.getByRole('button', { name: /create account/i })
    expect(button).toBeDisabled()
    expect(button).not.toHaveAttribute('aria-busy')
    expect(document.querySelector('.auth-submit-spinner')).not.toBeInTheDocument()
  })

  it('appends className without dropping auth classes', () => {
    render(
      <SubmitButton
        idleLabel="Sign in"
        busyLabel="Signing in…"
        className="extra-submit"
      />,
    )

    expect(screen.getByRole('button', { name: /sign in/i })).toHaveClass(
      'auth-button',
      'auth-submit',
      'extra-submit',
    )
  })

  it('does not fire submit while busy', () => {
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault())

    render(
      <form onSubmit={onSubmit}>
        <SubmitButton idleLabel="Save" busyLabel="Saving…" busy />
      </form>,
    )

    fireEvent.click(screen.getByRole('button', { name: /saving/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not fire submit when disabled', () => {
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault())

    render(
      <form onSubmit={onSubmit}>
        <SubmitButton idleLabel="Create account" busyLabel="Creating account…" disabled />
      </form>,
    )

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits once from the idle state', () => {
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault())

    render(
      <form onSubmit={onSubmit}>
        <SubmitButton idleLabel="Sign in" busyLabel="Signing in…" />
      </form>,
    )

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})

describe('SubmitButton label announcements', () => {
  it('announces the label through a polite live region', () => {
    render(<SubmitButton idleLabel="Sign in" busyLabel="Signing in…" />)

    const label = document.querySelector('.auth-submit-label')
    expect(label).toBeInTheDocument()
    expect(label).toHaveAttribute('aria-live', 'polite')
    expect(label).toHaveTextContent('Sign in')
  })

  it('swaps the announced label text when busy', () => {
    render(<SubmitButton idleLabel="Sign in" busyLabel="Signing in…" busy />)

    expect(document.querySelector('.auth-submit-label')).toHaveTextContent('Signing in…')
  })

  it('accepts non-string label nodes', () => {
    render(
      <SubmitButton
        idleLabel={<span data-testid="idle-node">Save now</span>}
        busyLabel={<span data-testid="busy-node">Saving…</span>}
      />,
    )

    expect(screen.getByTestId('idle-node')).toBeInTheDocument()
    expect(screen.queryByTestId('busy-node')).not.toBeInTheDocument()
  })
})

describe('SubmitButton prop forwarding', () => {
  it('honours an explicit type override', () => {
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault())

    render(
      <form onSubmit={onSubmit}>
        <SubmitButton
          type="button"
          idleLabel="Cancel"
          busyLabel="Cancelling…"
          onClick={() => undefined}
        />
      </form>,
    )

    expect(screen.getByRole('button', { name: /cancel/i })).toHaveAttribute('type', 'button')
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('forwards arbitrary button attributes and handlers', () => {
    const onClick = vi.fn()

    render(
      <SubmitButton
        idleLabel="Sign in"
        busyLabel="Signing in…"
        name="intent"
        value="login"
        data-testid="submit"
        onClick={onClick}
      />,
    )

    const button = screen.getByTestId('submit')
    expect(button).toHaveAttribute('name', 'intent')
    expect(button).toHaveAttribute('value', 'login')

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('keeps a custom className alongside the auth classes while busy', () => {
    render(
      <SubmitButton idleLabel="Sign in" busyLabel="Signing in…" className="extra-submit" busy />,
    )

    expect(screen.getByRole('button', { name: /signing in/i })).toHaveClass(
      'auth-button',
      'auth-button-primary',
      'auth-submit',
      'extra-submit',
    )
  })

  it('disables the button when busy is set even if disabled is explicitly false', () => {
    render(<SubmitButton idleLabel="Sign in" busyLabel="Signing in…" busy disabled={false} />)

    const button = screen.getByRole('button', { name: /signing in/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('omits aria-busy entirely while idle, including when disabled', () => {
    const { unmount } = render(
      <SubmitButton idleLabel="Sign in" busyLabel="Signing in…" disabled />,
    )
    expect(screen.getByRole('button', { name: /sign in/i })).not.toHaveAttribute('aria-busy')

    unmount()
    render(<SubmitButton idleLabel="Sign in" busyLabel="Signing in…" />)
    expect(screen.getByRole('button', { name: /sign in/i })).not.toHaveAttribute('aria-busy')
  })

  it('renders exactly one label and at most one decorative spinner', () => {
    render(<SubmitButton idleLabel="Sign in" busyLabel="Signing in…" busy />)

    expect(document.querySelectorAll('.auth-submit-label')).toHaveLength(1)
    const spinner = document.querySelector('.auth-submit-spinner')
    expect(spinner).toHaveAttribute('viewBox', '0 0 24 24')
    expect(spinner?.querySelectorAll('circle, path')).toHaveLength(2)
  })
})
