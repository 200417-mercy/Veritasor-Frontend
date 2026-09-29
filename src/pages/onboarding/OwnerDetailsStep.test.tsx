/**
 * Focused behavior coverage for `src/pages/onboarding/OwnerDetailsStep.tsx`.
 *
 * The onboarding step previously had no test fixture. These tests pin the
 * form's public behavior:
 *
 * - every field renders with the draft values supplied by the parent
 * - required-field validation is presence-based (whitespace-only is empty)
 * - errors appear on submit, then re-validate live once the form is "touched"
 * - a valid submit hands the collected `OwnerDetails` to `onNext`
 * - Back is a non-submitting control that invokes `onBack`
 * - error messaging is wired to inputs via `aria-describedby` + `role="alert"`
 *
 * @module src/pages/onboarding/OwnerDetailsStep.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OwnerDetailsStep from './OwnerDetailsStep';
import type { OwnerDetails } from '../../hooks/useOnboardingDraft';

const EMPTY: OwnerDetails = {
  fullName: '',
  dateOfBirth: '',
  nationality: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
};

const VALID: OwnerDetails = {
  fullName: 'Amina Adeyemi',
  dateOfBirth: '1990-05-17',
  nationality: 'Nigerian',
  addressLine1: '12 Victoria Island',
  addressLine2: 'Suite 4B',
  city: 'Lagos',
  postalCode: '100001',
};

const REQUIRED_MESSAGES = [
  'Full name is required',
  'Date of birth is required',
  'Nationality is required',
  'Address is required',
  'City is required',
  'Postal code is required',
];

function setup(data: OwnerDetails = EMPTY) {
  const onNext = vi.fn();
  const onBack = vi.fn();
  const utils = render(<OwnerDetailsStep data={data} onNext={onNext} onBack={onBack} />);
  return { ...utils, onNext, onBack };
}

const field = {
  fullName: () => screen.getByLabelText(/full legal name/i),
  dateOfBirth: () => screen.getByLabelText(/date of birth/i),
  nationality: () => screen.getByLabelText(/nationality/i),
  addressLine1: () => screen.getByLabelText(/address line 1/i),
  addressLine2: () => screen.getByLabelText(/address line 2/i),
  city: () => screen.getByLabelText(/^city$/i),
  postalCode: () => screen.getByLabelText(/postal code/i),
};

function continueButton() {
  return screen.getByRole('button', { name: /continue/i });
}

describe('OwnerDetailsStep - rendering', () => {
  it('pre-fills every input from the supplied draft', () => {
    setup(VALID);

    expect(field.fullName()).toHaveValue(VALID.fullName);
    expect(field.dateOfBirth()).toHaveValue(VALID.dateOfBirth);
    expect(field.nationality()).toHaveValue(VALID.nationality);
    expect(field.addressLine1()).toHaveValue(VALID.addressLine1);
    expect(field.addressLine2()).toHaveValue(VALID.addressLine2);
    expect(field.city()).toHaveValue(VALID.city);
    expect(field.postalCode()).toHaveValue(VALID.postalCode);
  });

  it('marks only the required inputs as required', () => {
    setup();

    for (const key of ['fullName', 'dateOfBirth', 'nationality', 'addressLine1', 'city', 'postalCode'] as const) {
      expect(field[key]()).toHaveAttribute('aria-required', 'true');
    }
    expect(field.addressLine2()).not.toHaveAttribute('aria-required');
  });

  it('shows no validation errors before the first submit attempt', () => {
    setup();

    for (const message of REQUIRED_MESSAGES) {
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    }
  });
});

describe('OwnerDetailsStep - validation on submit', () => {
  it('blocks an empty form, reports every required field, and does not advance', () => {
    const { onNext } = setup();

    fireEvent.click(continueButton());

    for (const message of REQUIRED_MESSAGES) {
      expect(screen.getByText(message)).toBeInTheDocument();
    }
    expect(onNext).not.toHaveBeenCalled();
  });

  it('treats whitespace-only values as missing', () => {
    const { onNext } = setup({ ...VALID, fullName: '   ', city: '\t' });

    fireEvent.click(continueButton());

    expect(screen.getByText('Full name is required')).toBeInTheDocument();
    expect(screen.getByText('City is required')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('blocks submit when a single required field is still empty', () => {
    const { onNext } = setup({ ...VALID, postalCode: '' });

    fireEvent.click(continueButton());

    expect(screen.getByText('Postal code is required')).toBeInTheDocument();
    expect(screen.queryByText('Full name is required')).not.toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('wires each error to its input with role="alert" and aria-describedby', () => {
    setup();

    fireEvent.click(continueButton());

    const fullName = field.fullName();
    expect(fullName).toHaveAttribute('aria-describedby', 'ob-full-name-err');
    expect(fullName).toHaveClass('ob-input-error');
    const alert = screen.getByText('Full name is required');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveAttribute('id', 'ob-full-name-err');
  });
});

describe('OwnerDetailsStep - valid submission', () => {
  it('advances with the collected owner details', () => {
    const { onNext } = setup(VALID);

    fireEvent.click(continueButton());

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith(VALID);
    expect(screen.queryByText('Full name is required')).not.toBeInTheDocument();
  });

  it('advances with edits made since mount', () => {
    const { onNext } = setup(VALID);
    fireEvent.change(field.city(), { target: { value: 'Abuja' } });
    fireEvent.change(field.nationality(), { target: { value: 'Kenyan' } });

    fireEvent.click(continueButton());

    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'Abuja', nationality: 'Kenyan' }),
    );
  });

  it('accepts an unparseable date of birth (presence-only validation boundary)', () => {
    const { onNext } = setup({ ...VALID, dateOfBirth: 'not-a-date' });

    fireEvent.click(continueButton());

    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ dateOfBirth: 'not-a-date' }));
  });

  it('allows an empty optional address line 2', () => {
    const { onNext } = setup({ ...VALID, addressLine2: '' });

    fireEvent.click(continueButton());

    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ addressLine2: '' }));
  });
});

describe('OwnerDetailsStep - live re-validation after a failed submit', () => {
  it('does not surface errors while typing before the first submit', () => {
    setup();

    fireEvent.change(field.fullName(), { target: { value: '   ' } });

    expect(screen.queryByText('Full name is required')).not.toBeInTheDocument();
  });

  it('clears an individual error as soon as the field is corrected', () => {
    setup();

    fireEvent.click(continueButton());
    expect(screen.getByText('Full name is required')).toBeInTheDocument();

    fireEvent.change(field.fullName(), { target: { value: 'Amina' } });

    expect(screen.queryByText('Full name is required')).not.toBeInTheDocument();
    // Unrelated errors remain until their own field is fixed.
    expect(screen.getByText('City is required')).toBeInTheDocument();
  });

  it('reintroduces an error when a previously valid field is emptied', () => {
    setup(VALID);

    fireEvent.click(continueButton());
    expect(screen.queryByText('City is required')).not.toBeInTheDocument();

    fireEvent.change(field.city(), { target: { value: '' } });

    expect(screen.getByText('City is required')).toBeInTheDocument();
  });

  it('recovers to a successful submit after all errors are fixed', () => {
    const { onNext } = setup();

    fireEvent.click(continueButton());
    expect(onNext).not.toHaveBeenCalled();

    for (const [key, value] of Object.entries(VALID) as Array<[keyof OwnerDetails, string]>) {
      fireEvent.change(field[key](), { target: { value } });
    }
    fireEvent.click(continueButton());

    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe('OwnerDetailsStep - navigation controls', () => {
  it('invokes onBack from the Back control without submitting', () => {
    const { onBack, onNext } = setup();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.queryByText('Full name is required')).not.toBeInTheDocument();
  });

  it('keeps Back as a non-submitting button type', () => {
    setup();

    expect(screen.getByRole('button', { name: /back/i })).toHaveAttribute('type', 'button');
    expect(continueButton()).toHaveAttribute('type', 'submit');
  });
});
