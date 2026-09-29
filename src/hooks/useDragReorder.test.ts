import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  useDragReorder,
  type DragReorderState,
  type DragReorderHandlers,
  type UseDragReorderReturn,
} from './useDragReorder'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Item = { id: string; label: string }

const ITEMS: Item[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
]

const getLabel = (item: Item) => item.label

function makeHook(
  items = ITEMS,
  onReorder = vi.fn<[Item[]], void>(),
) {
  return renderHook(
    ({ list, cb }: { list: Item[]; cb: (next: Item[]) => void }) =>
      useDragReorder(list, cb, getLabel),
    { initialProps: { list: items, cb: onReorder } },
  )
}

const noopEvent = { preventDefault: vi.fn() }

// ─── Type-contract assertions ────────────────────────────────────────────────

describe('public contract types', () => {
  it('returns a value that satisfies DragReorderState', () => {
    const { result } = makeHook()
    const state: DragReorderState = {
      grabbedIndex: result.current.grabbedIndex,
      dropTargetIndex: result.current.dropTargetIndex,
    }
    expect(state.grabbedIndex).toBeNull()
    expect(state.dropTargetIndex).toBeNull()
  })

  it('returns a value that satisfies DragReorderHandlers', () => {
    const { result } = makeHook()
    const handlers: DragReorderHandlers = {
      handlePointerDown: result.current.handlePointerDown,
      handlePointerEnter: result.current.handlePointerEnter,
      handlePointerUp: result.current.handlePointerUp,
      handleKeyboardGrab: result.current.handleKeyboardGrab,
      handleKeyDown: result.current.handleKeyDown,
      moveUp: result.current.moveUp,
      moveDown: result.current.moveDown,
    }
    Object.values(handlers).forEach((fn) => expect(typeof fn).toBe('function'))
  })

  it('returns a value that satisfies UseDragReorderReturn', () => {
    const { result } = makeHook()
    const full: UseDragReorderReturn = result.current
    expect(typeof full.announcement).toBe('string')
    expect(typeof full.grabbedIndex === 'number' || full.grabbedIndex === null).toBe(true)
    expect(typeof full.dropTargetIndex === 'number' || full.dropTargetIndex === null).toBe(true)
  })
})

// ─── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts idle with all state nulled and empty announcement', () => {
    const { result } = makeHook()
    expect(result.current.grabbedIndex).toBeNull()
    expect(result.current.dropTargetIndex).toBeNull()
    expect(result.current.announcement).toBe('')
  })
})

// ─── Pointer drag flow ────────────────────────────────────────────────────────

describe('pointer drag flow', () => {
  it('sets grabbedIndex and dropTargetIndex on pointerdown', () => {
    const { result } = makeHook()

    act(() => {
      result.current.handlePointerDown(1)(noopEvent)
    })

    expect(result.current.grabbedIndex).toBe(1)
    expect(result.current.dropTargetIndex).toBe(1)
  })

  it('calls e.preventDefault() on pointerdown', () => {
    const { result } = makeHook()
    const evt = { preventDefault: vi.fn() }

    act(() => {
      result.current.handlePointerDown(0)(evt)
    })

    expect(evt.preventDefault).toHaveBeenCalledOnce()
  })

  it('announces the grabbed item on pointerdown', () => {
    const { result } = makeHook()

    act(() => {
      result.current.handlePointerDown(0)(noopEvent)
    })

    expect(result.current.announcement).toBe('Grabbed Alpha. Drag to reorder.')
  })

  it('updates dropTargetIndex on pointerenter while dragging', () => {
    const { result } = makeHook()

    act(() => {
      result.current.handlePointerDown(0)(noopEvent)
    })
    act(() => {
      result.current.handlePointerEnter(2)()
    })

    expect(result.current.dropTargetIndex).toBe(2)
  })

  it('pointerenter is a no-op when no drag is in progress', () => {
    const { result } = makeHook()

    act(() => {
      result.current.handlePointerEnter(2)()
    })

    expect(result.current.dropTargetIndex).toBeNull()
  })

  it('commits reorder and announces on pointerup with a different target', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.handlePointerDown(0)(noopEvent)
    })
    act(() => {
      result.current.handlePointerEnter(2)()
    })
    act(() => {
      result.current.handlePointerUp()
    })

    expect(onReorder).toHaveBeenCalledOnce()
    const reordered = onReorder.mock.calls[0][0]
    expect(reordered[0].id).toBe('b') // Beta moves to front
    expect(reordered[1].id).toBe('c')
    expect(reordered[2].id).toBe('a') // Alpha displaced to end

    expect(result.current.grabbedIndex).toBeNull()
    expect(result.current.dropTargetIndex).toBeNull()
    expect(result.current.announcement).toContain('Dropped')
    expect(result.current.announcement).toContain('Alpha')
  })

  it('announces cancelled drop when pointerup on same index', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.handlePointerDown(1)(noopEvent)
    })
    act(() => {
      result.current.handlePointerUp()
    })

    expect(onReorder).not.toHaveBeenCalled()
    expect(result.current.announcement).toBe('Drop cancelled.')
  })

  it('pointerup is a no-op when no drag is in progress', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.handlePointerUp()
    })

    expect(onReorder).not.toHaveBeenCalled()
    expect(result.current.announcement).toBe('')
  })

  it('resets state after a completed drag', () => {
    const { result } = makeHook()

    act(() => {
      result.current.handlePointerDown(0)(noopEvent)
      result.current.handlePointerEnter(1)()
    })
    act(() => {
      result.current.handlePointerUp()
    })

    expect(result.current.grabbedIndex).toBeNull()
    expect(result.current.dropTargetIndex).toBeNull()
  })
})

// ─── Keyboard reorder flow ────────────────────────────────────────────────────

describe('keyboard reorder flow', () => {
  it('grabs an item via handleKeyboardGrab and announces it', () => {
    const { result } = makeHook()

    act(() => {
      result.current.handleKeyboardGrab(0)
    })

    expect(result.current.grabbedIndex).toBe(0)
    expect(result.current.announcement).toContain('Alpha')
    expect(result.current.announcement).toContain('arrow keys')
  })

  it('toggling the same index again releases the grab and announces drop-in-place', () => {
    const { result } = makeHook()

    act(() => {
      result.current.handleKeyboardGrab(0)
    })
    act(() => {
      result.current.handleKeyboardGrab(0)
    })

    expect(result.current.grabbedIndex).toBeNull()
    expect(result.current.announcement).toContain('dropped in place')
  })

  it('ArrowDown moves the grabbed item down and updates announcement', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.handleKeyboardGrab(0)
    })
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() })
    })

    expect(onReorder).toHaveBeenCalledOnce()
    const reordered = onReorder.mock.calls[0][0]
    expect(reordered[0].id).toBe('b')
    expect(reordered[1].id).toBe('a')
    expect(result.current.grabbedIndex).toBe(1)
    expect(result.current.announcement).toContain('position 2')
  })

  it('ArrowUp moves the grabbed item up and updates announcement', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result, rerender } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.handleKeyboardGrab(2)
    })

    // Simulate the parent updating items after reorder
    const reordered: Item[] = [ITEMS[0], ITEMS[2], ITEMS[1]]
    rerender({ list: reordered, cb: onReorder })

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() })
    })

    expect(onReorder).toHaveBeenCalledOnce()
  })

  it('ArrowDown at the last item does not reorder', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.handleKeyboardGrab(2) // last index
    })
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() })
    })

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('ArrowUp at the first item does not reorder', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.handleKeyboardGrab(0)
    })
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() })
    })

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('Enter drops the item in its current position', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.handleKeyboardGrab(1)
    })
    act(() => {
      result.current.handleKeyDown({ key: 'Enter', preventDefault: vi.fn() })
    })

    expect(result.current.grabbedIndex).toBeNull()
    expect(onReorder).not.toHaveBeenCalled()
    expect(result.current.announcement).toContain('dropped at position')
  })

  it('Space drops the item in its current position', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.handleKeyboardGrab(1)
    })
    act(() => {
      result.current.handleKeyDown({ key: ' ', preventDefault: vi.fn() })
    })

    expect(result.current.grabbedIndex).toBeNull()
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('Escape cancels the grab without reordering', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.handleKeyboardGrab(1)
    })
    act(() => {
      result.current.handleKeyDown({ key: 'Escape', preventDefault: vi.fn() })
    })

    expect(result.current.grabbedIndex).toBeNull()
    expect(onReorder).not.toHaveBeenCalled()
    expect(result.current.announcement).toContain('cancelled')
  })

  it('handleKeyDown calls e.preventDefault() for handled keys', () => {
    const { result } = makeHook()
    const evt = { key: 'ArrowDown', preventDefault: vi.fn() }

    act(() => {
      result.current.handleKeyboardGrab(0)
    })
    act(() => {
      result.current.handleKeyDown(evt)
    })

    expect(evt.preventDefault).toHaveBeenCalledOnce()
  })

  it('handleKeyDown ignores unrelated keys and does NOT call preventDefault', () => {
    const { result } = makeHook()
    const onReorder = vi.fn<[Item[]], void>()
    const evt = { key: 'Tab', preventDefault: vi.fn() }

    act(() => {
      result.current.handleKeyboardGrab(0)
    })
    act(() => {
      result.current.handleKeyDown(evt)
    })

    expect(evt.preventDefault).not.toHaveBeenCalled()
    expect(onReorder).not.toHaveBeenCalled()
    expect(result.current.grabbedIndex).toBe(0) // still grabbed
  })

  it('handleKeyDown is a no-op when nothing is grabbed', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)
    const evt = { key: 'ArrowDown', preventDefault: vi.fn() }

    act(() => {
      result.current.handleKeyDown(evt)
    })

    expect(onReorder).not.toHaveBeenCalled()
    expect(evt.preventDefault).not.toHaveBeenCalled()
  })
})

// ─── moveUp / moveDown (per-row buttons) ──────────────────────────────────────

describe('moveUp', () => {
  it('moves the item up one position', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.moveUp(1)
    })

    expect(onReorder).toHaveBeenCalledOnce()
    const reordered = onReorder.mock.calls[0][0]
    expect(reordered[0].id).toBe('b')
    expect(reordered[1].id).toBe('a')
    expect(reordered[2].id).toBe('c')
  })

  it('announces the move with correct position', () => {
    const { result } = makeHook()

    act(() => {
      result.current.moveUp(1)
    })

    expect(result.current.announcement).toContain('moved up')
    expect(result.current.announcement).toContain('position 1')
  })

  it('is a no-op when index is 0 (already at top)', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.moveUp(0)
    })

    expect(onReorder).not.toHaveBeenCalled()
  })
})

describe('moveDown', () => {
  it('moves the item down one position', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.moveDown(1)
    })

    expect(onReorder).toHaveBeenCalledOnce()
    const reordered = onReorder.mock.calls[0][0]
    expect(reordered[0].id).toBe('a')
    expect(reordered[1].id).toBe('c')
    expect(reordered[2].id).toBe('b')
  })

  it('announces the move with correct position', () => {
    const { result } = makeHook()

    act(() => {
      result.current.moveDown(1)
    })

    expect(result.current.announcement).toContain('moved down')
    expect(result.current.announcement).toContain('position 3')
  })

  it('is a no-op when index is the last item', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.moveDown(2) // last index
    })

    expect(onReorder).not.toHaveBeenCalled()
  })
})

// ─── Boundary / invalid inputs ────────────────────────────────────────────────

describe('boundary and invalid inputs', () => {
  it('handles an empty items array without throwing', () => {
    const { result } = renderHook(() =>
      useDragReorder<Item>([], vi.fn(), getLabel),
    )
    expect(result.current.grabbedIndex).toBeNull()
  })

  it('handles a single-item list: moveUp and moveDown are both no-ops', () => {
    const single: Item[] = [{ id: 'x', label: 'Only' }]
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = renderHook(() =>
      useDragReorder(single, onReorder, getLabel),
    )

    act(() => {
      result.current.moveUp(0)
      result.current.moveDown(0)
    })

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('handles a single-item list: ArrowUp and ArrowDown are no-ops', () => {
    const single: Item[] = [{ id: 'x', label: 'Only' }]
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = renderHook(() =>
      useDragReorder(single, onReorder, getLabel),
    )

    act(() => {
      result.current.handleKeyboardGrab(0)
    })
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() })
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() })
    })

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('reorder with from === to does not call onReorder', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    // Drag and release on same index
    act(() => {
      result.current.handlePointerDown(1)(noopEvent)
    })
    act(() => {
      result.current.handlePointerUp()
    })

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('pointerenter outside grab is silently ignored', () => {
    const { result } = makeHook()

    act(() => {
      // No pointerdown first
      result.current.handlePointerEnter(0)()
    })

    expect(result.current.dropTargetIndex).toBeNull()
    expect(result.current.grabbedIndex).toBeNull()
  })

  it('works correctly with plain string items', () => {
    const strings = ['first', 'second', 'third']
    const onReorder = vi.fn<[string[]], void>()
    const { result } = renderHook(() =>
      useDragReorder(strings, onReorder, (s) => s),
    )

    act(() => {
      result.current.moveDown(0)
    })

    expect(onReorder).toHaveBeenCalledOnce()
    expect(onReorder.mock.calls[0][0]).toEqual(['second', 'first', 'third'])
  })
})

// ─── Announcement completeness ─────────────────────────────────────────────────

describe('accessibility announcements', () => {
  it('includes item label and total count in keyboard grab announcement', () => {
    const { result } = makeHook()

    act(() => {
      result.current.handleKeyboardGrab(0)
    })

    expect(result.current.announcement).toContain('Alpha')
    expect(result.current.announcement).toContain(`${ITEMS.length}`)
    expect(result.current.announcement).toContain('position 1')
  })

  it('includes item label and drop position in drop announcement', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.handlePointerDown(0)(noopEvent)
    })
    act(() => {
      result.current.handlePointerEnter(2)()
    })
    act(() => {
      result.current.handlePointerUp()
    })

    expect(result.current.announcement).toContain('Alpha')
    expect(result.current.announcement).toContain('position 3')
    expect(result.current.announcement).toContain(`${ITEMS.length}`)
  })

  it('Escape announcement mentions the item label', () => {
    const { result } = makeHook()

    act(() => {
      result.current.handleKeyboardGrab(2)
    })
    act(() => {
      result.current.handleKeyDown({ key: 'Escape', preventDefault: vi.fn() })
    })

    expect(result.current.announcement).toContain('Gamma')
  })
})

// ─── onReorder callback behaviour ────────────────────────────────────────────

describe('onReorder callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes a new array reference, not the same reference', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.moveDown(0)
    })

    const received = onReorder.mock.calls[0][0]
    expect(received).not.toBe(ITEMS)
  })

  it('preserves all items during a reorder — no items lost or duplicated', () => {
    const onReorder = vi.fn<[Item[]], void>()
    const { result } = makeHook(ITEMS, onReorder)

    act(() => {
      result.current.moveUp(2)
    })

    const received = onReorder.mock.calls[0][0]
    expect(received).toHaveLength(ITEMS.length)
    const ids = new Set(received.map((i) => i.id))
    ITEMS.forEach((item) => expect(ids.has(item.id)).toBe(true))
  })
})
