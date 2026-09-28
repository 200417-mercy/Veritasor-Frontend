import { describe, it, expect } from 'vitest'
import { AVAILABLE_INTEGRATIONS } from './integrations-data'
import type { Integration } from './IntegrationCard'

describe('AVAILABLE_INTEGRATIONS', () => {
  it('should be defined and contain items', () => {
    expect(AVAILABLE_INTEGRATIONS).toBeDefined()
    expect(Array.isArray(AVAILABLE_INTEGRATIONS)).toBe(true)
    expect(AVAILABLE_INTEGRATIONS.length).toBeGreaterThan(0)
  })

  it('should have unique ids for all integrations', () => {
    const ids = AVAILABLE_INTEGRATIONS.map((integration) => integration.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should have valid structure for all items', () => {
    AVAILABLE_INTEGRATIONS.forEach((integration) => {
      expect(integration).toHaveProperty('id')
      expect(typeof integration.id).toBe('string')

      expect(integration).toHaveProperty('name')
      expect(typeof integration.name).toBe('string')

      expect(integration).toHaveProperty('description')
      expect(typeof integration.description).toBe('string')

      expect(integration).toHaveProperty('icon')
      expect(typeof integration.icon).toBe('string')

      expect(integration).toHaveProperty('status')
      expect(['connected', 'available', 'error']).toContain(integration.status)

      expect(integration).toHaveProperty('statusText')
      expect(typeof integration.statusText).toBe('string')
    })
  })

  it('should cover expected primary state transitions or statuses', () => {
    const statuses = AVAILABLE_INTEGRATIONS.map((integration) => integration.status)
    const uniqueStatuses = Array.from(new Set(statuses))
    
    // Check that we at least have representations of the primary statuses in our dummy data
    expect(uniqueStatuses).toContain('connected')
    expect(uniqueStatuses).toContain('available')
    expect(uniqueStatuses).toContain('error')
  })
})
