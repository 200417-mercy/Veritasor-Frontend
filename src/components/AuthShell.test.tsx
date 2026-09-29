import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthShell from './AuthShell'

describe('AuthShell', () => {
  const defaultProps = {
    eyebrow: 'Secure Access',
    title: 'Welcome Back',
    description: 'Please log in to continue.',
    footerPrompt: 'New here?',
    footerLinkLabel: 'Create an account',
    footerLinkHref: '/signup',
    sideTitle: 'Veritasor Identity',
    sideDescription: 'Secure your workflow',
    sideHighlights: ['SSO', 'MFA', 'Audit Logs'],
  }

  it('renders all structural shell components and content', () => {
    render(
      <MemoryRouter>
        <AuthShell {...defaultProps}>
          <div data-testid="test-child">Child Content</div>
        </AuthShell>
      </MemoryRouter>
    )

    expect(screen.getByRole('complementary', { name: /authentication overview/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /veritasor/i })).toHaveAttribute('href', '/')
    expect(screen.getByText(defaultProps.sideTitle)).toBeInTheDocument()
    expect(screen.getByText(defaultProps.sideDescription)).toBeInTheDocument()
    
    defaultProps.sideHighlights.forEach(highlight => {
      expect(screen.getByText(highlight)).toBeInTheDocument()
    })

    expect(screen.getByRole('region', { name: defaultProps.title })).toBeInTheDocument()
    
    expect(screen.getAllByText(defaultProps.eyebrow)).toHaveLength(2)

    expect(screen.getByRole('heading', { level: 2, name: defaultProps.title })).toBeInTheDocument()
    expect(screen.getByText(defaultProps.description)).toBeInTheDocument()

    expect(screen.getByTestId('test-child')).toBeInTheDocument()

    expect(screen.getByText(new RegExp(defaultProps.footerPrompt))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: defaultProps.footerLinkLabel })).toHaveAttribute('href', defaultProps.footerLinkHref)
  })

  it('handles empty highlights array gracefully', () => {
    render(
      <MemoryRouter>
        <AuthShell {...defaultProps} sideHighlights={[]}>
          <div>Child Content</div>
        </AuthShell>
      </MemoryRouter>
    )
    
    const list = screen.getByRole('list')
    expect(list.children).toHaveLength(0)
  })

  it('renders correctly with minimal empty props', () => {
    render(
      <MemoryRouter>
        <AuthShell 
          eyebrow=""
          title=""
          description=""
          footerPrompt=""
          footerLinkLabel=""
          footerLinkHref="/"
          sideTitle=""
          sideDescription=""
          sideHighlights={[]}
        >
          <div />
        </AuthShell>
      </MemoryRouter>
    )

    expect(screen.getByRole('complementary', { name: /authentication overview/i })).toBeInTheDocument()
  })
})
