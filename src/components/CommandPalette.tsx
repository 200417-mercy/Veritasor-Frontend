import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useToast } from './ToastContext'

type PaletteScope = 'global' | 'page'

const SCOPE_STORAGE_KEY = 'veritasor-palette-scope'
const PINNED_STORAGE_KEY = 'veritasor-pinned-commands'

export interface Command {
  id: string
  title: string
  description?: string
  shortcut?: string[]
  category: 'Navigation' | 'Actions' | 'Settings'
  /** Routes this command is relevant on — empty means always relevant */
  pageRoutes?: string[]
}

function loadScope(): PaletteScope {
  try {
    const stored = sessionStorage.getItem(SCOPE_STORAGE_KEY)
    if (stored === 'global' || stored === 'page') return stored
  } catch { /* ignore */ }
  return 'global'
}

function persistScope(scope: PaletteScope) {
  try {
    sessionStorage.setItem(SCOPE_STORAGE_KEY, scope)
  } catch { /* ignore */ }
}

export const COMMANDS: Command[] = [
  {
    id: 'nav-dashboard',
    title: 'Go to Dashboard',
    description: 'Navigate to the business dashboard analytics overview',
    shortcut: ['G', 'D'],
    category: 'Navigation',
    pageRoutes: ['/attestations', '/sources', '/settings', '/revenue-sources'],
  },
  {
    id: 'nav-attestations',
    title: 'Go to Attestations',
    description: 'View and manage revenue proof attestations',
    shortcut: ['G', 'A'],
    category: 'Navigation',
    pageRoutes: ['/', '/sources', '/settings', '/revenue-sources'],
  },
  {
    id: 'nav-sources',
    title: 'Go to Revenue Sources',
    description: 'View connected integrations and revenue flow',
    shortcut: ['G', 'S'],
    category: 'Navigation',
    pageRoutes: ['/', '/attestations', '/settings', '/revenue-sources'],
  },
  {
    id: 'action-workspace-jump',
    title: 'Quick-jump Workspace',
    description: 'Open workspace switcher in search mode for fast switching',
    shortcut: ['Ctrl', 'K', 'W'],
    category: 'Actions',
  },
  {
    id: 'action-connect-source',
    title: 'Connect Revenue Source',
    description: 'Integrate Stripe, Shopify, or other platforms',
    shortcut: ['C', 'S'],
    category: 'Actions',
    pageRoutes: ['/', '/sources', '/revenue-sources'],
  },
  {
    id: 'action-create-attestation',
    title: 'New Attestation',
    description: 'Trigger a new revenue proof attestation',
    shortcut: ['N', 'A'],
    category: 'Actions',
    pageRoutes: ['/', '/attestations'],
  },
  {
    id: 'action-toggle-theme',
    title: 'Toggle Theme',
    description: 'Switch between light and dark mode appearance',
    shortcut: ['T', 'T'],
    category: 'Actions',
  },
  {
    id: 'settings-profile',
    title: 'Profile Settings',
    description: 'Update user account preferences and initials',
    category: 'Settings',
  },
  {
    id: 'settings-api-keys',
    title: 'API Keys',
    description: 'Manage verification access keys and secrets',
    category: 'Settings',
  },
  {
    id: 'action-sign-out',
    title: 'Sign Out',
    description: 'Safely log out of the Veritasor dashboard',
    category: 'Settings',
  },
]

// Map commands to actions
const executeCommand = (
  id: string,
  navigate: ReturnType<typeof useNavigate>,
  addToast: ReturnType<typeof useToast>['addToast'],
  onWorkspaceJump?: () => void,
) => {
  switch (id) {
    case 'nav-dashboard':
      navigate('/')
      break
    case 'nav-attestations':
      navigate('/attestations')
      break
    case 'nav-sources':
      navigate('/sources')
      break
    case 'action-workspace-jump':
      onWorkspaceJump?.()
      break
    case 'action-connect-source':
      navigate('/sources?connect=true')
      break
    case 'action-create-attestation':
      navigate('/attestations?new=true')
      break
    case 'action-toggle-theme': {
      const current = document.documentElement.getAttribute('data-theme')
      const next = current === 'light' ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      addToast(`Theme switched to ${next} mode`, 'success')
      break
    }
    case 'settings-profile':
      addToast('Profile settings loaded', 'info')
      break
    case 'settings-api-keys':
      addToast('API keys loaded', 'info')
      break
    case 'action-sign-out':
      addToast('Signed out successfully', 'success')
      navigate('/login')
      break
    default:
      break
  }
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onWorkspaceJump?: () => void
}

export default function CommandPalette({ isOpen, onClose, onWorkspaceJump }: CommandPaletteProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useToast()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recents, setRecents] = useState<string[]>([])
  const [pinned, setPinned] = useState<string[]>([])
  const [scope, setScope] = useState<PaletteScope>(loadScope)

  const inputRef = useRef<HTMLInputElement>(null)
  const scopeRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load recents on mount and when palette opens
  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('veritasor-recent-commands')
      if (stored) {
        try {
          setRecents(JSON.parse(stored))
        } catch {
          setRecents([])
        }
      }
      setQuery('')
      setActiveIndex(0)
      setScope(loadScope)
      // Small timeout to ensure input is mounted
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  const handleScopeChange = useCallback((newScope: PaletteScope) => {
    setScope(newScope)
    persistScope(newScope)
    setActiveIndex(0)
  }, [])

  // Save a command as recent
  const togglePin = useCallback((id: string) => {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [id, ...prev]
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const saveToRecents = (id: string) => {
    const nextRecents = [id, ...recents.filter((r) => r !== id)].slice(0, 4)
    setRecents(nextRecents)
    localStorage.setItem('veritasor-recent-commands', JSON.stringify(nextRecents))
  }

  // Resolve the base path (strip trailing slash)
  const currentPath = location.pathname.replace(/\/$/, '') || '/'

  // Determine which commands are relevant for the current scope
  const scopeFiltered = useMemo(() => {
    if (scope === 'global') return COMMANDS
    return COMMANDS.filter((cmd) => {
      // Commands without pageRoutes are always relevant (theme toggle, sign out, settings)
      if (!cmd.pageRoutes || cmd.pageRoutes.length === 0) return true
      return cmd.pageRoutes.includes(currentPath)
    })
  }, [scope, currentPath])

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query) return scopeFiltered
    return scopeFiltered.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(query.toLowerCase()) ||
        (cmd.description && cmd.description.toLowerCase().includes(query.toLowerCase())),
    )
  }, [query, scopeFiltered])

  // Get recents mapped to command items
  const pinnedCommands = useMemo(() => {
    if (query) return []
    return pinned.map((id) => scopeFiltered.find((cmd) => cmd.id === id)).filter((cmd): cmd is Command => !!cmd)
  }, [pinned, query, scopeFiltered])

  const recentCommands = useMemo(() => {
    if (query) return []
    return recents
      .map((id) => scopeFiltered.find((cmd) => cmd.id === id))
      .filter((cmd): cmd is Command => !!cmd)
  }, [recents, query, scopeFiltered])

  // Construct a single flat list of visible items to easily manage active index
  const visibleItems = useMemo(() => {
    const items: (Command & { isRecent?: boolean; isPinned?: boolean })[] = []

    if (!query) {
      pinnedCommands.forEach((cmd) => items.push({ ...cmd, isPinned: true }))
      recentCommands.forEach((cmd) => {
        if (!pinnedCommands.some((p) => p.id === cmd.id))
          items.push({ ...cmd, isRecent: true })
      })
    }

    filteredCommands.forEach((cmd) => {
      const skip = !query && (pinnedCommands.some((p) => p.id === cmd.id) || recentCommands.some((r) => r.id === cmd.id))
      if (!skip) items.push(cmd)
    })

    return items
  }, [filteredCommands, pinnedCommands, recentCommands, query])

  // Reset active index when query/results change
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Scroll active element into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[aria-selected="true"]')
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [activeIndex])

  const handleSelect = (cmd: Command) => {
    saveToRecents(cmd.id)
    executeCommand(cmd.id, navigate, addToast, onWorkspaceJump)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (visibleItems.length ? (prev + 1) % visibleItems.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (visibleItems.length ? (prev - 1 + visibleItems.length) % visibleItems.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (visibleItems[activeIndex]) {
        handleSelect(visibleItems[activeIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Tab') {
      // Tab moves focus between scope switcher and input within the palette
      e.preventDefault()
      if (document.activeElement === inputRef.current) {
        scopeRef.current?.focus()
      } else {
        inputRef.current?.focus()
      }
    }
  }

  // Handle clicking outside modal
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  // Categorize visible items for rendering
  const renderedSections = (() => {
    const sections: { title: string; items: typeof visibleItems }[] = []

    if (!query && pinnedCommands.length > 0) {
      sections.push({
        title: 'Pinned',
        items: visibleItems.filter((i) => i.isPinned),
      })
    }
    if (!query && recentCommands.length > 0) {
      sections.push({
        title: 'Recent',
        items: visibleItems.filter((i) => i.isRecent),
      })
    }

    const mainItems = visibleItems.filter((i) => !i.isRecent)
    const categories = ['Navigation', 'Actions', 'Settings'] as const

    categories.forEach((cat) => {
      const catItems = mainItems.filter((i) => i.category === cat)
      if (catItems.length > 0) {
        sections.push({ title: cat, items: catItems })
      }
    })

    return sections
  })()

  // Track global index in rendering
  let itemCounter = 0

  const activeOptionId = visibleItems[activeIndex]
    ? `cmd-opt-${visibleItems[activeIndex].id}${visibleItems[activeIndex].isRecent ? '-recent' : ''}`
    : undefined

  return (
    <div
      className="cmd-overlay"
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        className="cmd-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Scope segmented control */}
        <div
          ref={scopeRef}
          role="radiogroup"
          aria-label="Palette scope"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault()
              const next = scope === 'global' ? 'page' : 'global'
              handleScopeChange(next)
            }
          }}
          style={{
            display: 'flex',
            gap: 0,
            padding: '0.25rem 0.75rem',
            borderBottom: '1px solid var(--border, rgba(148,163,184,0.25))',
          }}
        >
          {(['global', 'page'] as const).map((s) => {
            const isActive = scope === s
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleScopeChange(s)}
                style={{
                  flex: 1,
                  padding: '0.35rem 0.75rem',
                  border: 'none',
                  borderRadius: 6,
                  background: isActive ? 'var(--accent, #5eead4)' : 'transparent',
                  color: isActive ? '#04111f' : 'var(--muted, #94a3b8)',
                  fontWeight: isActive ? 700 : 400,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'background 120ms, color 120ms',
                }}
              >
                {s === 'global' ? '🌐 Global' : '📄 This page'}
              </button>
            )
          })}
        </div>
        <div className="cmd-search-wrapper">
          <span className="cmd-search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Search dashboard navigation, actions, and settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={true}
            aria-autocomplete="list"
            aria-controls="cmd-list"
            aria-activedescendant={activeOptionId}
          />
          <span className="cmd-esc-badge" aria-hidden="true">
            ESC
          </span>
        </div>

        <div className="cmd-results" ref={listRef} id="cmd-list" role="listbox" aria-label="Commands">
          {visibleItems.length === 0 ? (
            <div className="cmd-empty">
              <span className="cmd-empty-icon" aria-hidden="true">
                📭
              </span>
              <p className="cmd-empty-title">No results found for "{query}"</p>
              <p className="cmd-empty-subtitle">Try searching for dashboard, attestations, themes, or integrations.</p>
            </div>
          ) : (
            renderedSections.map((section) => (
              <div key={section.title} className="cmd-group" role="presentation">
                <h3 className="cmd-group-title" role="presentation">
                  {section.title}
                </h3>
                <ul className="cmd-group-list" role="presentation">
                  {section.items.map((cmd) => {
                    const currentIdx = itemCounter
                    itemCounter++
                    const isActive = currentIdx === activeIndex
                    const itemId = `cmd-opt-${cmd.id}${cmd.isRecent ? '-recent' : ''}`

                    return (
                      <li
                        key={itemId}
                        id={itemId}
                        role="option"
                        aria-selected={isActive}
                        className={`cmd-item${isActive ? ' cmd-item-active' : ''}`}
                        onClick={() => handleSelect(cmd)}
                        onMouseEnter={() => setActiveIndex(currentIdx)}
                      >
                        <div className="cmd-item-icon" aria-hidden="true">
                          {cmd.category === 'Navigation' ? '🧭' : cmd.id === 'action-toggle-theme' ? '🌓' : '⚡'}
                        </div>
                        <div className="cmd-item-content">
                          <span className="cmd-item-title">{cmd.title}</span>
                          {cmd.description && <span className="cmd-item-desc">{cmd.description}</span>}
                        </div>
                        <button
                          type="button"
                          className="cmd-pin-btn"
                          onClick={(e) => { e.stopPropagation(); togglePin(cmd.id); }}
                          aria-label={pinned.includes(cmd.id) ? 'Unpin' : 'Pin'}
                          aria-pressed={pinned.includes(cmd.id)}
                          title={pinned.includes(cmd.id) ? 'Unpin' : 'Pin'}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '2px 4px', fontSize: '0.9rem',
                            opacity: pinned.includes(cmd.id) ? 1 : 0.3,
                            transition: 'opacity 120ms',
                          }}
                        >{pinned.includes(cmd.id) ? '📌' : '📌'}</button>
                        {cmd.shortcut && (
                          <div className="cmd-item-shortcut" aria-hidden="true">
                            {cmd.shortcut.map((key, idx) => (
                              <kbd key={`${key}-${idx}`}>{key}</kbd>
                            ))}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="cmd-footer" aria-hidden="true">
          <div className="cmd-tip">
            <kbd>↑↓</kbd> <span>Navigate</span>
          </div>
          <div className="cmd-tip">
            <kbd>Enter</kbd> <span>Select</span>
          </div>
          <div className="cmd-tip">
            <kbd>Esc</kbd> <span>Close</span>
          </div>
          <div className="cmd-tip">
            <kbd>Ctrl</kbd><kbd>K</kbd><kbd>W</kbd> <span>Workspaces</span>
          </div>
        </div>
      </div>
    </div>
  )
}
