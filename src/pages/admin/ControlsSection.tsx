import { useState, useEffect, useCallback, Component, ReactNode } from 'react'
import { Megaphone, AlertTriangle } from 'lucide-react'
import StaffPanel from '../../components/StaffPanel'
import { SectionCard, SectionProps } from './shared'

interface ControlsSectionProps extends SectionProps {
  currentUserRole?: string
}

interface PlatformFlag {
  key: string
  value: string
  label: string
  description: string
  updated_at: string
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(e: Error) {
    return { error: e.message }
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 20,
            background: '#2a1515',
            border: '1px solid #e05252',
            borderRadius: 10,
            color: '#e05252',
            fontSize: 13,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              Render error in Platform Controls
            </div>
            <code style={{ fontSize: 11, opacity: 0.85 }}>{this.state.error}</code>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function Toggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={enabled}
      style={{
        width: 40,
        height: 22,
        borderRadius: 20,
        border: 'none',
        background: enabled ? 'var(--color-brand)' : 'var(--color-border)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.2s',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: enabled ? 21 : 3,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  )
}

export default function ControlsSection({ authHeaders, currentUserRole }: ControlsSectionProps) {
  const [announcement, setAnnouncement] = useState('')
  const [announcementMsg, setAnnouncementMsg] = useState('')
  const [flags, setFlags] = useState<PlatformFlag[]>([])
  const [flagsLoading, setFlagsLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [flagMsg, setFlagMsg] = useState('')
  const [flagErr, setFlagErr] = useState('')

  const loadFlags = useCallback(async () => {
    setFlagsLoading(true)
    try {
      const res = await fetch('/api/admin/platform-settings', { headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const data = await res.json()
      setFlags(data.settings ?? [])
    } catch (e) {
      setFlagErr(e instanceof Error ? e.message : 'Failed to load feature flags')
    } finally {
      setFlagsLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    void loadFlags()
  }, [loadFlags])

  async function handleToggle(flag: PlatformFlag) {
    setToggling(flag.key)
    setFlagMsg('')
    setFlagErr('')
    const newValue = flag.value === 'true' ? 'false' : 'true'
    try {
      const res = await fetch(`/api/admin/platform-settings/${flag.key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ value: newValue }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      setFlags(prev => prev.map(f => (f.key === flag.key ? { ...f, value: newValue } : f)))
      setFlagMsg(`${flag.label} ${newValue === 'true' ? 'enabled' : 'disabled'}.`)
      setTimeout(() => setFlagMsg(''), 3000)
    } catch (e) {
      setFlagErr(e instanceof Error ? e.message : 'Failed to update flag')
    } finally {
      setToggling(null)
    }
  }

  function handleAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    if (!announcement.trim()) return
    setAnnouncementMsg('Announcement queued (integrate with notification system to dispatch).')
    setAnnouncement('')
    setTimeout(() => setAnnouncementMsg(''), 4000)
  }

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="Staff & Role Invites">
          <ErrorBoundary>
            <StaffPanel authHeaders={authHeaders} currentUserRole={currentUserRole} />
          </ErrorBoundary>
        </SectionCard>

        <SectionCard title="Feature Flags">
          {flagErr && (
            <p style={{ fontSize: 12, color: '#DC2626', margin: '0 0 12px' }}>{flagErr}</p>
          )}
          {flagMsg && (
            <p style={{ fontSize: 12, color: '#059669', margin: '0 0 12px' }}>{flagMsg}</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {flagsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 58,
                      borderRadius: 8,
                      background: 'var(--color-border)',
                      opacity: 0.4,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                ))
              : flags.map(flag => (
                  <div
                    key={flag.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: flag.value === 'true' ? 'rgba(232,93,4,0.06)' : 'var(--color-bg)',
                      borderRadius: 8,
                      border: `1px solid ${flag.value === 'true' ? 'rgba(232,93,4,0.25)' : 'var(--color-border)'}`,
                      gap: 16,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{flag.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {flag.description}
                      </div>
                    </div>
                    <Toggle
                      enabled={flag.value === 'true'}
                      onChange={() => void handleToggle(flag)}
                      disabled={toggling === flag.key}
                    />
                  </div>
                ))}
          </div>
        </SectionCard>

        <SectionCard title="Platform Announcement">
          <form
            onSubmit={handleAnnouncement}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <textarea
              value={announcement}
              onChange={e => setAnnouncement(e.target.value)}
              placeholder="Write a platform-wide announcement…"
              rows={4}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                resize: 'vertical',
                fontFamily: 'var(--font-sans)',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Megaphone size={13} /> Send Announcement
              </button>
              {announcementMsg && (
                <span style={{ fontSize: 12, color: '#059669' }}>{announcementMsg}</span>
              )}
            </div>
          </form>
        </SectionCard>
      </div>
    </ErrorBoundary>
  )
}
