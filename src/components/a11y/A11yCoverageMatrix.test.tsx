import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import A11yCoverageMatrix from './A11yCoverageMatrix'
import { WCAG_CRITERIA, COMPONENT_COVERAGE } from './A11yCoverageMatrix'

describe('A11yCoverageMatrix', () => {
  it('renders the section with an aria label', () => {
    render(<A11yCoverageMatrix />)
    expect(
      screen.getByRole('region', { name: /component-coverage matrix/i }),
    ).toBeInTheDocument()
  })

  it('renders the heading', () => {
    render(<A11yCoverageMatrix />)
    expect(
      screen.getByRole('heading', { level: 2, name: /component-coverage matrix/i }),
    ).toBeInTheDocument()
  })

  it('renders a table with component names', () => {
    render(<A11yCoverageMatrix />)
    for (const comp of COMPONENT_COVERAGE) {
      expect(
        screen.getByRole('rowheader', { name: comp.component }),
      ).toBeInTheDocument()
    }
  })

  it('renders all WCAG criterion columns', () => {
    render(<A11yCoverageMatrix />)
    // Column headers are rendered as table header cells
    for (const c of WCAG_CRITERIA) {
      // Headers use sr-only for the full label and aria-hidden for the SC number
      expect(screen.getByText(c.sc)).toBeInTheDocument()
    }
  })

  it('shows the global summary strip with coverage counts', () => {
    render(<A11yCoverageMatrix />)
    expect(
      screen.getByText(/criteria automated/i),
    ).toBeInTheDocument()
  })

  it('renders summary coverage per component', () => {
    render(<A11yCoverageMatrix />)
    // Each row should have a coverage summary like "5/12 (42%)"
    for (const comp of COMPONENT_COVERAGE) {
      const cellText = Object.values(comp.criteria).filter(
        (v) => v === 'automated',
      ).length
      const totalText = Object.keys(comp.criteria).length
      const pct = Math.round((cellText / totalText) * 100)
      expect(
        screen.getByText(new RegExp(`${cellText}/${totalText}`)),
      ).toBeInTheDocument()
    }
  })

  it('renders a legend for status chips', () => {
    render(<A11yCoverageMatrix />)
    expect(screen.getByText(/automated — covered by axe-core/i)).toBeInTheDocument()
    expect(screen.getByText(/manual — requires human review/i)).toBeInTheDocument()
  })

  it('renders a footer summary row', () => {
    render(<A11yCoverageMatrix />)
    expect(screen.getByRole('rowheader', { name: /total/i })).toBeInTheDocument()
  })

  it('renders with custom component data', () => {
    const customData = [
      {
        component: 'CustomTest',
        criteria: { '1.1.1': 'automated' as const },
      },
    ]
    render(<A11yCoverageMatrix components={customData} />)
    expect(
      screen.getByRole('rowheader', { name: /customtest/i }),
    ).toBeInTheDocument()
  })

  it('computes global automated percentage correctly', () => {
    render(<A11yCoverageMatrix />)
    let auto = 0, total = 0
    for (const comp of COMPONENT_COVERAGE) {
      for (const v of Object.values(comp.criteria)) {
        if (v === 'automated') auto++
        total++
      }
    }
    const pct = Math.round((auto / total) * 100)
    expect(
      screen.getByText(new RegExp(`${pct}%`)),
    ).toBeInTheDocument()
  })

  describe('Type Contracts and Data structures', () => {
    it('validates WCAG_CRITERIA matches WcagCriterion contract', () => {
      expect(WCAG_CRITERIA.length).toBeGreaterThan(0)
      for (const criterion of WCAG_CRITERIA) {
        expect(criterion).toHaveProperty('id')
        expect(criterion).toHaveProperty('sc')
        expect(criterion).toHaveProperty('label')
        expect(criterion).toHaveProperty('level')
        expect(['A', 'AA', 'AAA']).toContain(criterion.level)
      }
    })

    it('validates COMPONENT_COVERAGE matches ComponentCoverage contract', () => {
      expect(COMPONENT_COVERAGE.length).toBeGreaterThan(0)
      for (const comp of COMPONENT_COVERAGE) {
        expect(comp).toHaveProperty('component')
        expect(comp).toHaveProperty('criteria')
        for (const [key, method] of Object.entries(comp.criteria)) {
          expect(typeof key).toBe('string')
          expect(['automated', 'manual', 'partial', 'none']).toContain(method)
        }
      }
    })
  })

  describe('Boundary and Invalid Inputs', () => {
    it('handles empty components array without crashing', () => {
      render(<A11yCoverageMatrix components={[]} />)
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
      expect(screen.getByText(/0\/0 criteria automated/i)).toBeInTheDocument()
    })

    it('handles components with empty criteria', () => {
      const customData = [{ component: 'EmptyComp', criteria: {} }]
      render(<A11yCoverageMatrix components={customData} />)
      expect(screen.getByRole('rowheader', { name: 'EmptyComp' })).toBeInTheDocument()
      expect(screen.getByText(/0\/0/)).toBeInTheDocument()
    })

    it('handles missing components prop (uses default)', () => {
      render(<A11yCoverageMatrix components={undefined} />)
      expect(screen.getByRole('rowheader', { name: 'Button' })).toBeInTheDocument()
    })

    it('handles unexpected criterion test method gracefully', () => {
      const customData = [{ 
        component: 'BadMethodComp', 
        criteria: { '1.1.1': 'unknown-method' as any } 
      }]
      render(<A11yCoverageMatrix components={customData} />)
      expect(screen.getByRole('rowheader', { name: 'BadMethodComp' })).toBeInTheDocument()
    })
  })
})
