import { useCallback } from 'react'

export interface Integration {
  id: string
  name: string
  description: string
  icon: string
  status: 'connected' | 'available' | 'error'
  statusText: string
}

interface IntegrationCardProps {
  integration: Integration
  onConfigure?: (id: string) => void
  onConnect?: (id: string) => void
  onDisconnect?: (id: string) => void
}

const chipColors: Record<Integration['status'], { bg: string; text: string; dot: string }> = {
  connected: { bg: 'var(--success-soft)', text: 'var(--success)', dot: 'var(--success)' },
  available: { bg: 'var(--surface-soft)', text: 'var(--muted)', dot: 'var(--muted)' },
  error: { bg: 'var(--danger-soft)', text: 'var(--danger)', dot: 'var(--danger)' },
}

export default function IntegrationCard({
  integration,
  onConfigure,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  const { id, name, description, icon, status, statusText } = integration
  // Fall back to the neutral palette for statuses outside the documented union
  // so an unexpected API payload degrades gracefully instead of crashing the
  // whole integrations view on `colors.bg`.
  const colors = chipColors[status] ?? chipColors.available

  const handleConfigure = useCallback(() => onConfigure?.(id), [id, onConfigure])
  const handleConnect = useCallback(() => onConnect?.(id), [id, onConnect])
  const handleDisconnect = useCallback(() => onDisconnect?.(id), [id, onDisconnect])

  const isConnected = status === 'connected'

  return (
    <article
      role="article"
      aria-label={`${name} integration`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gridTemplateRows: 'auto auto',
        gap: '0.6rem 1rem',
        padding: 'var(--density-padding)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        alignItems: 'center',
      }}
    >
      {/* Icon */}
      <div
        aria-hidden="true"
        style={{
          gridRow: '1 / 3',
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'var(--surface-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.3rem',
          border: '1px solid var(--border)',
        }}
      >
        {icon}
      </div>

      {/* Name + description */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>{name}</div>
        <div style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginTop: '0.15rem' }}>
          {description}
        </div>
      </div>

      {/* Status chip */}
      <div
        role="status"
        aria-label={`Status: ${statusText}`}
        style={{
          gridRow: '1 / 2',
          justifySelf: 'end',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: 'var(--density-badge-padding)',
          borderRadius: 6,
          fontSize: 'var(--density-badge-font)',
          fontWeight: 500,
          background: colors.bg,
          color: colors.text,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: colors.dot,
            display: 'inline-block',
          }}
        />
        {statusText}
      </div>

      {/* Actions */}
      <div style={{ gridColumn: '3 / 4', gridRow: '2 / 3', justifySelf: 'end' }}>
        {isConnected ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              aria-label={`Configure ${name}`}
              onClick={handleConfigure}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.4,
              }}
            >
              Configure
            </button>
            <button
              type="button"
              aria-label={`Disconnect ${name}`}
              onClick={handleDisconnect}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 6,
                border: '1px solid var(--danger)',
                background: 'transparent',
                color: 'var(--danger)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.4,
              }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Connect ${name}`}
            onClick={handleConnect}
            style={{
              padding: '0.35rem 0.9rem',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent)',
              color: '#04111f',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.4,
            }}
          >
            Connect
          </button>
        )}
      </div>
    </article>
  )
}
