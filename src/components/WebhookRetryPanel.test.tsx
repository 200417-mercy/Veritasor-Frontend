import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WebhookRetryPanel from './WebhookRetryPanel';
import type { WebhookAttempt, WebhookDelivery } from './api-keys/apiKeyTypes';

/*
 * Regression coverage for WebhookRetryPanel (issue #607).
 *
 * The panel has no test fixture. These tests pin the delivery-outcome
 * branches (delivered / retrying / failed), the retry affordance, the
 * attempt status chips (success / HTTP error / timeout), and the backoff
 * chips so the observability contract cannot silently regress.
 */

function attempt(
  n: number,
  at: string,
  statusCode: number | null,
  extra: Partial<WebhookAttempt> = {},
): WebhookAttempt {
  return { attempt: n, at, statusCode, ...extra };
}

function delivery(
  status: WebhookDelivery['status'],
  attempts: WebhookAttempt[],
  event = 'attestation.completed',
): WebhookDelivery {
  return {
    id: 'wh_123',
    event,
    triggeredAt: '2026-06-24T10:00:00.000Z',
    status,
    attempts,
  };
}

const noop = () => undefined;

describe('WebhookRetryPanel', () => {
  it('labels the panel with the webhook event', () => {
    render(
      <WebhookRetryPanel
        delivery={delivery('delivered', [attempt(1, '2026-06-24T10:00:01.000Z', 200)])}
        onRetry={noop}
      />,
    );
    expect(
      screen.getByRole('article', { name: 'Webhook delivery for attestation.completed' }),
    ).toBeInTheDocument();
    expect(screen.getByText('attestation.completed')).toBeInTheDocument();
  });

  it('shows the trigger time as a machine-readable <time> element', () => {
    render(
      <WebhookRetryPanel
        delivery={delivery('delivered', [attempt(1, '2026-06-24T10:00:01.000Z', 200)])}
        onRetry={noop}
      />,
    );
    const triggered = document.querySelector('time[datetime="2026-06-24T10:00:00.000Z"]');
    expect(triggered).not.toBeNull();
  });

  it('lists attempts as an ordered list with an accessible attempt count', () => {
    render(
      <WebhookRetryPanel
        delivery={delivery('delivered', [
          attempt(1, '2026-06-24T10:00:01.000Z', 200),
          attempt(2, '2026-06-24T10:00:31.000Z', 200),
        ])}
        onRetry={noop}
      />,
    );
    expect(screen.getByRole('list')).toHaveAttribute('aria-label', '2 attempts');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('summarises a delivered delivery', () => {
    render(
      <WebhookRetryPanel
        delivery={delivery('delivered', [
          attempt(1, '2026-06-24T10:00:01.000Z', 500, { backoffSeconds: 30 }),
          attempt(2, '2026-06-24T10:00:31.000Z', 200),
        ])}
        onRetry={noop}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Delivered after 2 attempts.');
    expect(screen.getByText('200 OK')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText(/Wait 30s/)).toBeInTheDocument();
    // Delivered deliveries expose no retry affordance.
    expect(screen.queryByRole('button', { name: /Retry delivery/ })).not.toBeInTheDocument();
  });

  it('uses singular grammar for a single attempt', () => {
    render(
      <WebhookRetryPanel
        delivery={delivery('delivered', [attempt(1, '2026-06-24T10:00:01.000Z', 201)])}
        onRetry={noop}
      />,
    );
    expect(screen.getByRole('list')).toHaveAttribute('aria-label', '1 attempt');
    expect(screen.getByRole('status')).toHaveTextContent('Delivered after 1 attempt.');
    expect(screen.getByText('201 OK')).toBeInTheDocument();
  });

  it('renders a retry button for failed deliveries and forwards the delivery id', () => {
    const onRetry = vi.fn();
    render(
      <WebhookRetryPanel
        delivery={delivery('failed', [
          attempt(1, '2026-06-24T10:00:01.000Z', 503, { backoffSeconds: 30 }),
          attempt(2, '2026-06-24T10:00:31.000Z', null, { error: 'Connection refused', backoffSeconds: 60 }),
          attempt(3, '2026-06-24T10:01:31.000Z', 500, { error: 'Timeout exceeded' }),
        ], 'webhook.failed')}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry delivery for webhook.failed' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith('wh_123');
  });

  it('labels timeout attempts (no HTTP status) explicitly', () => {
    render(
      <WebhookRetryPanel
        delivery={delivery('failed', [
          attempt(1, '2026-06-24T10:00:01.000Z', 503),
          attempt(2, '2026-06-24T10:00:31.000Z', null, { error: 'socket hang up' }),
        ])}
        onRetry={noop}
      />,
    );
    expect(screen.getByText('Timeout')).toBeInTheDocument();
    expect(screen.getByText('503')).toBeInTheDocument();
    expect(screen.getByText('socket hang up')).toBeInTheDocument();
  });

  it('reports the failure detail from the final attempt', () => {
    render(
      <WebhookRetryPanel
        delivery={delivery('failed', [
          attempt(1, '2026-06-24T10:00:01.000Z', 500),
          attempt(2, '2026-06-24T10:00:31.000Z', 500, { error: 'Internal error' }),
        ])}
        onRetry={noop}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Failed after 2 attempts (Internal error).',
    );
  });

  it('shows a retrying summary without a retry button', () => {
    render(
      <WebhookRetryPanel
        delivery={delivery('retrying', [
          attempt(1, '2026-06-24T10:00:01.000Z', 500, { backoffSeconds: 30 }),
          attempt(2, '2026-06-24T10:00:31.000Z', null, { error: 'timeout' }),
        ])}
        onRetry={noop}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Retrying – attempt 2 of up to 5.');
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });

  it('disables the retry button and marks it busy while a retry is in flight', () => {
    const onRetry = vi.fn();
    render(
      <WebhookRetryPanel
        delivery={delivery('failed', [attempt(1, '2026-06-24T10:00:01.000Z', 500)])}
        onRetry={onRetry}
        isRetrying
      />,
    );
    const button = screen.getByRole('button', { name: /Retry delivery/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent('Retrying…');
    fireEvent.click(button);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('formats backoff intervals and only renders them between attempts', () => {
    render(
      <WebhookRetryPanel
        delivery={delivery('failed', [
          attempt(1, '2026-06-24T10:00:01.000Z', 500, { backoffSeconds: 45 }),
          attempt(2, '2026-06-24T10:01:01.000Z', 500, { backoffSeconds: 90 }),
          attempt(3, '2026-06-24T10:02:31.000Z', 500, { backoffSeconds: 7200 }),
          // The final attempt's backoff is meaningless and must not be shown.
          attempt(4, '2026-06-24T12:02:31.000Z', 500, { backoffSeconds: 30 }),
        ])}
        onRetry={noop}
      />,
    );
    expect(screen.getByText(/Wait 45s/)).toBeInTheDocument();
    expect(screen.getByText(/Wait 2m/)).toBeInTheDocument();
    expect(screen.getByText(/Wait 2.0h/)).toBeInTheDocument();
    expect(screen.getAllByText(/Wait /)).toHaveLength(3);
  });

  it('treats only 2xx status codes as success', () => {
    const { unmount } = render(
      <WebhookRetryPanel
        delivery={delivery('delivered', [attempt(1, '2026-06-24T10:00:01.000Z', 299)])}
        onRetry={noop}
      />,
    );
    expect(screen.getByText('299 OK')).toBeInTheDocument();
    unmount();

    render(
      <WebhookRetryPanel
        delivery={delivery('failed', [
          attempt(1, '2026-06-24T10:00:01.000Z', 199),
          attempt(2, '2026-06-24T10:00:31.000Z', 300),
        ])}
        onRetry={noop}
      />,
    );
    expect(screen.getByText('199')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.queryByText(/199 OK/)).not.toBeInTheDocument();
    expect(screen.queryByText(/300 OK/)).not.toBeInTheDocument();
  });
});
