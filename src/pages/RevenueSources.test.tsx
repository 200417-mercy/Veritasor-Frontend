import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from '../components/ToastContext'
import RevenueSources from './RevenueSources'

function ToastActions() {
  const { toasts } = useToast()
  return (
    <div>
      {toasts.map((toast) => toast.onUndo && (
        <button key={toast.id} type="button" onClick={toast.onUndo}>
          Undo {toast.message}
        </button>
      ))}
    </div>
  )
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <RevenueSources />
        <ToastActions />
      </ToastProvider>
    </MemoryRouter>,
  )
}

function sourcesList() {
  return screen.getByRole('list', { name: 'Connected revenue sources' })
}

function openDisconnect(provider: string) {
  fireEvent.click(within(sourcesList()).getByRole('button', { name: `Disconnect ${provider}` }))
  return screen.getByRole('dialog', { name: `Disconnect ${provider}?` })
}

afterEach(() => vi.useRealTimers())

describe('RevenueSources page behavior', () => {
  it('shows connected sources and the two reconnect reminders', () => {
    renderPage()

    expect(within(sourcesList()).getAllByRole('listitem')).toHaveLength(3)
    const reminders = screen.getByRole('list', { name: 'Expired integrations' })
    expect(within(reminders).getByText('Shopify')).toBeInTheDocument()
    expect(within(reminders).getByText('QuickBooks')).toBeInTheDocument()
    expect(within(reminders).queryByText('Stripe')).not.toBeInTheDocument()
  })

  it.each(['stripe', 'Stripe ', 'Stri'])('rejects an inexact disconnect name: %s', (name) => {
    renderPage()
    const dialog = openDisconnect('Stripe')
    const confirm = within(dialog).getByRole('button', { name: 'Disconnect Stripe' })

    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: name } })

    expect(confirm).toBeDisabled()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Name does not match')
    expect(within(sourcesList()).getByRole('listitem', { name: /Stripe, priority 1 of 3/ })).toBeInTheDocument()
  })

  it('clears the mismatch error when the confirmation input is emptied', () => {
    renderPage()
    const dialog = openDisconnect('Stripe')
    const input = within(dialog).getByRole('textbox')

    fireEvent.change(input, { target: { value: 'wrong' } })
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '' } })

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Disconnect Stripe' })).toBeDisabled()
  })

  it('cancel preserves the source after invalid input', () => {
    renderPage()
    const dialog = openDisconnect('Stripe')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'wrong' } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(sourcesList()).getByRole('listitem', { name: /Stripe, priority 1 of 3/ })).toBeInTheDocument()
  })

  it('disconnects only after an exact match and restores the source on Undo', () => {
    renderPage()
    const dialog = openDisconnect('Stripe')
    const confirm = within(dialog).getByRole('button', { name: 'Disconnect Stripe' })
    expect(confirm).toBeDisabled()

    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Stripe' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(sourcesList()).queryByRole('listitem', { name: /Stripe,/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo Disconnected Stripe' }))
    expect(within(sourcesList()).getAllByRole('listitem')).toHaveLength(3)
    expect(within(sourcesList()).getByRole('listitem', { name: /Stripe,/ })).toBeInTheDocument()
  })

  it('reconnects the chosen source from its reminder without changing the other', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect Shopify now' }))

    const reminders = screen.getByRole('list', { name: 'Expired integrations' })
    expect(within(reminders).queryByText('Shopify')).not.toBeInTheDocument()
    expect(within(reminders).getByText('QuickBooks')).toBeInTheDocument()
    expect(within(sourcesList()).getByRole('listitem', { name: /Shopify,/ })).toHaveTextContent('Healthy')
    expect(within(sourcesList()).getByRole('listitem', { name: /QuickBooks,/ })).toHaveTextContent('Error')
  })

  it('dismisses one reminder and shows it again after the configured interval', () => {
    vi.useFakeTimers()
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss reconnect reminder for Shopify' }))

    expect(screen.queryByRole('button', { name: 'Reconnect Shopify now' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reconnect QuickBooks now' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(29_999))
    expect(screen.queryByRole('button', { name: 'Reconnect Shopify now' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('button', { name: 'Reconnect Shopify now' })).toBeInTheDocument()
  })
})
