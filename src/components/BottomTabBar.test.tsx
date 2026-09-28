import { MemoryRouter } from 'react-router-dom'
import { IntlProvider } from 'react-intl'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import BottomTabBar from './BottomTabBar'
import Layout from './Layout'
import { CookieConsentProvider } from './CookieConsentContext'

const MESSAGES = {
  'nav.bottomTabBar': 'Mobile navigation',
}

function renderWithRouter(ui: React.ReactElement, { initialEntries = ['/'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <IntlProvider locale="en" messages={MESSAGES}>
        <CookieConsentProvider>{ui}</CookieConsentProvider>
      </IntlProvider>
    </MemoryRouter>,
  )
}

// ─── BottomTabBar ────────────────────────────────────────────────

describe('BottomTabBar', () => {
  describe('rendering', () => {
    it('renders a navigation element with accessible label', () => {
      renderWithRouter(<BottomTabBar />)
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('renders all four tab items', () => {
      renderWithRouter(<BottomTabBar />)
      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /attestations/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /sources/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
    })

    it('renders visible text labels for all tabs', () => {
      renderWithRouter(<BottomTabBar />)
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Attestations')).toBeInTheDocument()
      expect(screen.getByText('Sources')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('renders SVG icons inside each tab', () => {
      renderWithRouter(<BottomTabBar />)
      const icons = document.querySelectorAll('.bottom-tab-icon svg')
      expect(icons.length).toBe(4)
    })

    it('SVG icons have aria-hidden="true"', () => {
      renderWithRouter(<BottomTabBar />)
      const svgs = document.querySelectorAll('.bottom-tab-icon svg[aria-hidden="true"]')
      expect(svgs.length).toBe(4)
    })

    it('has bottom-tab-bar container', () => {
      renderWithRouter(<BottomTabBar />)
      expect(document.querySelector('.bottom-tab-bar')).toBeInTheDocument()
    })

    it('has bottom-tab-bar-track container', () => {
      renderWithRouter(<BottomTabBar />)
      expect(document.querySelector('.bottom-tab-bar-track')).toBeInTheDocument()
    })

    it('each tab has bottom-tab class', () => {
      renderWithRouter(<BottomTabBar />)
      const tabs = document.querySelectorAll('.bottom-tab')
      expect(tabs.length).toBe(4)
    })
  })

  describe('router sync — active state', () => {
    it('Dashboard tab has bottom-tab-active class at /dashboard', () => {
      renderWithRouter(<BottomTabBar />, { initialEntries: ['/dashboard'] })
      const dashboardTab = screen.getByRole('link', { name: /home/i })
      expect(dashboardTab).toHaveClass('bottom-tab-active')
    })

    it('Attestations tab has bottom-tab-active class at /attestations', () => {
      renderWithRouter(<BottomTabBar />, { initialEntries: ['/attestations'] })
      const attestationsTab = screen.getByRole('link', { name: /attestations/i })
      expect(attestationsTab).toHaveClass('bottom-tab-active')
    })

    it('Sources tab has bottom-tab-active class at /sources', () => {
      renderWithRouter(<BottomTabBar />, { initialEntries: ['/sources'] })
      const sourcesTab = screen.getByRole('link', { name: /sources/i })
      expect(sourcesTab).toHaveClass('bottom-tab-active')
    })

    it('Settings tab has bottom-tab-active class at /settings', () => {
      renderWithRouter(<BottomTabBar />, { initialEntries: ['/settings'] })
      const settingsTab = screen.getByRole('link', { name: /settings/i })
      expect(settingsTab).toHaveClass('bottom-tab-active')
    })

    it('only one tab is active at a time', () => {
      renderWithRouter(<BottomTabBar />, { initialEntries: ['/attestations'] })
      const activeTabs = document.querySelectorAll('.bottom-tab-active')
      expect(activeTabs.length).toBe(1)
    })

    it('inactive tabs do not have bottom-tab-active class', () => {
      renderWithRouter(<BottomTabBar />, { initialEntries: ['/dashboard'] })
      const attestationsTab = screen.getByRole('link', { name: /attestations/i })
      expect(attestationsTab).not.toHaveClass('bottom-tab-active')
    })

    it('Dashboard tab is not active at /attestations', () => {
      renderWithRouter(<BottomTabBar />, { initialEntries: ['/attestations'] })
      const dashboardTab = screen.getByRole('link', { name: /home/i })
      expect(dashboardTab).not.toHaveClass('bottom-tab-active')
    })
  })

  describe('accessibility', () => {
    it('navigation landmark exists', () => {
      renderWithRouter(<BottomTabBar />)
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('each tab link is accessible by visible text', () => {
      renderWithRouter(<BottomTabBar />)
      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /attestations/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /sources/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
    })

    it('active tab link has aria-current="page"', () => {
      renderWithRouter(<BottomTabBar />, { initialEntries: ['/dashboard'] })
      expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('aria-current', 'page')
    })

    it('inactive tab links do not have aria-current attribute', () => {
      renderWithRouter(<BottomTabBar />, { initialEntries: ['/dashboard'] })
      expect(screen.getByRole('link', { name: /attestations/i })).not.toHaveAttribute('aria-current')
    })

    it('icon wrapper spans have aria-hidden="true"', () => {
      renderWithRouter(<BottomTabBar />)
      const iconSpans = document.querySelectorAll('.bottom-tab-icon[aria-hidden="true"]')
      expect(iconSpans.length).toBe(4)
    })

    it('active tab link has href matching its path', () => {
      renderWithRouter(<BottomTabBar />, { initialEntries: ['/dashboard'] })
      const dashboardTab = screen.getByRole('link', { name: /home/i })
      expect(dashboardTab).toHaveAttribute('href', '/dashboard')
    })

    it('each tab renders as a link element', () => {
      renderWithRouter(<BottomTabBar />)
      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /attestations/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /sources/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
    })
  })

  describe('navigation', () => {
    it('Sources link has href /sources', () => {
      renderWithRouter(<BottomTabBar />)
      expect(screen.getByRole('link', { name: /sources/i })).toHaveAttribute('href', '/sources')
    })

    it('Settings link has href /settings', () => {
      renderWithRouter(<BottomTabBar />)
      expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
    })

    it('Attestations link has href /attestations', () => {
      renderWithRouter(<BottomTabBar />)
      expect(screen.getByRole('link', { name: /attestations/i })).toHaveAttribute('href', '/attestations')
    })
  })
  describe('error boundaries', () => {
    it('throws an error when rendered outside of a router context', () => {
      const consoleError = console.error;
      console.error = () => {};

      expect(() => render(<BottomTabBar />)).toThrowError(
        /useHref\(\) may be used only in the context of a <Router> component/i
      );

      console.error = consoleError;
    })
  })
})

// ─── Layout integration ──────────────────────────────────────────

describe('Layout with BottomTabBar', () => {
  it('renders bottom tab bar within the layout', () => {
    renderWithRouter(<Layout />)
    expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeInTheDocument()
  })

  it('bottom tab bar has bottom-tab-bar class when rendered in layout', () => {
    renderWithRouter(<Layout />)
    expect(document.querySelector('.bottom-tab-bar')).toBeInTheDocument()
  })
})