import { Link } from 'react-router-dom'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  /** Max characters before a crumb label is truncated with an ellipsis. Default: 24 */
  maxLabelLength?: number
}

const ELLIPSIS = '…'
const DEFAULT_MAX_LABEL_LENGTH = 24

/**
 * Crumb labels arrive from route definitions and API payloads, so they are not
 * guaranteed to be strings at runtime. Coerce anything unusable to an empty
 * label so a single bad item cannot take down the whole navigation.
 */
function normalizeLabel(label: unknown): string {
  return typeof label === 'string' ? label : ''
}

function truncateLabel(label: string, max: number): { display: string; truncated: boolean } {
  // A limit below 1 cannot fit even the ellipsis on its own; clamping keeps the
  // slice bound positive. Slicing with a non-positive bound would return
  // "everything but the tail", which *lengthens* the label it is meant to shorten.
  const limit = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : DEFAULT_MAX_LABEL_LENGTH
  if (label.length <= limit) return { display: label, truncated: false }
  return { display: label.slice(0, limit - 1) + ELLIPSIS, truncated: true }
}

/** Resolve a crumb href against the current origin, or null when it is unparseable. */
function toAbsoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).href
  } catch {
    // A malformed href must not throw during render: the surrounding page
    // would unmount. The crumb still renders; only the JSON-LD item is dropped.
    return null
  }
}

/**
 * Serialize JSON-LD for inline injection. `</script>` inside a label would
 * otherwise close the script element as soon as the document is parsed, so
 * escape the characters HTML treats as markup. Consumers see identical strings
 * after `JSON.parse`.
 */
function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export default function Breadcrumb({ items, maxLabelLength = DEFAULT_MAX_LABEL_LENGTH }: BreadcrumbProps) {
  if (!items || items.length === 0) return null;

  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => {
      const listItem: Record<string, unknown> = {
        "@type": "ListItem",
        position: index + 1,
        name: normalizeLabel(item.label),
      }
      if (item.href) {
        const absolute = toAbsoluteUrl(item.href, base)
        if (absolute) listItem.item = absolute
      }
      return listItem
    })
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol className="breadcrumb-list" data-testid="breadcrumb-list">
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            const label = normalizeLabel(item.label)
            const { display, truncated } = truncateLabel(label, maxLabelLength)

            return (
              <li key={index} className="breadcrumb-item">
                {!isLast && item.href ? (
                  <Link
                    to={item.href}
                    className="breadcrumb-link"
                    title={truncated ? label : undefined}
                  >
                    {display}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className="breadcrumb-current"
                    title={truncated ? label : undefined}
                  >
                    {display}
                  </span>
                )}
                {!isLast && (
                  <span className="breadcrumb-separator" aria-hidden="true">/</span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </>
  )
}
