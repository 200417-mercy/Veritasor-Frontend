import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import BankDetailsStep from './BankDetailsStep'
import type { BankDetails } from '../../hooks/useOnboardingDraft'

const EMPTY_DETAILS: BankDetails = {
  bankName: '',
  accountNumber: '',
  ibanSwift: '',
  currency: '',
}

const VALID_DETAILS: BankDetails = {
  bankName: 'First Bank',
  accountNumber: '0123456789',
  ibanSwift: 'AAAABBCC',
  currency: 'NGN',
}

describe('BankDetailsStep', () => {
  it('renders the payout fields and navigation controls', () => {
    render(<BankDetailsStep data={EMPTY_DETAILS} onBack={vi.fn()} onNext={vi.fn()} />)

    expect(screen.getByRole('form', { name: /bank and payout details/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/account number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/settlement currency/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  it('shows deterministic validation errors and does not advance for empty input', () => {
    const onNext = vi.fn()
    render(<BankDetailsStep data={EMPTY_DETAILS} onBack={vi.fn()} onNext={onNext} />)

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(screen.getAllByRole('alert')).toHaveLength(4)
    expect(screen.getByText('Bank name is required')).toBeInTheDocument()
    expect(screen.getByText('Account number is required')).toBeInTheDocument()
    expect(screen.getByText('IBAN or SWIFT/BIC is required')).toBeInTheDocument()
    expect(screen.getByText('Currency is required')).toBeInTheDocument()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('updates fields and advances with valid details', () => {
    const onNext = vi.fn()
    render(<BankDetailsStep data={EMPTY_DETAILS} onBack={vi.fn()} onNext={onNext} />)

    fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: VALID_DETAILS.bankName } })
    fireEvent.change(screen.getByLabelText(/account number/i), { target: { value: VALID_DETAILS.accountNumber } })
    fireEvent.change(screen.getByLabelText(/iban \/ swift-bic/i), { target: { value: VALID_DETAILS.ibanSwift } })
    fireEvent.change(screen.getByLabelText(/settlement currency/i), { target: { value: VALID_DETAILS.currency } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(onNext).toHaveBeenCalledWith(VALID_DETAILS)
  })

  it('calls onBack without changing the submitted data', () => {
    const onBack = vi.fn()
    render(<BankDetailsStep data={VALID_DETAILS} onBack={onBack} onNext={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
