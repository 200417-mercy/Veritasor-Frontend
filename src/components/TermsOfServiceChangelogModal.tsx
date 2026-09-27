import { useEffect, useId, useRef, useState } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function formatDate(dateIso: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${dateIso}T00:00:00`))
}

export interface TermsChange {
  kind: 'Added' | 'Updated' | 'Removed'
  title: string
  detail: string
}

export interface TermsOfServiceChangelogModalProps {
  open: boolean
  currentVersion: string
  previousVersion: string
  effectiveDate: string
  summary: string
  changes: TermsChange[]
  fullTextHref: string
  pdfHref: string
  onAcknowledge: (version: string) => void
  onClose: () => void
}

export default function TermsOfServiceChangelogModal({
  open,
  currentVersion,
  previousVersion,
  effectiveDate,
  summary,
  changes,
  fullTextHref,
  pdfHref,
  onAcknowledge,
  onClose,
}: TermsOfServiceChangelogModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descId = useId()
  const summaryId = useId()
  const acknowledgeId = useId()
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement
      setAcknowledged(false)
      dialogRef.current?.focus()
    } else {
      triggerRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) || [])
      if (focusable.length === 0) return

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
  }, [open, onClose])

  function handleBackdropClick() {
    onClose()
  }

  function handleAcknowledge() {
    if (!acknowledged) return
    onAcknowledge(currentVersion)
  }

  if (!open) return null

  // Failure Contract: Enforce valid changelog data deterministically to prevent silent runtime crashes
  if (!currentVersion || !previousVersion) {
    return <div role="alert" className="modal-backdrop" style={{ padding: '2rem', color: 'var(--danger)', background: 'var(--surface-strong)' }}>Configuration Error: Missing version identifiers.</div>
  }
  if (!changes || changes.length === 0) {
    return <div role="alert" className="modal-backdrop" style={{ padding: '2rem', color: 'var(--danger)', background: 'var(--surface-strong)' }}>Configuration Error: Changelog must contain at least one TermsChange.</div>
  }
  const hasMalformedChange = changes.some(c => !c.kind || !c.title || !c.detail)
  if (hasMalformedChange) {
    return <div role="alert" className="modal-backdrop" style={{ padding: '2rem', color: 'var(--danger)', background: 'var(--surface-strong)' }}>Configuration Error: Malformed TermsChange entry detected.</div>
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${descId} ${summaryId}`}
        className="modal-dialog tos-dialog"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="tos-header-copy">
            <p className="tos-eyebrow">Terms update</p>
            <h2 id={titleId} className="modal-title">
              Review the latest terms change log
            </h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close dialog" onClick={onClose}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="modal-body tos-body">
          <p id={descId} className="modal-description">
            {summary}
          </p>

          <div className="tos-version-strip" aria-label="Terms version summary">
            <span className="tos-version-pill tos-version-pill-current">{currentVersion}</span>
            <span className="tos-version-arrow" aria-hidden="true">
              →
            </span>
            <span className="tos-version-pill">{previousVersion}</span>
            <span className="tos-effective-date">
              Effective <time dateTime={effectiveDate}>{formatDate(effectiveDate)}</time>
            </span>
          </div>

          <section className="tos-downloads" aria-labelledby={summaryId}>
            <div className="tos-section-header">
              <h3 id={summaryId} className="tos-section-title">
                Download the complete policy
              </h3>
              <p className="tos-section-copy">
                Keep the full text for your records or share it with legal, compliance, or procurement.
              </p>
            </div>
            <div className="tos-download-links">
              <a href={fullTextHref} className="tos-download-link" download>
                Download full text
              </a>
              <a href={pdfHref} className="tos-download-link" download>
                Download PDF
              </a>
            </div>
          </section>

          <section className="tos-diff" aria-labelledby="tos-diff-title">
            <div className="tos-section-header">
              <h3 id="tos-diff-title" className="tos-section-title">
                What changed in this release
              </h3>
              <p className="tos-section-copy">
                The summary below highlights the most review-worthy additions, clarifications, and removals.
              </p>
            </div>

            <ul className="tos-change-list">
              {changes.map((change) => (
                <li key={`${change.kind}-${change.title}`} className="tos-change-card">
                  <div className={`tos-change-kind tos-change-kind-${change.kind.toLowerCase()}`}>
                    {change.kind}
                  </div>
                  <h4 className="tos-change-title">{change.title}</h4>
                  <p className="tos-change-detail">{change.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <label className="tos-acknowledge" htmlFor={acknowledgeId}>
            <input
              id={acknowledgeId}
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>
              I have reviewed version {currentVersion} and understand it applies before I can continue.
            </span>
          </label>
        </div>

        <div className="modal-footer tos-footer">
          <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn modal-btn-confirm tos-confirm"
            onClick={handleAcknowledge}
            disabled={!acknowledged}
            aria-busy={false}
          >
            Acknowledge and continue
          </button>
        </div>
      </div>
    </div>
  )
}