import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TokensDiffViewer, { getTokenDiff, type Token } from './TokensDiffViewer'

describe('TokensDiffViewer', () => {
  describe('getTokenDiff', () => {
    it('returns empty array when there are no differences', () => {
      const tokens: Token[] = [{ name: '--color-brand', category: 'Color', value: '#000' }]
      expect(getTokenDiff(tokens, tokens)).toEqual([])
    })

    it('identifies added tokens', () => {
      const previous: Token[] = []
      const current: Token[] = [{ name: '--color-brand', category: 'Color', value: '#000' }]
      expect(getTokenDiff(previous, current)).toEqual([
        { name: '--color-brand', category: 'Color', value: '#000', status: 'Added', currentValue: '#000' },
      ])
    })

    it('identifies removed tokens', () => {
      const previous: Token[] = [{ name: '--color-brand', category: 'Color', value: '#000' }]
      const current: Token[] = []
      expect(getTokenDiff(previous, current)).toEqual([
        { name: '--color-brand', category: 'Color', value: '#000', status: 'Removed', previousValue: '#000' },
      ])
    })

    it('identifies changed tokens', () => {
      const previous: Token[] = [{ name: '--color-brand', category: 'Color', value: '#000' }]
      const current: Token[] = [{ name: '--color-brand', category: 'Color', value: '#fff' }]
      expect(getTokenDiff(previous, current)).toEqual([
        { name: '--color-brand', category: 'Color', value: '#fff', status: 'Changed', previousValue: '#000', currentValue: '#fff' },
      ])
    })

    it('sorts the output by token name alphabetically', () => {
      const previous: Token[] = [{ name: '--z-index', category: 'Spacing', value: '1' }]
      const current: Token[] = [{ name: '--a-index', category: 'Spacing', value: '2' }]
      const diff = getTokenDiff(previous, current)
      expect(diff[0].name).toBe('--a-index')
      expect(diff[1].name).toBe('--z-index')
    })
    
    it('handles empty arrays', () => {
      expect(getTokenDiff([], [])).toEqual([])
    })
  })

  describe('TokensDiffViewer Component', () => {
    it('renders with default theme selections and displays differences', () => {
      render(<TokensDiffViewer />)
      
      expect(screen.getByRole('heading', { name: /Compare theme tokens/i })).toBeInTheDocument()
      
      // Default version 2.3 vs 2.4 diffs should be visible
      expect(screen.getByText(/--color-brand/i)).toBeInTheDocument()
      expect(screen.getByText(/--color-focus-ring/i)).toBeInTheDocument() // added
      expect(screen.getByText(/--radius-pill/i)).toBeInTheDocument() // removed
    })

    it('allows changing the versions to compare', () => {
      render(<TokensDiffViewer />)
      
      const earlierSelect = screen.getByRole('combobox', { name: /Earlier theme version/i })
      const laterSelect = screen.getByRole('combobox', { name: /Later theme version/i })
      
      // Compare 2.3 to 2.3 (should be no differences)
      fireEvent.change(laterSelect, { target: { value: '2.3' } })
      
      expect(screen.getByText(/0 differences shown/i)).toBeInTheDocument()
      expect(screen.getByText(/No differences match this category/i)).toBeInTheDocument()
      
      // Change earlier to 2.4, later to 2.3
      fireEvent.change(earlierSelect, { target: { value: '2.4' } })
      
      expect(screen.getByText(/--color-focus-ring/i)).toBeInTheDocument()
      // Now it's removed instead of added
      const focusRingRow = screen.getByText(/--color-focus-ring/i).closest('[role="row"]')
      expect(focusRingRow).toHaveTextContent(/Removed/i)
    })

    it('filters by category', () => {
      render(<TokensDiffViewer />)
      
      const categorySelect = screen.getByRole('combobox', { name: /Filter diff by token category/i })
      
      // Filter by Typography
      fireEvent.change(categorySelect, { target: { value: 'Typography' } })
      
      expect(screen.getByText(/--text-body/i)).toBeInTheDocument()
      expect(screen.queryByText(/--color-brand/i)).not.toBeInTheDocument()
      
      // Change to a category with no diffs (if any) or observe correct count
      fireEvent.change(categorySelect, { target: { value: 'Spacing' } })
      expect(screen.getByText(/--space-6/i)).toBeInTheDocument() // Added in 2.4
    })
  })
})
