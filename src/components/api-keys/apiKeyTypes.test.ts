import { describe, it, expect, expectTypeOf } from 'vitest';
import type { ApiKeyStatus, ApiKey, DependentUsage } from './apiKeyTypes';

describe('apiKeyTypes', () => {
  describe('ApiKeyStatus', () => {
    it('allows valid status values', () => {
      const active: ApiKeyStatus = 'active';
      const expired: ApiKeyStatus = 'expired';
      const revoked: ApiKeyStatus = 'revoked';

      expect(active).toBe('active');
      expect(expired).toBe('expired');
      expect(revoked).toBe('revoked');
    });

    it('rejects invalid status values at compile time', () => {
      // @ts-expect-error invalid status
      const invalidStatus: ApiKeyStatus = 'pending';
      // @ts-expect-error invalid type
      const invalidType: ApiKeyStatus = 123;
      
      expect(invalidStatus).toBe('pending');
      expect(invalidType).toBe(123);
    });

    it('primary state transitions are representable', () => {
      let status: ApiKeyStatus = 'active';
      expect(status).toBe('active');
      
      // Transition to expired
      status = 'expired';
      expect(status).toBe('expired');
      
      // Transition to revoked
      status = 'revoked';
      expect(status).toBe('revoked');
    });
  });

  describe('ApiKey', () => {
    it('accepts a valid ApiKey object', () => {
      const validKey: ApiKey = {
        id: 'key_123',
        label: 'Production Key',
        status: 'active',
        createdAt: '2023-01-01T00:00:00Z',
        expiresAt: '2024-01-01T00:00:00Z',
        scopes: ['read', 'write'],
        maskedKey: 'sk_live_...1234',
        rotationDue: '2023-12-15T00:00:00Z',
        snoozedAt: '2023-12-01T00:00:00Z'
      };

      expect(validKey.id).toBe('key_123');
      expect(validKey.status).toBe('active');
    });

    it('accepts a valid ApiKey object without optional fields', () => {
      const validKey: ApiKey = {
        id: 'key_456',
        label: 'Test Key',
        status: 'expired',
        createdAt: '2023-01-01T00:00:00Z',
        expiresAt: '2024-01-01T00:00:00Z',
        scopes: ['read'],
        maskedKey: 'sk_test_...5678'
      };

      expect(validKey.rotationDue).toBeUndefined();
      expect(validKey.snoozedAt).toBeUndefined();
    });

    it('fails on invalid inputs or missing required fields', () => {
      // @ts-expect-error missing required fields
      const missingFields: ApiKey = {
        id: 'key_123',
        label: 'Test'
      };
      
      // @ts-expect-error invalid type for scopes
      const invalidScopes: ApiKey = {
        id: 'key_123',
        label: 'Test Key',
        status: 'active',
        createdAt: '2023-01-01T00:00:00Z',
        expiresAt: '2024-01-01T00:00:00Z',
        scopes: 'read', // Should be array of strings
        maskedKey: 'sk_test_...5678'
      };
      
      expect(missingFields.id).toBe('key_123');
      expect(invalidScopes.scopes).toBe('read');
    });
  });

  describe('DependentUsage', () => {
    it('accepts a valid DependentUsage object', () => {
      const usage: DependentUsage = {
        name: 'Stripe webhook',
        lastSeenAt: '2023-10-01T12:00:00Z'
      };

      expect(usage.name).toBe('Stripe webhook');
    });

    it('fails on missing fields', () => {
      // @ts-expect-error missing lastSeenAt
      const invalidUsage: DependentUsage = {
        name: 'Stripe webhook'
      };
      
      expect(invalidUsage.name).toBe('Stripe webhook');
    });
  });
});
