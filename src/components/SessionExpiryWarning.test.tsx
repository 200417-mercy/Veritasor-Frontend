import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SessionExpiryWarning } from './SessionExpiryWarning';

describe('SessionExpiryWarning', () => {
  it('returns null and does not render when isOpen is false', () => {
    const { container } = render(
      <SessionExpiryWarning
        isOpen={false}
        timeLeft={60}
        onExtendSession={() => {}}
        onReauth={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the warning with correct formatted time when isOpen is true', () => {
    render(
      <SessionExpiryWarning
        isOpen={true}
        timeLeft={65} // 1:05
        onExtendSession={() => {}}
        onReauth={() => {}}
      />
    );
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('Your session is about to expire')).toBeInTheDocument();
  });

  it('calls onExtendSession when Extend Session button is clicked', () => {
    const onExtendSession = vi.fn();
    render(
      <SessionExpiryWarning
        isOpen={true}
        timeLeft={60}
        onExtendSession={onExtendSession}
        onReauth={() => {}}
      />
    );
    
    fireEvent.click(screen.getByText('Extend Session'));
    expect(onExtendSession).toHaveBeenCalledTimes(1);
  });

  it('calls onReauth when Re-authenticate Now button is clicked', () => {
    const onReauth = vi.fn();
    render(
      <SessionExpiryWarning
        isOpen={true}
        timeLeft={60}
        onExtendSession={() => {}}
        onReauth={onReauth}
      />
    );
    
    fireEvent.click(screen.getByText('Re-authenticate Now'));
    expect(onReauth).toHaveBeenCalledTimes(1);
  });

  it('calls onExtendSession when backdrop is clicked', () => {
    const onExtendSession = vi.fn();
    const { container } = render(
      <SessionExpiryWarning
        isOpen={true}
        timeLeft={60}
        onExtendSession={onExtendSession}
        onReauth={() => {}}
      />
    );
    
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onExtendSession).toHaveBeenCalledTimes(1);
  });

  it('calls onExtendSession when Escape key is pressed', () => {
    const onExtendSession = vi.fn();
    render(
      <SessionExpiryWarning
        isOpen={true}
        timeLeft={60}
        onExtendSession={onExtendSession}
        onReauth={() => {}}
      />
    );
    
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onExtendSession).toHaveBeenCalledTimes(1);
  });
});
