// Focused tests for getStepStatus utility in AttestationProgress
import { describe, it, expect } from 'vitest';
import { getStepStatus } from './AttestationProgress';

type AttestationPhase = 'idle' | 'running' | 'complete' | 'canceled';

describe('getStepStatus', () => {
  it('returns "completed" when previous step (index+1) is less than activeStep', () => {
    const result = getStepStatus(0, 3, 'idle');
    expect(result).toBe('completed');
  });

  it('returns "active" when current step matches activeStep and phase is running', () => {
    const result = getStepStatus(1, 2, 'running');
    expect(result).toBe('active');
  });

  it('returns "pending" for future steps when not completed or active', () => {
    const result = getStepStatus(4, 3, 'idle');
    expect(result).toBe('pending');
  });

  it('returns "completed" for any step when phase is complete', () => {
    const result = getStepStatus(2, 1, 'complete');
    expect(result).toBe('completed');
  });
});
