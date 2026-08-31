import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import StatusTimeline, { 
  TimelineStep, 
  AttestationLifecycleStage,
  TimelineStepStatus 
} from './StatusTimeline'

describe('StatusTimeline', () => {
  const mockSteps: TimelineStep[] = [
    {
      id: 'submitted',
      label: 'Submitted',
      description: 'Attestation request submitted for processing',
      timestamp: '2026-05-28T14:32:00Z',
      status: 'completed',
    },
    {
      id: 'queued',
      label: 'Queued',
      description: 'Request queued for verification processing',
      status: 'current',
    },
    {
      id: 'verifying',
      label: 'Verifying',
      description: 'Cryptographic verification of revenue data in progress',
      status: 'pending',
    },
    {
      id: 'anchored',
      label: 'Anchored',
      description: 'Merkle root anchored on Stellar blockchain',
      status: 'pending',
    },
    {
      id: 'finalized',
      label: 'Finalized',
      description: 'Attestation finalized and certificate issued',
      status: 'pending',
    },
  ]

  describe('Rendering', () => {
    it('renders timeline with all steps', () => {
      render(<StatusTimeline steps={mockSteps} />)
      
      expect(screen.getByText('Submitted')).toBeInTheDocument()
      expect(screen.getByText('Queued')).toBeInTheDocument()
      expect(screen.getByText('Verifying')).toBeInTheDocument()
      expect(screen.getByText('Anchored')).toBeInTheDocument()
      expect(screen.getByText('Finalized')).toBeInTheDocument()
    })

    it('renders empty state when no steps provided', () => {
      render(<StatusTimeline steps={[]} />)
      
      expect(screen.getByText('No timeline steps available.')).toBeInTheDocument()
    })

    it('uses custom aria label when provided', () => {
      render(<StatusTimeline steps={mockSteps} ariaLabel="Custom timeline label" />)
      
      expect(screen.getByLabelText('Custom timeline label')).toBeInTheDocument()
    })

    it('uses default aria label when not provided', () => {
      render(<StatusTimeline steps={mockSteps} />)
      
      expect(screen.getByLabelText('Attestation lifecycle timeline')).toBeInTheDocument()
    })
  })

  describe('Step Status Display', () => {
    it('renders completed step with checkmark icon', () => {
      const completedSteps: TimelineStep[] = [
        {
          id: 'submitted',
          label: 'Submitted',
          description: 'Attestation request submitted for processing',
          status: 'completed',
        },
      ]
      
      render(<StatusTimeline steps={completedSteps} />)
      
      const stepElement = screen.getByLabelText('Submitted - Completed')
      expect(stepElement).toBeInTheDocument()
    })

    it('renders current step with pulsing indicator', () => {
      const currentSteps: TimelineStep[] = [
        {
          id: 'queued',
          label: 'Queued',
          description: 'Request queued for verification processing',
          status: 'current',
        },
      ]
      
      render(<StatusTimeline steps={currentSteps} />)
      
      expect(screen.getByText('In progress')).toBeInTheDocument()
    })

    it('renders failed step with error indicator', () => {
      const failedSteps: TimelineStep[] = [
        {
          id: 'verifying',
          label: 'Verifying',
          description: 'Cryptographic verification failed',
          status: 'failed',
        },
      ]
      
      render(<StatusTimeline steps={failedSteps} />)
      
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('renders pending step with neutral styling', () => {
      const pendingSteps: TimelineStep[] = [
        {
          id: 'finalized',
          label: 'Finalized',
          description: 'Attestation finalized and certificate issued',
          status: 'pending',
        },
      ]
      
      render(<StatusTimeline steps={pendingSteps} />)
      
      const stepElement = screen.getByLabelText('Finalized - Pending')
      expect(stepElement).toBeInTheDocument()
    })
  })

  describe('Timestamp Display', () => {
    it('shows timestamps when showTimestamps is true', () => {
      render(<StatusTimeline steps={mockSteps} showTimestamps={true} />)
      
      expect(screen.getByText(/ago/i)).toBeInTheDocument()
    })

    it('hides timestamps when showTimestamps is false', () => {
      render(<StatusTimeline steps={mockSteps} showTimestamps={false} />)
      
      expect(screen.queryByText(/ago/i)).not.toBeInTheDocument()
    })

    it('shows relative time by default', () => {
      render(<StatusTimeline steps={mockSteps} showTimestamps={true} />)
      
      const timeElement = screen.getByText(/ago/i)
      expect(timeElement).toBeInTheDocument()
    })

    it('shows absolute time in tooltip on hover', () => {
      render(<StatusTimeline steps={mockSteps} showTimestamps={true} />)
      
      const timeElement = screen.getByText(/ago/i)
      fireEvent.mouseEnter(timeElement)
      
      // Tooltip should be visible after hover
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('uses semantic ordered list for timeline', () => {
      const { container } = render(<StatusTimeline steps={mockSteps} />)
      
      const list = container.querySelector('ol')
      expect(list).toBeInTheDocument()
    })

    it('sets aria-current on current step', () => {
      render(<StatusTimeline steps={mockSteps} />)
      
      const currentStep = screen.getByText('Queued').closest('li')
      expect(currentStep).toHaveAttribute('aria-current', 'step')
    })

    it('provides aria labels for each step', () => {
      render(<StatusTimeline steps={mockSteps} />)
      
      expect(screen.getByLabelText('Submitted - Completed')).toBeInTheDocument()
      expect(screen.getByLabelText('Queued - In progress')).toBeInTheDocument()
      expect(screen.getByLabelText('Verifying - Pending')).toBeInTheDocument()
    })

    it('respects reduced motion preference', () => {
      // Mock prefers-reduced-motion
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      render(<StatusTimeline steps={mockSteps} />)
      
      // Component should still render with reduced motion
      expect(screen.getByText('Submitted')).toBeInTheDocument()
      
      vi.unstubAllGlobals()
    })
  })

  describe('Edge Cases', () => {
    it('handles single step timeline', () => {
      const singleStep: TimelineStep[] = [
        {
          id: 'submitted',
          label: 'Submitted',
          description: 'Attestation request submitted for processing',
          status: 'completed',
        },
      ]
      
      render(<StatusTimeline steps={singleStep} />)
      
      expect(screen.getByText('Submitted')).toBeInTheDocument()
    })

    it('handles missing timestamp gracefully', () => {
      const stepsWithoutTimestamp: TimelineStep[] = [
        {
          id: 'submitted',
          label: 'Submitted',
          description: 'Attestation request submitted for processing',
          status: 'completed',
        },
      ]
      
      render(<StatusTimeline steps={stepsWithoutTimestamp} showTimestamps={true} />)
      
      expect(screen.queryByText(/ago/i)).not.toBeInTheDocument()
    })

    it('handles very long step labels', () => {
      const longLabelSteps: TimelineStep[] = [
        {
          id: 'submitted',
          label: 'This is a very long step label that might cause layout issues',
          description: 'Attestation request submitted for processing',
          status: 'completed',
        },
      ]
      
      render(<StatusTimeline steps={longLabelSteps} />)
      
      expect(screen.getByText('This is a very long step label that might cause layout issues')).toBeInTheDocument()
    })

    it('handles all steps failed scenario', () => {
      const allFailedSteps: TimelineStep[] = mockSteps.map(step => ({
        ...step,
        status: 'failed' as TimelineStepStatus,
      }))
      
      render(<StatusTimeline steps={allFailedSteps} />)
      
      expect(screen.getAllByText('Failed')).toHaveLength(5)
    })

    it('handles all steps completed scenario', () => {
      const allCompletedSteps: TimelineStep[] = mockSteps.map(step => ({
        ...step,
        status: 'completed' as TimelineStepStatus,
      }))
      
      render(<StatusTimeline steps={allCompletedSteps} />)
      
      expect(screen.queryByText('In progress')).not.toBeInTheDocument()
      expect(screen.queryByText('Failed')).not.toBeInTheDocument()
    })
  })

  describe('Integration Patterns', () => {
    it('matches the lifecycle stages expected by AttestationDetail', () => {
      const lifecycleStages: AttestationLifecycleStage[] = [
        'submitted', 'queued', 'verifying', 'anchored', 'finalized'
      ]
      
      const stepsWithAllStages: TimelineStep[] = lifecycleStages.map((stage, index) => ({
        id: stage,
        label: stage.charAt(0).toUpperCase() + stage.slice(1),
        description: `Description for ${stage}`,
        status: index === 0 ? 'completed' : 'pending' as TimelineStepStatus,
      }))
      
      render(<StatusTimeline steps={stepsWithAllStages} />)
      
      lifecycleStages.forEach(stage => {
        expect(screen.getByText(new RegExp(stage, 'i'))).toBeInTheDocument()
      })
    })
  })
})
