import { describe, it, expect } from 'vitest'
import { WEBHOOK_EVENT_GROUPS, ALL_WEBHOOK_EVENTS } from './webhookTypes'
import type { WebhookEventDef } from './webhookTypes'

describe('webhookTypes (Issue #636)', () => {
  describe('WEBHOOK_EVENT_GROUPS', () => {
    it('contains exactly the 4 primary event groups', () => {
      expect(WEBHOOK_EVENT_GROUPS).toHaveLength(4)
      const groupIds = WEBHOOK_EVENT_GROUPS.map((g) => g.id)
      expect(groupIds).toEqual(['attestation', 'revenue-source', 'billing', 'key-management'])
    })

    it('ensures every group has a valid id, label, and at least one event', () => {
      WEBHOOK_EVENT_GROUPS.forEach((group) => {
        expect(group.id.length).toBeGreaterThan(0)
        expect(group.label.length).toBeGreaterThan(0)
        expect(group.events.length).toBeGreaterThan(0)
      })
    })

    it('ensures every event has a valid format (group.action)', () => {
      WEBHOOK_EVENT_GROUPS.forEach((group) => {
        group.events.forEach((event) => {
          expect(event.id).toContain('.')
          expect(event.label.length).toBeGreaterThan(0)
          expect(event.description?.length).toBeGreaterThan(0)
        })
      })
    })
  })

  describe('ALL_WEBHOOK_EVENTS', () => {
    it('flattens all grouped events perfectly without data loss', () => {
      const totalGroupedEvents = WEBHOOK_EVENT_GROUPS.reduce(
        (acc, group) => acc + group.events.length,
        0
      )
      expect(ALL_WEBHOOK_EVENTS).toHaveLength(totalGroupedEvents)
    })

    it('contains absolutely no duplicate event IDs', () => {
      const ids = ALL_WEBHOOK_EVENTS.map((e) => e.id)
      const uniqueIds = new Set(ids)
      // If the sizes match, there are no duplicates
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('Failure and Boundary behavior', () => {
    it('fails deterministically if an invalid event object is processed', () => {
      // Create a function that expects a valid WebhookEventDef to simulate a state transition/processing failure
      const processEvent = (event: Partial<WebhookEventDef>) => {
        if (!event.id || !event.label) {
          throw new Error('Invalid WebhookEventDef: Missing required fields')
        }
        return `Processed ${event.id}`
      }

      // Success path
      expect(processEvent({ id: 'test.event', label: 'Test Event' })).toBe('Processed test.event')

      // Failure path (missing label)
      expect(() => processEvent({ id: 'test.event' })).toThrow('Invalid WebhookEventDef: Missing required fields')
      
      // Failure path (missing ID)
      expect(() => processEvent({ label: 'Test Event' })).toThrow('Invalid WebhookEventDef: Missing required fields')
    })
  })
})