import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import JsonTreeViewer from '../components/webhooks/JsonTreeViewer'
import WebhookPayloadViewer, {
  SAMPLE_WEBHOOK_EVENTS,
  type WebhookEventSample,
} from '../components/webhooks/WebhookPayloadViewer'

// ─── SAMPLE_WEBHOOK_EVENTS (static data contract) ───────────────────────────

describe('SAMPLE_WEBHOOK_EVENTS', () => {
  it('contains three sample events', () => {
    expect(SAMPLE_WEBHOOK_EVENTS).toHaveLength(3)
  })

  it('covers the representative event types in order', () => {
    expect(SAMPLE_WEBHOOK_EVENTS.map((s) => s.event)).toEqual([
      'attestation.completed',
      'source.connected',
      'attestation.failed',
    ])
  })

  it('gives every sample a unique, stable id', () => {
    const ids = SAMPLE_WEBHOOK_EVENTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(['sample_01', 'sample_02', 'sample_03'])
  })

  it('gives every sample a non-empty description', () => {
    for (const sample of SAMPLE_WEBHOOK_EVENTS) {
      expect(typeof sample.description).toBe('string')
      expect(sample.description.length).toBeGreaterThan(0)
    }
  })

  it('gives every sample a serializable payload object', () => {
    for (const sample of SAMPLE_WEBHOOK_EVENTS) {
      expect(sample.payload).toBeTypeOf('object')
      expect(sample.payload).not.toBeNull()
      expect(() => JSON.stringify(sample.payload)).not.toThrow()
    }
  })

  it('satisfies the exported WebhookEventSample shape', () => {
    const maybe: unknown = SAMPLE_WEBHOOK_EVENTS[0]
    const sample = maybe as WebhookEventSample
    expect(typeof sample.id).toBe('string')
    expect(typeof sample.event).toBe('string')
    expect(typeof sample.description).toBe('string')
    expect(Object.keys(sample.payload).length).toBeGreaterThan(0)
  })
})

// ─── WebhookPayloadViewer (component behavior) ──────────────────────────────

function setupClipboardMock() {
  const writeText = vi.fn().mockImplementation(() => Promise.resolve())
  Object.assign(navigator, { clipboard: { writeText } })
  return writeText
}

describe('WebhookPayloadViewer', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    writeText = setupClipboardMock()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders heading, helper copy, and all controls', () => {
      render(<WebhookPayloadViewer />)
      expect(screen.getByText(/Webhook Payload Viewer/i)).toBeInTheDocument()
      expect(screen.getByText(/Inspect event JSON samples/i)).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: /select webhook event sample/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /copy full payload/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /download.*payload as file/i })).toBeInTheDocument()
    })

    it('renders the viewer container with an accessible label', () => {
      const { container } = render(<WebhookPayloadViewer />)
      expect(
        container.querySelector('.webhook-payload-viewer-container'),
      ).toHaveAttribute('aria-label', 'Webhook payload sample viewer')
    })

    it('populates the dropdown with all sample events', () => {
      render(<WebhookPayloadViewer />)
      const select = screen.getByRole('combobox', { name: /select webhook event sample/i })
      const options = within(select).getAllByRole('option')
      expect(options).toHaveLength(SAMPLE_WEBHOOK_EVENTS.length)
      expect(options.map((o) => o.textContent)).toEqual(
        SAMPLE_WEBHOOK_EVENTS.map((s) => s.event),
      )
    })

    it('selects the first sample by default and shows its description and tree title', () => {
      render(<WebhookPayloadViewer />)
      const select = screen.getByRole('combobox', { name: /select webhook event sample/i })
      expect(select).toHaveValue(SAMPLE_WEBHOOK_EVENTS[0].id)
      expect(screen.getByText(SAMPLE_WEBHOOK_EVENTS[0].description)).toBeInTheDocument()
      expect(
        screen.getByText(new RegExp(`Payload tree for ${SAMPLE_WEBHOOK_EVENTS[0].event}`, 'i')),
      ).toBeInTheDocument()
    })
  })

  describe('event selection state transition', () => {
    it('switches the description, tree title, and download link when another event is selected', () => {
      render(<WebhookPayloadViewer />)
      const select = screen.getByRole('combobox', { name: /select webhook event sample/i })
      fireEvent.change(select, { target: { value: SAMPLE_WEBHOOK_EVENTS[2].id } })

      expect(screen.getByText(SAMPLE_WEBHOOK_EVENTS[2].description)).toBeInTheDocument()
      expect(
        screen.getByText(new RegExp(`Payload tree for ${SAMPLE_WEBHOOK_EVENTS[2].event}`, 'i')),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('link', {
          name: `Download ${SAMPLE_WEBHOOK_EVENTS[2].event} payload as file`,
        }),
      ).toBeInTheDocument()
    })

    it('removes the previously active description when switching events', () => {
      render(<WebhookPayloadViewer />)
      const select = screen.getByRole('combobox', { name: /select webhook event sample/i })
      fireEvent.change(select, { target: { value: SAMPLE_WEBHOOK_EVENTS[1].id } })
      expect(screen.getByText(SAMPLE_WEBHOOK_EVENTS[1].description)).toBeInTheDocument()
      expect(screen.queryByText(SAMPLE_WEBHOOK_EVENTS[0].description)).not.toBeInTheDocument()
    })

    it('falls back to the first sample when the selection value is unknown', () => {
      render(<WebhookPayloadViewer />)
      const select = screen.getByRole('combobox', { name: /select webhook event sample/i })
      // Simulate an invalid/out-of-band selection value.
      fireEvent.change(select, { target: { value: 'does_not_exist' } })
      // activeSample falls back to SAMPLE_WEBHOOK_EVENTS[0] deterministically.
      expect(screen.getByText(SAMPLE_WEBHOOK_EVENTS[0].description)).toBeInTheDocument()
      expect(
        screen.getByRole('link', {
          name: `Download ${SAMPLE_WEBHOOK_EVENTS[0].event} payload as file`,
        }),
      ).toBeInTheDocument()
    })
  })

  describe('copy full payload state transition', () => {
    it('copies the serialized active payload to the clipboard', () => {
      render(<WebhookPayloadViewer />)
      fireEvent.click(screen.getByRole('button', { name: /copy full payload/i }))
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify(SAMPLE_WEBHOOK_EVENTS[0].payload, null, 2),
      )
    })

    it('shows the "Copied full JSON" confirmation, then reverts after 2 seconds', () => {
      render(<WebhookPayloadViewer />)
      const copyBtn = screen.getByRole('button', { name: /copy full payload/i })
      fireEvent.click(copyBtn)
      expect(screen.getByText(/✓ Copied full JSON/i)).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      // The label reverts and the confirmation disappears deterministically.
      expect(screen.queryByText(/✓ Copied full JSON/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /copy full payload/i })).toHaveTextContent(
        /Copy full JSON/i,
      )
    })

    it('copies the newly selected sample after an event change', () => {
      render(<WebhookPayloadViewer />)
      const select = screen.getByRole('combobox', { name: /select webhook event sample/i })
      fireEvent.change(select, { target: { value: SAMPLE_WEBHOOK_EVENTS[2].id } })
      fireEvent.click(screen.getByRole('button', { name: /copy full payload/i }))
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify(SAMPLE_WEBHOOK_EVENTS[2].payload, null, 2),
      )
    })
  })

  describe('download link', () => {
    it('builds the download filename from the active event name with dots replaced', () => {
      render(<WebhookPayloadViewer />)
      const link = screen.getByRole('link', { name: /download.*payload as file/i })
      expect(link).toHaveAttribute(
        'download',
        `${SAMPLE_WEBHOOK_EVENTS[0].event.replace(/\./g, '_')}_payload.json`,
      )
    })

    it('embeds the active payload as a data URL for download', () => {
      render(<WebhookPayloadViewer />)
      const link = screen.getByRole('link', { name: /download.*payload as file/i })
      const href = link.getAttribute('href') ?? ''
      expect(href.startsWith('data:application/json;charset=utf-8,')).toBe(true)
      const decoded = decodeURIComponent(href.split(',')[1] ?? '')
      expect(JSON.parse(decoded)).toEqual(SAMPLE_WEBHOOK_EVENTS[0].payload)
    })

    it('updates filename and data URL after switching events', () => {
      render(<WebhookPayloadViewer />)
      const select = screen.getByRole('combobox', { name: /select webhook event sample/i })
      fireEvent.change(select, { target: { value: SAMPLE_WEBHOOK_EVENTS[2].id } })
      const link = screen.getByRole('link', {
        name: `Download ${SAMPLE_WEBHOOK_EVENTS[2].event} payload as file`,
      })
      expect(link).toHaveAttribute(
        'download',
        `${SAMPLE_WEBHOOK_EVENTS[2].event.replace(/\./g, '_')}_payload.json`,
      )
      const href = link.getAttribute('href') ?? ''
      expect(JSON.parse(decodeURIComponent(href.split(',')[1] ?? ''))).toEqual(
        SAMPLE_WEBHOOK_EVENTS[2].payload,
      )
    })
  })

  describe('tree depth state transitions', () => {
    it('collapses to root level: deep keys become hidden and root shows item count', () => {
      render(<WebhookPayloadViewer />)
      const select = screen.getByRole('combobox', { name: /select webhook event sample/i })
      fireEvent.change(select, { target: { value: SAMPLE_WEBHOOK_EVENTS[1].id } })

      fireEvent.click(screen.getByRole('button', { name: /collapse tree to root level/i }))
      // The depth-1 "data" node (6 keys) and "metadata" node (2 keys) are collapsed summaries.
      const dataToggle = screen.getByRole('button', { name: /expand node "data" \(6 keys\)/i })
      expect(dataToggle).toHaveAttribute('aria-expanded', 'false')
      const metadataToggle = screen.getByRole('button', {
        name: /expand node "metadata" \(2 keys\)/i,
      })
      expect(metadataToggle).toHaveAttribute('aria-expanded', 'false')
      // A depth-2 key ("scopes") that is visible when expanded is gone.
      expect(screen.queryByText(/"scopes":/i)).not.toBeInTheDocument()
    })

    it('expands all levels so deep leaves become visible', () => {
      render(<WebhookPayloadViewer />)
      const select = screen.getByRole('combobox', { name: /select webhook event sample/i })
      fireEvent.change(select, { target: { value: SAMPLE_WEBHOOK_EVENTS[1].id } })

      fireEvent.click(screen.getByRole('button', { name: /expand all tree levels/i }))
      // "scopes" lives at depth 2 inside data; it must now be rendered.
      expect(screen.getByText(/"scopes":/i)).toBeInTheDocument()
      // Deep array leaves are visible too.
      expect(screen.getByText(/read:charges/i)).toBeInTheDocument()
    })

    it('remounts the tree with a fresh expanded state when depth changes (key-based reset)', () => {
      render(<WebhookPayloadViewer />)
      const select = screen.getByRole('combobox', { name: /select webhook event sample/i })
      fireEvent.change(select, { target: { value: SAMPLE_WEBHOOK_EVENTS[1].id } })

      // Expand All first, then Collapse All: the tree is remounted via key change,
      // so "scopes" disappears again deterministically.
      fireEvent.click(screen.getByRole('button', { name: /expand all tree levels/i }))
      expect(screen.getByText(/"scopes":/i)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /collapse tree to root level/i }))
      expect(screen.queryByText(/"scopes":/i)).not.toBeInTheDocument()
    })
  })
})

// ─── JsonTreeViewer (child contract used by the viewer) ─────────────────────

describe('JsonTreeViewer child contract', () => {
  it('renders the title in a polite live region', () => {
    render(<JsonTreeViewer data={{ a: 1 }} title="Payload tree for attestation.completed" />)
    expect(screen.getByText(/Payload tree for attestation\.completed loaded/i)).toBeInTheDocument()
  })

  it('shows primitives, nested objects, and arrays', () => {
    render(
      <JsonTreeViewer
        data={{ status: 'active', attempts: 3, recoverable: true, tags: ['x', 'y'] }}
        defaultExpandedDepth={3}
      />,
    )
    expect(screen.getByText(/"status":/i)).toBeInTheDocument()
    expect(screen.getByText(/"attempts":/i)).toBeInTheDocument()
    expect(screen.getByText(/"tags":/i)).toBeInTheDocument()
  })

  it('respects defaultExpandedDepth boundaries on the root node', () => {
    render(<JsonTreeViewer data={{ nested: { a: 1 } }} defaultExpandedDepth={1} />)
    // Root (depth 0) is within defaultExpandedDepth=1, so it renders expanded.
    const toggle = screen.getByRole('button', { name: /json object \(1 keys\)/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
