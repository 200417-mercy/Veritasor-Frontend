import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JsonTreeViewer, { JsonTreeNode } from '../components/webhooks/JsonTreeViewer';

/**
 * Focused behaviour coverage for `JsonTreeViewer` / `JsonTreeNodeProps`
 * (issue #632). The shared webhook-payload suite covers the basic render,
 * click/keyboard toggle and one clipboard path; this file pins the remaining
 * contract: the `defaultExpandedDepth` boundary, the Space key, container copy
 * payloads and the 2s copy-feedback reset.
 */
describe('JsonTreeViewer behaviour', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('announces the configurable title through the polite live region', () => {
    render(<JsonTreeViewer data={{ ok: true }} title="Webhook body" />);

    expect(screen.getByText('Webhook body loaded')).toBeInTheDocument();
    expect(screen.getByText('Webhook body loaded')).toHaveAttribute('aria-live', 'polite');
  });

  it('defaults the live-region title when none is supplied', () => {
    render(<JsonTreeViewer data={{ ok: true }} />);

    expect(screen.getByText('Payload JSON loaded')).toBeInTheDocument();
  });

  it('collapses nodes at or below defaultExpandedDepth', () => {
    const { container } = render(
      <JsonTreeNode data={{ outer: { inner: { deep: 1 } } }} depth={0} defaultExpandedDepth={1} />,
    );

    // depth 0 is expanded
    expect(screen.getByText('"outer":')).toBeInTheDocument();
    // depth 1 is collapsed -> its child key is not rendered until expanded
    expect(screen.queryByText('"inner":')).not.toBeInTheDocument();

    const outerToggle = within(container).getByRole('button', { name: /expand node "outer"/i });
    fireEvent.click(outerToggle);

    expect(screen.getByText('"inner":')).toBeInTheDocument();
  });

  it('expands an already-expanded container when defaultExpandedDepth is larger', () => {
    render(<JsonTreeNode data={{ a: { b: 1 } }} depth={0} defaultExpandedDepth={3} />);

    expect(screen.getByText('"a":')).toBeInTheDocument();
    expect(screen.getByText('"b":')).toBeInTheDocument();
  });

  it('toggles expandable nodes with the Space key', () => {
    render(<JsonTreeNode data={{ payload: { ok: true } }} depth={0} defaultExpandedDepth={0} />);
    const toggle = screen.getByRole('button', { name: /expand node "payload"/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(toggle, { key: ' ' });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders arrays with item counts and object nodes with key counts', () => {
    const { unmount } = render(
      <JsonTreeNode data={['alpha', 'beta']} depth={0} defaultExpandedDepth={0} />,
    );
    expect(
      screen.getByRole('button', { name: /expand json object \(2 items\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 items \]/i)).toBeInTheDocument();
    unmount();

    render(<JsonTreeNode label="meta" data={{ a: 1, b: 2, c: 3 }} depth={0} defaultExpandedDepth={0} />);
    expect(
      screen.getByRole('button', { name: /expand node "meta" \(3 keys\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/3 keys \}/i)).toBeInTheDocument();
  });

  it('renders empty containers with a zero count instead of throwing', () => {
    render(<JsonTreeNode label="empty" data={{}} depth={0} defaultExpandedDepth={0} />);

    expect(
      screen.getByRole('button', { name: /expand node "empty" \(0 keys\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 keys \}/i)).toBeInTheDocument();
  });

  it('formats leaves by JSON type', () => {
    const { unmount } = render(<JsonTreeNode data="alpha" depth={0} />);
    expect(screen.getByText('"alpha"')).toBeInTheDocument();
    unmount();

    render(
      <div>
        <JsonTreeNode data={42} depth={0} />
        <JsonTreeNode data={true} depth={0} />
        <JsonTreeNode data={null} depth={0} />
      </div>,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();
  });

  it('never renders an expand control for a leaf node', () => {
    render(<JsonTreeNode label="count" data={42} />);

    expect(screen.queryByRole('button', { name: /expand|collapse/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy value for count/i })).toBeInTheDocument();
  });

  it('copies the pretty-printed payload for a container node', () => {
    const data = { a: 1, nested: { b: [2, 3] } };
    render(<JsonTreeNode label="config" data={data} depth={0} defaultExpandedDepth={0} />);

    fireEvent.click(screen.getByRole('button', { name: /copy value for config/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  it('falls back to the node path in the copy label when no label is given', () => {
    render(<JsonTreeNode data={7} path="$.amount" />);

    expect(screen.getByRole('button', { name: /copy json node at \$\.amount/i })).toBeInTheDocument();
  });

  it('resets the "Copied" feedback after two seconds', () => {
    vi.useFakeTimers();
    try {
      render(<JsonTreeNode label="count" data={42} />);

      fireEvent.click(screen.getByRole('button', { name: /copy value for count/i }));
      expect(screen.getByText(/✓ Copied/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1999);
      });
      expect(screen.getByText(/✓ Copied/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByText(/✓ Copied/i)).not.toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
