import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, act } from '@testing-library/react'
import HelpArticleFeedback from './HelpArticleFeedback'

function renderComponent(props = {}) {
  return render(<HelpArticleFeedback {...props} />)
}

describe('HelpArticleFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('renders the heading', () => {
    renderComponent()
    expect(screen.getByText('Was this helpful?')).toBeInTheDocument()
  })

  it('renders both thumbs buttons', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /this article was helpful/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /this article was not helpful/i })).toBeInTheDocument()
  })

  it('sets rating to up when helpful button is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    expect(screen.getByRole('button', { name: /this article was helpful/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sets rating to down when not helpful button is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    expect(screen.getByRole('button', { name: /this article was not helpful/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows textarea when down is selected', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    expect(screen.getByLabelText(/any additional thoughts/i)).toBeInTheDocument()
    expect(screen.getByText('(optional)')).toBeInTheDocument()
  })

  it('does not show textarea when up is selected', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    expect(screen.queryByLabelText(/any additional thoughts/i)).not.toBeInTheDocument()
  })

  it('shows submit button after rating is selected', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeInTheDocument()
  })

  it('does not show submit button before rating is selected', () => {
    renderComponent()
    expect(screen.queryByRole('button', { name: /submit feedback/i })).not.toBeInTheDocument()
  })

  it('calls onSubmit with rating up and empty comment', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(onSubmit).toHaveBeenCalledWith('up', '')
  })

  it('calls onSubmit with rating down and comment', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    fireEvent.change(screen.getByLabelText(/any additional thoughts/i), { target: { value: 'Too long' } })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(onSubmit).toHaveBeenCalledWith('down', 'Too long')
  })

  it('shows thanks confirmation after submit', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(screen.getByText('Thanks for your feedback!')).toBeInTheDocument()
  })

  it('has status region after submit', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows reset button after submit', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(screen.getByRole('button', { name: /submit different feedback/i })).toBeInTheDocument()
  })

  it('resets form when reset button is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    fireEvent.change(screen.getByLabelText(/any additional thoughts/i), { target: { value: 'Too long' } })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit different feedback/i }))
    expect(screen.getByText('Was this helpful?')).toBeInTheDocument()
    expect(screen.queryByLabelText(/any additional thoughts/i)).not.toBeInTheDocument()
  })

  it('shows rate limit error when submitting too quickly', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    act(() => {
      vi.advanceTimersByTime(0)
    })
    fireEvent.click(screen.getByRole('button', { name: /submit different feedback/i }))
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('shows character limit error for comments over 500 chars', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    const textarea = screen.getByLabelText(/any additional thoughts/i)
    fireEvent.change(textarea, { target: { value: 'a'.repeat(501) } })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows character count in hint', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    const textarea = screen.getByLabelText(/any additional thoughts/i)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    expect(screen.getByText('5/500 characters')).toBeInTheDocument()
  })

  it('has proper ARIA attributes on buttons initially', () => {
    renderComponent()
    const upBtn = screen.getByRole('button', { name: /this article was helpful/i })
    const downBtn = screen.getByRole('button', { name: /this article was not helpful/i })
    expect(upBtn).toHaveAttribute('aria-pressed', 'false')
    expect(downBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('disables rating buttons after submit', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    expect(screen.getByRole('button', { name: /this article was helpful/i })).not.toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(screen.queryByRole('button', { name: /this article was helpful/i })).not.toBeInTheDocument()
  })

  it('applies articleId as data attribute', () => {
    renderComponent({ articleId: 'test-article' })
    const section = document.querySelector('[data-article-id]')
    expect(section).toHaveAttribute('data-article-id', 'test-article')
  })

  it('renders with default articleId', () => {
    renderComponent()
    const section = document.querySelector('[data-article-id]')
    expect(section).toHaveAttribute('data-article-id', 'help-article')
  })

  it('focuses textarea when down is selected', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    expect(screen.getByLabelText(/any additional thoughts/i)).toHaveFocus()
  })

  it('renders a form element', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    expect(document.querySelector('form.help-feedback-form')).toBeInTheDocument()
  })

  it('has grouped rating buttons with correct aria-label', () => {
    renderComponent()
    const group = screen.getByRole('group', { name: /rate this article/i })
    expect(group).toBeInTheDocument()
  })
})
// ════════════════════════════════════════════════════════════════════
//  FeedbackRating boundary + invalid-input coverage
//
//  The suite above exercises the happy path and a single over-limit
//  comment. These tests pin the boundaries the component actually
//  implements: the 500-char threshold (500 allowed / 501 rejected), the
//  60 s rate-limit window edge, whitespace-only comments, trimming,
//  error clearing, article-id overrides, and the nullable
//  `FeedbackRating` state machine.
// ════════════════════════════════════════════════════════════════════
describe('HelpArticleFeedback — FeedbackRating boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts a comment of exactly 500 characters', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    fireEvent.change(screen.getByLabelText(/any additional thoughts/i), {
      target: { value: 'a'.repeat(500) },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toBe('down')
    expect((onSubmit.mock.calls[0][1] as string).length).toBe(500)
    expect(screen.getByText('Thanks for your feedback!')).toBeInTheDocument()
  })

  it('rejects a comment of 501 characters and does not call onSubmit', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    fireEvent.change(screen.getByLabelText(/any additional thoughts/i), {
      target: { value: 'a'.repeat(501) },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/500 characters or fewer/i)
  })

  it('treats a whitespace-only comment as an empty submission', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    fireEvent.change(screen.getByLabelText(/any additional thoughts/i), {
      target: { value: '     ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    expect(onSubmit).toHaveBeenCalledWith('down', '')
  })

  it('trims surrounding whitespace from the submitted comment', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    fireEvent.change(screen.getByLabelText(/any additional thoughts/i), {
      target: { value: '  needs work  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    expect(onSubmit).toHaveBeenCalledWith('down', 'needs work')
  })

  it('allows a second submission once exactly 60s has elapsed', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })

    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit different feedback/i }))

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rejects a second submission at 59 999ms (just under the window)', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })

    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit different feedback/i }))

    act(() => {
      vi.advanceTimersByTime(59_999)
    })

    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent(/please wait/i)
  })

  it('clears the comment error as soon as the text is edited', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    const textarea = screen.getByLabelText(/any additional thoughts/i)

    fireEvent.change(textarea, { target: { value: 'a'.repeat(501) } })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: 'shorter now' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears the rate-limit error when the rating is clicked again', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })

    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit different feedback/i }))
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('switching from down to up hides the textarea but keeps the typed comment', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })

    fireEvent.click(screen.getByRole('button', { name: /this article was not helpful/i }))
    fireEvent.change(screen.getByLabelText(/any additional thoughts/i), {
      target: { value: 'kept text' },
    })
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    expect(screen.queryByLabelText(/any additional thoughts/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    // The comment state is not cleared by re-rating; only `reset()` clears it.
    expect(onSubmit).toHaveBeenCalledWith('up', 'kept text')
  })

  it('honours an explicitly empty articleId instead of applying the default', () => {
    renderComponent({ articleId: '' })
    const section = document.querySelector('[data-article-id]')
    expect(section).toHaveAttribute('data-article-id', '')
  })

  it('submits successfully when no onSubmit callback is supplied', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(screen.getByText('Thanks for your feedback!')).toBeInTheDocument()
  })

  it('moves focus to the status region after submit', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(screen.getByRole('status')).toHaveFocus()
  })

  it('restores the rating buttons and clears the chosen rating after reset', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /this article was helpful/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit different feedback/i }))

    const upBtn = screen.getByRole('button', { name: /this article was helpful/i })
    const downBtn = screen.getByRole('button', { name: /this article was not helpful/i })
    expect(upBtn).toHaveAttribute('aria-pressed', 'false')
    expect(downBtn).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: /submit feedback/i })).not.toBeInTheDocument()
  })

  it('does not submit while no rating is selected (null FeedbackRating)', () => {
    const onSubmit = vi.fn()
    renderComponent({ onSubmit })
    // No rating → the submit button does not exist, and there is no way to
    // trigger the form's submit handler into calling onSubmit.
    expect(screen.queryByRole('button', { name: /submit feedback/i })).not.toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
