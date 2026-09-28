import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import BusinessDetailsStep from './BusinessDetailsStep'
import type { BusinessDetails } from '../../hooks/useOnboardingDraft'

const EMPTY: BusinessDetails = {
  legalName: '',
  registrationNumber: '',
  country: '',
  businessType: '',
  website: '',
}

const VALID: BusinessDetails = {
  legalName: 'Acme Corp Ltd.',
  registrationNumber: 'RC-1234567',
  country: 'Nigeria',
  businessType: 'LLC',
  website: '',
}

/** Entity options as rendered by the component (label -> input id). */
const ENTITY_TYPES = [
  { value: 'LLC', label: 'LLC', id: 'ob-biz-type-llc' },
  { value: 'Corporation', label: 'C-Corp', id: 'ob-biz-type-corporation' },
  { value: 'Sole Proprietorship', label: 'Sole Proprietorship', id: 'ob-biz-type-sole-proprietorship' },
  { value: 'Non-Profit', label: 'Nonprofit', id: 'ob-biz-type-non-profit' },
  { value: 'Partnership', label: 'Partnership', id: 'ob-biz-type-partnership' },
  { value: 'Other', label: 'Other', id: 'ob-biz-type-other' },
] as const

function renderStep(overrides: Partial<BusinessDetails> = {}) {
  const onNext = vi.fn()
  render(<BusinessDetailsStep data={{ ...EMPTY, ...overrides }} onNext={onNext} />)
  return { onNext }
}

const legalNameInput = () => screen.getByLabelText(/legal business name/i)
const registrationInput = () => screen.getByLabelText(/registration number/i)
const countryInput = () => screen.getByLabelText(/country of incorporation/i)
const websiteInput = () => screen.getByLabelText(/website/i)
const submit = () => screen.getByRole('button', { name: /continue/i })

function radioFor(value: string) {
  const meta = ENTITY_TYPES.find((entity) => entity.value === value)!
  return screen.getByRole('radio', { name: new RegExp(`^${meta.label}`) })
}

function fillRequired(overrides: Partial<BusinessDetails> = {}) {
  const values = { ...VALID, ...overrides }
  fireEvent.change(legalNameInput(), { target: { value: values.legalName } })
  fireEvent.change(registrationInput(), { target: { value: values.registrationNumber } })
  fireEvent.change(countryInput(), { target: { value: values.country } })
  fireEvent.change(websiteInput(), { target: { value: values.website } })
  fireEvent.click(radioFor(values.businessType))
  return values
}

describe('BusinessDetailsStep', () => {
  it('renders every field, the six entity options, and no errors on first paint', () => {
    renderStep()

    expect(screen.getByRole('form', { name: /business details/i })).toBeInTheDocument()
    expect(legalNameInput()).toHaveValue('')
    expect(registrationInput()).toHaveValue('')
    expect(countryInput()).toHaveValue('')
    expect(websiteInput()).toHaveValue('')

    expect(legalNameInput()).toHaveAttribute('aria-required', 'true')
    expect(registrationInput()).toHaveAttribute('aria-required', 'true')
    expect(countryInput()).toHaveAttribute('aria-required', 'true')
    expect(websiteInput()).not.toHaveAttribute('aria-required')

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(ENTITY_TYPES.length)
    radios.forEach((radio) => expect(radio).not.toBeChecked())

    ENTITY_TYPES.forEach((entity) => {
      const input = document.getElementById(entity.id) as HTMLInputElement | null
      expect(input).not.toBeNull()
      expect(input!.type).toBe('radio')
      expect(input!.value).toBe(entity.value)
    })

    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(screen.getByText(/include https:\/\//i)).toBeInTheDocument()
    expect(submit()).toBeEnabled()
  })

  it('blocks submission on an empty form and reports each required field', () => {
    const { onNext } = renderStep()

    fireEvent.click(submit())

    expect(onNext).not.toHaveBeenCalled()
    expect(screen.getByText('Legal name is required')).toBeInTheDocument()
    expect(screen.getByText('Registration number is required')).toBeInTheDocument()
    expect(screen.getByText('Country is required')).toBeInTheDocument()
    expect(screen.getByText('Business type is required')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(4)
  })

  it('does not surface validation errors before the first submit attempt', () => {
    renderStep()

    fireEvent.change(legalNameInput(), { target: { value: 'Acme' } })
    fireEvent.change(legalNameInput(), { target: { value: '' } })
    fireEvent.change(websiteInput(), { target: { value: 'not-a-url' } })

    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(legalNameInput()).not.toHaveClass('ob-input-error')
    expect(websiteInput()).not.toHaveClass('ob-input-error')
    expect(screen.getByText(/include https:\/\//i)).toBeInTheDocument()
  })

  it('re-validates after a failed submit and clears errors as fields are fixed', () => {
    const { onNext } = renderStep()

    fireEvent.click(submit())
    expect(screen.getAllByRole('alert')).toHaveLength(4)

    fireEvent.change(legalNameInput(), { target: { value: 'Acme' } })
    expect(screen.queryByText('Legal name is required')).not.toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(3)

    fireEvent.click(radioFor('LLC'))
    expect(screen.queryByText('Business type is required')).not.toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(2)

    fireEvent.change(registrationInput(), { target: { value: 'RC-1' } })
    fireEvent.change(countryInput(), { target: { value: 'Nigeria' } })

    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    // Fixing the fields must not auto-submit; the user still has to continue.
    expect(onNext).not.toHaveBeenCalled()
  })

  it('calls onNext once with the exact form values on a valid submit', () => {
    const { onNext } = renderStep()

    const values = fillRequired({ website: 'https://acmecorp.com' })
    fireEvent.click(submit())

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledWith(values)
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it('treats whitespace-only legal name and registration number as empty (boundary)', () => {
    const { onNext } = renderStep()

    fireEvent.change(legalNameInput(), { target: { value: '   ' } })
    fireEvent.change(registrationInput(), { target: { value: '\t' } })
    fireEvent.change(countryInput(), { target: { value: 'Nigeria' } })
    fireEvent.click(radioFor('Partnership'))
    fireEvent.click(submit())

    expect(onNext).not.toHaveBeenCalled()
    expect(screen.getByText('Legal name is required')).toBeInTheDocument()
    expect(screen.getByText('Registration number is required')).toBeInTheDocument()
    expect(screen.queryByText('Country is required')).not.toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })

  it('characterizes the country boundary as untrimmed whitespace passes', () => {
    // `validate` trims legalName/registrationNumber but applies a plain
    // truthiness check to country, so a whitespace-only country is accepted.
    // This test pins the current contract so any change to it is deliberate.
    const { onNext } = renderStep()

    fireEvent.change(legalNameInput(), { target: { value: 'Acme Corp Ltd.' } })
    fireEvent.change(registrationInput(), { target: { value: 'RC-1234567' } })
    fireEvent.change(countryInput(), { target: { value: '   ' } })
    fireEvent.click(radioFor('LLC'))
    fireEvent.click(submit())

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ country: '   ' }))
    expect(screen.queryByText('Country is required')).not.toBeInTheDocument()
  })

  it('requires a business type even when every text field is valid', () => {
    const { onNext } = renderStep()

    fireEvent.change(legalNameInput(), { target: { value: 'Acme' } })
    fireEvent.change(registrationInput(), { target: { value: 'RC-1' } })
    fireEvent.change(countryInput(), { target: { value: 'Nigeria' } })
    fireEvent.click(submit())

    expect(onNext).not.toHaveBeenCalled()
    expect(screen.getByText('Business type is required')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('allows the optional website to be left blank', () => {
    const { onNext } = renderStep()

    fillRequired()
    fireEvent.click(submit())

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ website: '' }))
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it.each([
    ['acmecorp.com'],
    ['www.acmecorp.com'],
    ['ftp://acmecorp.com'],
    ['https://'],
    ['http:/acmecorp.com'],
  ])('rejects website %s and blocks submission', (value) => {
    const { onNext } = renderStep()

    fillRequired({ website: value })
    fireEvent.click(submit())

    expect(onNext).not.toHaveBeenCalled()
    expect(screen.getByText(/valid URL starting with http/i)).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it.each([
    ['http://acmecorp.com'],
    ['https://acmecorp.com'],
    ['https://acmecorp.com/path?q=1#frag'],
  ])('accepts website %s and submits', (value) => {
    const { onNext } = renderStep()

    fillRequired({ website: value })
    fireEvent.click(submit())

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ website: value }))
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it('swaps the https hint for an alert on invalid input and restores it when fixed', () => {
    renderStep()
    expect(screen.getByText(/include https:\/\//i)).toBeInTheDocument()

    fillRequired({ website: 'not-a-url' })
    fireEvent.click(submit())

    expect(screen.queryByText(/include https:\/\//i)).not.toBeInTheDocument()
    expect(screen.getByText(/valid URL starting with http/i)).toHaveAttribute('id', 'ob-website-err')
    expect(websiteInput()).toHaveAttribute('aria-describedby', 'ob-website-err')

    fireEvent.change(websiteInput(), { target: { value: 'https://acmecorp.com' } })

    expect(screen.getByText(/include https:\/\//i)).toBeInTheDocument()
    expect(screen.queryByText(/valid URL starting with http/i)).not.toBeInTheDocument()
    expect(websiteInput()).toHaveAttribute('aria-describedby', 'ob-website-hint')
  })

  it('links each required error to its input and marks the input invalid', () => {
    renderStep()

    fireEvent.click(submit())

    const error = screen.getByText('Legal name is required')
    expect(error).toHaveAttribute('id', 'ob-legal-name-err')
    expect(error).toHaveAttribute('role', 'alert')
    expect(legalNameInput()).toHaveClass('ob-input-error')
    expect(legalNameInput()).toHaveAttribute('aria-describedby', 'ob-legal-name-err')

    fireEvent.change(legalNameInput(), { target: { value: 'Acme' } })

    expect(legalNameInput()).not.toHaveClass('ob-input-error')
    expect(legalNameInput()).not.toHaveAttribute('aria-describedby')
  })

  it('maps every entity option to a stable id/value and reflects one selection', () => {
    renderStep()

    ENTITY_TYPES.forEach((entity) => {
      const input = document.getElementById(entity.id) as HTMLInputElement
      expect(input).not.toBeNull()
      expect(input.name).toBe('ob-biz-type')
      expect(input.value).toBe(entity.value)
      expect(input).not.toBeChecked()
    })

    fireEvent.click(radioFor('Non-Profit'))

    expect(radioFor('Non-Profit')).toBeChecked()
    expect(radioFor('LLC')).not.toBeChecked()
    const checked = screen.getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked)
    expect(checked).toHaveLength(1)
  })

  it('prefills from the incoming draft and keeps it until submit', () => {
    const prefilled: BusinessDetails = {
      legalName: 'Existing Ltd',
      registrationNumber: 'RC-9',
      country: 'Kenya',
      businessType: 'Non-Profit',
      website: 'https://existing.example',
    }
    const { onNext } = renderStep(prefilled)

    expect(legalNameInput()).toHaveValue('Existing Ltd')
    expect(registrationInput()).toHaveValue('RC-9')
    expect(countryInput()).toHaveValue('Kenya')
    expect(websiteInput()).toHaveValue('https://existing.example')
    expect(radioFor('Non-Profit')).toBeChecked()
    expect(screen.queryAllByRole('alert')).toHaveLength(0)

    fireEvent.click(submit())

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledWith(prefilled)
  })

  it('keeps the text fields controlled as the user types', () => {
    renderStep()

    fireEvent.change(legalNameInput(), { target: { value: 'Acme' } })
    expect(legalNameInput()).toHaveValue('Acme')

    fireEvent.change(legalNameInput(), { target: { value: 'Acme Corp' } })
    expect(legalNameInput()).toHaveValue('Acme Corp')

    fireEvent.change(countryInput(), { target: { value: 'Ghana' } })
    expect(countryInput()).toHaveValue('Ghana')
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })
})
