/**
 * RevokeKeyDialog
 *
 * Shows a modal that lets the user confirm revoking an API key. Before they can
 * confirm, they must:
 *   1. Review a list of dependent integrations detected in the last 30 days
 *   2. Type the key's label exactly to confirm awareness of the impact
 *
 * Accessibility: WCAG 2.1 AA
 *   - role="dialog" with aria-modal, aria-labelledby, aria-describedby
 *   - Focus is trapped within the modal (reuses the same pattern as ConfirmDialog)
 *   - Confirm button is disabled until the label is typed correctly
 *   - Destructive CTA hierarchy: destructive red confirm, neutral cancel
 *   - Screen reader announces dynamic validation state via aria-live
 *   - Min 44 × 44 px touch targets on all interactive elements
 *   - High-contrast focus rings via :focus-visible
 *
 * Design-system notes
 *   - Usage list mirrors the scope badge / audit-log row patterns
 *   - Unknown-usage state is explicit – never implies zero if data is unavailable
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { ApiKey, DependentUsage } from './apiKeyTypes'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface Props {
  open: boolean
  keyItem: ApiKey
  /**
   * Dependent usages detected in the last 30 days.
   * Pass `null` to indicate that usage data could not be determined.
   */
  dependentUsages: DependentUsage[] | null
  isLoading?: boolean
  onClose: () => void
  onConfirm: () => void
}

function formatLastSeen(isoDate: string): string {
  const date = new Date(isoDate)
  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
}

export default function RevokeKeyDialog({ open, keyItem, dependentUsages, isLoading = false, onClose, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmInput, setConfirmInput] = useState('')
  const errorId = useId()
  const descId = useId()
  const titleId = useId()

  const isConfirmValid = confirmInput.trim() === keyItem.label.trim()

  // Capture trigger and focus dialog on open
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement
      // Small delay to ensure dialog is rendered
      const t = window.setTimeout(() => dialogRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    } else {
      setConfirmInput('')
      triggerRef.current?.focus()
    }
  }, [open])

  // Focus trap + Escape handling
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!isLoading) onClose()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = Array.from(dialogRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, isLoading])

  if (!open) return null

  const hasUsage = dependentUsages !== null && dependentUsages.length > 0
  const usageUnknown = dependentUsages === null
  const noUsage = dependentUsages !== null && dependentUsages.length === 0

  return (
    <div
      className="modal-backdrop"
      onClick={() => { if (!isLoading) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="modal-dialog"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '30rem' }}
      >
        {/* Header */}
        <div className="modal-header">
          <h2 id={titleId} className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span aria-hidden="true" style={{ color: 'var(--danger)' }}>⚠</span>
            Revoke API key?
          </h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={isLoading}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
          <p id={descId} className="modal-description" style={{ marginBottom: 0 }}>
            Revoking <strong>{keyItem.label}</strong> immediately and permanently invalidates this key.
            Any system using it will stop working. This action cannot be undone.
          </p>

          {/* Dependent usage section */}
          <section aria-label="Dependent integrations">
            <h3
              style={{
                margin: '0 0 0.5rem',
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                color: 'var(--text)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Detected integrations (last 30 days)
            </h3>

            {usageUnknown && (
              <div
                role="note"
                style={{
                  padding: '0.75rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--warning-soft)',
                  border: '1px solid rgba(251,191,36,0.35)',
                  color: 'var(--warning)',
                  fontSize: 'var(--text-sm)',
                  lineHeight: 'var(--leading-relaxed)',
                }}
              >
                <strong>Usage data unavailable.</strong> We couldn't determine which integrations are
                currently using this key. Proceed with caution.
              </div>
            )}

            {noUsage && (
              <div
                style={{
                  padding: '0.75rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-soft)',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                No integrations detected in the last 30 days.
              </div>
            )}

            {hasUsage && (
              <ul
                aria-label={`${dependentUsages!.length} dependent integration${dependentUsages!.length === 1 ? '' : 's'}`}
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: '0.4rem',
                }}
              >
                {dependentUsages!.map((usage, i) => (
                  <li
                    key={`${usage.name}-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      padding: '0.55rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--danger-soft)',
                      border: '1px solid rgba(251,113,133,0.25)',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 'var(--text-sm)' }}>
                      {usage.name}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--muted)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Last seen: <time dateTime={usage.lastSeenAt}>{formatLastSeen(usage.lastSeenAt)}</time>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Typed confirmation */}
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <label
              htmlFor="revoke-confirm-input"
              style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text)' }}
            >
              Type <strong>{keyItem.label}</strong> to confirm
            </label>
            <input
              id="revoke-confirm-input"
              ref={inputRef}
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="auth-input"
              autoComplete="off"
              aria-describedby={errorId}
              aria-invalid={confirmInput.length > 0 && !isConfirmValid}
              placeholder={keyItem.label}
            />
            <div
              id={errorId}
              role="status"
              aria-live="polite"
              style={{
                fontSize: 'var(--text-xs)',
                color: confirmInput.length > 0 && !isConfirmValid ? 'var(--danger)' : 'var(--muted)',
                minHeight: '1.2em',
              }}
            >
              {confirmInput.length > 0 && !isConfirmValid
                ? 'Key name does not match.'
                : isConfirmValid
                ? '✓ Confirmed'
                : ''}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="modal-btn modal-btn-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn modal-btn-confirm"
            onClick={onConfirm}
            disabled={!isConfirmValid || isLoading}
            aria-busy={isLoading}
            aria-disabled={!isConfirmValid}
            style={isConfirmValid ? {
              color: '#04111f',
              background: 'linear-gradient(135deg, rgba(251,113,133,1), #fb7185)',
              borderColor: 'transparent',
              opacity: isLoading ? 0.7 : 1,
            } : {
              opacity: 0.45,
              cursor: 'not-allowed',
            }}
          >
            {isLoading ? 'Revoking…' : 'Revoke key'}
          </button>
        </div>
      </div>
    </div>
  )
}
