import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ToastItem from './ToastItem'
import type { Toast } from './ToastContext'

function makeToast(overrides: Partial<Toast> = {}): Toast {
  return { id: 't1', type: 'success', message: 'Saved successfully', ...overrides }
}

function renderToast(toast: Toast, onRemove = vi.fn()) {
  render(<ToastItem toast={toast} onRemove={onRemove} />)
  return onRemove
}

function progressWidth(container: HTMLElement): number {
  const bar = container.querySelector('.toast-progress-bar') as HTMLElement | null
  if (!bar) return -1
  return Number.parseFloat(bar.style.width)
}

describe('ToastItem - ToastAnimationState transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in the entering state and settles to idle after the entrance duration', () => {
    const { container } = render(<ToastItem toast={makeToast()} onRemove={vi.fn()} />)

    expect(container.firstChild).toHaveClass('toast-entering')

    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(container.firstChild).not.toHaveClass('toast-entering')
    expect(container.firstChild).not.toHaveClass('toast-exiting')
  })

  it('transitions idle → exiting → removed when closed', () => {
    const onRemove = vi.fn()
    const { container, unmount } = render(<ToastItem toast={makeToast()} onRemove={onRemove} />)

    act(() => {
      vi.advanceTimersByTime(350)
    })
    expect(container.firstChild).not.toHaveClass('toast-exiting')

    fireEvent.click(screen.getByRole('button', { name: /close notification/i }))
    expect(container.firstChild).toHaveClass('toast-exiting')
    expect(onRemove).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onRemove).toHaveBeenCalledWith('t1')
    unmount()
  })

  it('skips entering/exiting animation when disableMotion is set', () => {
    const onRemove = vi.fn()
    const { container } = render(
      <ToastItem toast={makeToast()} onRemove={onRemove} disableMotion />,
    )

    expect(container.firstChild).not.toHaveClass('toast-entering')
    expect(container.firstChild).not.toHaveClass('toast-exiting')

    fireEvent.click(screen.getByRole('button', { name: /close notification/i }))
    expect(onRemove).toHaveBeenCalledWith('t1')
  })
})

describe('ToastItem - auto-dismiss cadence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-dismisses a success toast after 5000ms', () => {
    const onRemove = renderToast(makeToast({ type: 'success' }))

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onRemove).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onRemove).toHaveBeenCalledWith('t1')
  })

  it('auto-dismisses an info toast after 5000ms', () => {
    const onRemove = renderToast(makeToast({ type: 'info', message: 'Heads up' }))

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onRemove).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onRemove).toHaveBeenCalledWith('t1')
  })

  it('persists error toasts (no auto-dismiss)', () => {
    const onRemove = renderToast(makeToast({ type: 'error', message: 'Failed' }))

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onRemove).not.toHaveBeenCalled()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('persists warning toasts (no auto-dismiss)', () => {
    const onRemove = renderToast(makeToast({ type: 'warning', message: 'Careful' }))

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onRemove).not.toHaveBeenCalled()
    expect(screen.getByText('Careful')).toBeInTheDocument()
  })

  it('extends the cadence by 3000ms when an undo action is present', () => {
    const onRemove = renderToast(
      makeToast({ type: 'success', onUndo: vi.fn() }),
    )

    act(() => {
      vi.advanceTimersByTime(5200)
    })
    expect(onRemove).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(onRemove).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onRemove).toHaveBeenCalledWith('t1')
  })

  it('honors an explicit duration override', () => {
    const onRemove = renderToast(makeToast({ type: 'success', duration: 1000 }))

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onRemove).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onRemove).toHaveBeenCalledWith('t1')
  })

  it('does not render a progress bar for persistent toasts', () => {
    const { container } = render(
      <ToastItem toast={makeToast({ type: 'error' })} onRemove={vi.fn()} />,
    )
    expect(container.querySelector('.toast-progress-bar')).toBeNull()
  })
})

describe('ToastItem - countdown and pause behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shrinks the progress bar as the countdown elapses', () => {
    const { container } = render(
      <ToastItem toast={makeToast({ type: 'success' })} onRemove={vi.fn()} />,
    )

    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(progressWidth(container)).toBeCloseTo(50, 0)

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(progressWidth(container)).toBeCloseTo(20, 0)
  })

  it('pauses the countdown on hover and resumes on leave', () => {
    const { container } = render(
      <ToastItem toast={makeToast({ type: 'success' })} onRemove={vi.fn()} />,
    )
    const toast = container.firstChild as HTMLElement

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    const widthAfterFirstTick = progressWidth(container)
    expect(widthAfterFirstTick).toBeLessThan(100)

    fireEvent.mouseEnter(toast)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(progressWidth(container)).toBeCloseTo(widthAfterFirstTick, 5)

    fireEvent.mouseLeave(toast)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(progressWidth(container)).toBeLessThan(widthAfterFirstTick)
  })

  it('pauses the countdown on focus and resumes on blur', () => {
    const { container } = render(
      <ToastItem toast={makeToast({ type: 'success' })} onRemove={vi.fn()} />,
    )
    const toast = container.firstChild as HTMLElement

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    const widthBeforePause = progressWidth(container)

    fireEvent.focus(toast)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(progressWidth(container)).toBeCloseTo(widthBeforePause, 5)

    fireEvent.blur(toast)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(progressWidth(container)).toBeLessThan(widthBeforePause)
  })
})

describe('ToastItem - removal interactions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('invokes onRemove exactly once when closed multiple times', () => {
    const onRemove = vi.fn()
    render(<ToastItem toast={makeToast()} onRemove={onRemove} />)

    const closeButton = screen.getByRole('button', { name: /close notification/i })
    fireEvent.click(closeButton)
    fireEvent.click(closeButton)
    fireEvent.click(closeButton)

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove).toHaveBeenCalledWith('t1')
  })

  it('invokes onUndo before removing the toast', () => {
    const onUndo = vi.fn()
    const onRemove = vi.fn()
    render(<ToastItem toast={makeToast({ onUndo })} onRemove={onRemove} />)

    fireEvent.click(screen.getByRole('button', { name: /^undo$/i }))
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onRemove).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onRemove).toHaveBeenCalledWith('t1')
  })

  it('uses a custom undo label when provided', () => {
    render(<ToastItem toast={makeToast({ onUndo: vi.fn(), undoLabel: 'Revert' })} onRemove={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^revert$/i })).toBeInTheDocument()
  })
})

describe('ToastItem - content, roles, and invalid input', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the message text', () => {
    render(<ToastItem toast={makeToast({ message: 'Profile updated' })} onRemove={vi.fn()} />)
    expect(screen.getByText('Profile updated')).toBeInTheDocument()
  })

  it('renders an item count suffix when count is provided', () => {
    render(<ToastItem toast={makeToast({ count: 5 })} onRemove={vi.fn()} />)
    expect(screen.getByText('(5 items)')).toBeInTheDocument()
  })

  it('omits the item count suffix when count is undefined', () => {
    render(<ToastItem toast={makeToast()} onRemove={vi.fn()} />)
    expect(screen.queryByText(/items\)/i)).not.toBeInTheDocument()
  })

  it('uses role="alert" for error toasts and role="status" otherwise', () => {
    const { rerender } = render(
      <ToastItem toast={makeToast({ type: 'error' })} onRemove={vi.fn()} />,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(<ToastItem toast={makeToast({ type: 'success' })} onRemove={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders a type-specific icon for each known toast type', () => {
    const { rerender } = render(
      <ToastItem toast={makeToast({ type: 'success' })} onRemove={vi.fn()} />,
    )
    expect(document.querySelector('.toast-icon-success')).toBeInTheDocument()

    rerender(<ToastItem toast={makeToast({ type: 'info' })} onRemove={vi.fn()} />)
    expect(document.querySelector('.toast-icon-info')).toBeInTheDocument()

    rerender(<ToastItem toast={makeToast({ type: 'warning' })} onRemove={vi.fn()} />)
    expect(document.querySelector('.toast-icon-warning')).toBeInTheDocument()

    rerender(<ToastItem toast={makeToast({ type: 'error' })} onRemove={vi.fn()} />)
    expect(document.querySelector('.toast-icon-error')).toBeInTheDocument()

    rerender(<ToastItem toast={makeToast({ type: 'bulk-undo' })} onRemove={vi.fn()} />)
    expect(document.querySelector('.toast-icon-bulk-undo')).toBeInTheDocument()
  })

  it('renders no icon for an unknown toast type', () => {
    const toast = makeToast({ type: 'mystery' as Toast['type'] })
    const { container } = render(<ToastItem toast={toast} onRemove={vi.fn()} />)
    expect(container.querySelector('.toast-icon-container svg')).toBeNull()
  })

  it('shows the (U) shortcut hint for bulk-undo toasts', () => {
    render(
      <ToastItem toast={makeToast({ type: 'bulk-undo', onUndo: vi.fn() })} onRemove={vi.fn()} />,
    )
    expect(screen.getByText('(U)')).toBeInTheDocument()
  })
})
