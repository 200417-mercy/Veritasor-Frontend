import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TermsOfServiceChangelogModal from './TermsOfServiceChangelogModal'

const baseProps = {
  currentVersion: 'v2.4.0',
  previousVersion: 'v2.3.0',
  effectiveDate: '2026-07-29',
  summary: 'We updated the terms to make policy changes easier to review.',
  changes: [
    {
      kind: 'Added' as const,
      title: 'Versioned changelog',
      detail: 'The modal now highlights policy diffs.',
    },
    {
      kind: 'Updated' as const,
      title: 'Retention language',
      detail: 'Retention timing is now stated directly.',
    },
    {
      kind: 'Removed' as const,
      title: 'Ambiguous wording',
      detail: 'Broad sharing language has been replaced with named disclosures.',
    },
  ],
  fullTextHref: '/legal/terms-of-service-v2-4-0.txt',
  pdfHref: '/legal/terms-of-service-v2-4-0.pdf',
}

describe('TermsOfServiceChangelogModal (Issue #598)', () => {
  describe('Primary State Transitions', () => {
    it('does not render when closed', () => {
      render(
        <TermsOfServiceChangelogModal open={false} onAcknowledge={vi.fn()} onClose={vi.fn()} {...baseProps} />
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows versioned diff content and requires acknowledgement', () => {
      const onAcknowledge = vi.fn()
      render(
        <TermsOfServiceChangelogModal open onAcknowledge={onAcknowledge} onClose={vi.fn()} {...baseProps} />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('v2.4.0')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /acknowledge and continue/i })).toBeDisabled()

      fireEvent.click(screen.getByLabelText(/i have reviewed version v2\.4\.0/i))
      fireEvent.click(screen.getByRole('button', { name: /acknowledge and continue/i }))

      expect(onAcknowledge).toHaveBeenCalledWith('v2.4.0')
    })

    it('closes on Escape', () => {
      const onClose = vi.fn()
      render(
        <TermsOfServiceChangelogModal open onAcknowledge={vi.fn()} onClose={onClose} {...baseProps} />
      )

      // Target document to match the component's event listener
      fireEvent.keyDown(document, { key: 'Escape' })
      
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Failure Contract & Boundary Behavior', () => {
    it('surfaces an observable error when version identifiers are missing', () => {
      render(
        <TermsOfServiceChangelogModal open onAcknowledge={vi.fn()} onClose={vi.fn()} {...baseProps} currentVersion="" />
      )
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Missing version identifiers')
    })

    it('surfaces an observable error when the TermsChange array is empty', () => {
      render(
        <TermsOfServiceChangelogModal open onAcknowledge={vi.fn()} onClose={vi.fn()} {...baseProps} changes={[]} />
      )
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('at least one TermsChange')
    })

    it('surfaces an observable error when a TermsChange entry is malformed', () => {
      const malformedChanges = [{ kind: 'Added' as const, title: '', detail: 'Missing title property' }]
      render(
        <TermsOfServiceChangelogModal open onAcknowledge={vi.fn()} onClose={vi.fn()} {...baseProps} changes={malformedChanges} />
      )
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Malformed TermsChange')
    })
  })
})