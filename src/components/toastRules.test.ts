/**
 * Behavioural coverage for `src/components/toastRules.ts`.
 *
 * The module encodes the UX contract in `docs/uiux/toast-notification-system.md`
 * (severity vocabulary, visibility caps, auto-dismiss cadence, and stack
 * collapse). These tests pin that contract so a regression in the shared
 * constants fails loudly here rather than in a rendered toast somewhere else.
 */

import { describe, it, expect } from 'vitest'
import {
  MAX_VISIBLE_DESKTOP,
  MAX_VISIBLE_MOBILE,
  MOBILE_BREAKPOINT_QUERY,
  AUTO_DISMISS_MS,
  UNDO_EXTRA_MS,
  resolveAutoDismissMs,
  splitStack,
  describeOverflow,
} from './toastRules'
import type { ToastSeverity } from './toastRules'

/** Every severity the public type allows, kept in one place for iteration. */
const ALL_SEVERITIES: readonly ToastSeverity[] = ['success', 'info', 'warning', 'error']

/** Severities that persist until explicitly dismissed. */
const PERSISTENT_SEVERITIES: readonly ToastSeverity[] = ['warning', 'error']

/** Severities that auto-dismiss on the default cadence. */
const TRANSIENT_SEVERITIES: readonly ToastSeverity[] = ['success', 'info']

describe('toastRules', () => {
  describe('ToastSeverity', () => {
    it('accepts exactly the four documented severities', () => {
      expect(ALL_SEVERITIES).toEqual(['success', 'info', 'warning', 'error'])
    })

    it('defines an auto-dismiss cadence for every severity, and no others', () => {
      // Key parity is the runtime-observable half of the union: a severity
      // added to the type without a cadence would resolve to `undefined`.
      expect(Object.keys(AUTO_DISMISS_MS).sort()).toEqual([...ALL_SEVERITIES].sort())
      ALL_SEVERITIES.forEach((severity) => {
        expect(AUTO_DISMISS_MS[severity]).toBeTypeOf('number')
        expect(AUTO_DISMISS_MS[severity]).toBeGreaterThanOrEqual(0)
      })
    })

    it('persists warning and error while auto-dismissing success and info', () => {
      PERSISTENT_SEVERITIES.forEach((severity) => {
        expect(AUTO_DISMISS_MS[severity]).toBe(0)
        expect(resolveAutoDismissMs(severity, false)).toBe(0)
      })
      TRANSIENT_SEVERITIES.forEach((severity) => {
        expect(AUTO_DISMISS_MS[severity]).toBeGreaterThan(0)
        expect(resolveAutoDismissMs(severity, false)).toBe(AUTO_DISMISS_MS[severity])
      })
    })

    it('gives success and info the same default cadence', () => {
      expect(AUTO_DISMISS_MS.success).toBe(AUTO_DISMISS_MS.info)
    })
  })

  describe('visibility caps', () => {
    it('exposes the documented desktop cap of 3', () => {
      expect(MAX_VISIBLE_DESKTOP).toBe(3)
      expect(Number.isInteger(MAX_VISIBLE_DESKTOP)).toBe(true)
    })

    it('exposes the documented mobile cap of 1', () => {
      expect(MAX_VISIBLE_MOBILE).toBe(1)
      expect(Number.isInteger(MAX_VISIBLE_MOBILE)).toBe(true)
    })

    it('keeps the mobile cap strictly tighter than the desktop cap', () => {
      expect(MAX_VISIBLE_MOBILE).toBeLessThan(MAX_VISIBLE_DESKTOP)
    })

    it('keeps both caps usable as a positive stack limit', () => {
      for (const cap of [MAX_VISIBLE_DESKTOP, MAX_VISIBLE_MOBILE]) {
        expect(cap).toBeGreaterThan(0)
      }
    })

    it('uses a max-width breakpoint consistent with the mobile cap comment', () => {
      expect(MOBILE_BREAKPOINT_QUERY).toBe('(max-width: 480px)')
    })
  })

  describe('resolveAutoDismissMs', () => {
    it('returns the base cadence for transient severities without undo', () => {
      expect(resolveAutoDismissMs('success', false)).toBe(5000)
      expect(resolveAutoDismissMs('info', false)).toBe(5000)
    })

    it('extends the cadence by UNDO_EXTRA_MS when an undo affordance is present', () => {
      expect(UNDO_EXTRA_MS).toBe(3000)
      expect(resolveAutoDismissMs('success', true)).toBe(AUTO_DISMISS_MS.success + UNDO_EXTRA_MS)
      expect(resolveAutoDismissMs('info', true)).toBe(AUTO_DISMISS_MS.info + UNDO_EXTRA_MS)
    })

    it('keeps persistent severities persistent even with undo', () => {
      expect(resolveAutoDismissMs('warning', true)).toBe(0)
      expect(resolveAutoDismissMs('error', true)).toBe(0)
    })

    it('honours an explicit override for every severity', () => {
      ALL_SEVERITIES.forEach((severity) => {
        expect(resolveAutoDismissMs(severity, false, 1234)).toBe(1234)
        expect(resolveAutoDismissMs(severity, true, 1234)).toBe(1234)
      })
    })

    it('treats a 0 override as "persist" rather than "missing"', () => {
      ALL_SEVERITIES.forEach((severity) => {
        expect(resolveAutoDismissMs(severity, false, 0)).toBe(0)
      })
    })

    it('falls back to the base cadence when the override is undefined', () => {
      expect(resolveAutoDismissMs('success', false, undefined)).toBe(
        AUTO_DISMISS_MS.success,
      )
    })
  })

  describe('splitStack', () => {
    const items = ['oldest', 'middle', 'newer', 'newest'] as const

    it('keeps every item visible when the list fits the cap', () => {
      expect(splitStack(items, MAX_VISIBLE_DESKTOP + 1)).toEqual({
        visible: [...items],
        overflow: [],
      })
    })

    it('keeps every item visible at exactly the cap', () => {
      expect(splitStack(items, items.length)).toEqual({
        visible: [...items],
        overflow: [],
      })
    })

    it('keeps every item visible when the list is empty', () => {
      expect(splitStack([], MAX_VISIBLE_DESKTOP)).toEqual({ visible: [], overflow: [] })
    })

    it('collapses the oldest items once the desktop cap is exceeded', () => {
      // 4 items, cap 3 → the single oldest item overflows, newest 3 stay visible.
      expect(splitStack(items, MAX_VISIBLE_DESKTOP)).toEqual({
        visible: ['middle', 'newer', 'newest'],
        overflow: ['oldest'],
      })
    })

    it('collapses everything but the newest item at the mobile cap', () => {
      expect(splitStack(items, MAX_VISIBLE_MOBILE)).toEqual({
        visible: ['newest'],
        overflow: ['oldest', 'middle', 'newer'],
      })
    })

    it('never drops or duplicates items, whatever the cap', () => {
      for (let maxVisible = 0; maxVisible <= items.length + 2; maxVisible++) {
        const { visible, overflow } = splitStack(items, maxVisible)
        expect(visible).toHaveLength(Math.max(0, Math.min(maxVisible, items.length)))
        expect([...overflow, ...visible]).toEqual([...items])
        expect(new Set([...overflow, ...visible]).size).toBe(items.length)
      }
    })

    it('keeps the newest items in the order they were raised', () => {
      const { visible } = splitStack(items, MAX_VISIBLE_DESKTOP)
      expect(visible).toEqual([...visible].sort((a, b) => items.indexOf(a) - items.indexOf(b)))
    })

    it('overflows everything for a non-positive cap instead of throwing', () => {
      // Failure path: `maxVisible <= 0` must still degrade to a group card.
      expect(splitStack(items, 0)).toEqual({ visible: [], overflow: [...items] })
      expect(splitStack(items, -1)).toEqual({ visible: [], overflow: [...items] })
    })

    it('overflows nothing for a non-positive cap when the list is empty', () => {
      expect(splitStack([], 0)).toEqual({ visible: [], overflow: [] })
    })

    it('returns fresh arrays so callers cannot mutate the source list', () => {
      const source = ['a', 'b', 'c', 'd']
      const result = splitStack(source, MAX_VISIBLE_DESKTOP)
      result.visible.push('injected')
      expect(source).toEqual(['a', 'b', 'c', 'd'])
    })
  })

  describe('describeOverflow', () => {
    it('uses the singular label for exactly one overflowed toast', () => {
      expect(describeOverflow(1, 'toast', 'toasts')).toBe('1 toast')
    })

    it('uses the plural label for zero and for many', () => {
      expect(describeOverflow(0, 'toast', 'toasts')).toBe('0 toasts')
      expect(describeOverflow(2, 'toast', 'toasts')).toBe('2 toasts')
      expect(describeOverflow(MAX_VISIBLE_DESKTOP, 'message', 'messages')).toBe('3 messages')
    })

    it('stays consistent with the split it describes', () => {
      const { overflow } = splitStack(['a', 'b', 'c', 'd'], MAX_VISIBLE_DESKTOP)
      expect(describeOverflow(overflow.length, 'toast', 'toasts')).toBe(
        overflow.length === 1 ? '1 toast' : `${overflow.length} toasts`,
      )
    })
  })
})
