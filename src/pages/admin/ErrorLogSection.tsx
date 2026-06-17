import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronUp, Circle } from 'lucide-react'
import { SectionCard, SectionProps } from './shared'

interface ErrorEntry {
  id: string
  timestamp: string
  context: string
  source: 'supabase' | 'stripe' | 'network' | 'client' | 'server'
  message: string
  detail: string | null
  stack: string | null
  userId: string | null
  route: string | null
  method: string | null
  statusCode: number | null
}

const CONTEXT_COLORS: Record<string, string> = {
  post: '#e05252',
  upload: '#e07c3a',
  onboarding: '#e0c23a',
  auth: '#9b6fe0',
  sms: '#3abfe0',
  stripe: '#5271e0',
  admin: '#e052a0',
  server: '#aaa',
}

const SOURCE_META: Record<string, { label: string; color: string; description: string }> = {
  supabase: {
    label: 'Supabase',
    color: '#3ecf8e',
    description: 'Database, auth, or storage error from Supabase / PostgREST.',
  },
  stripe: {
    label: 'Stripe',
    color: '#5271e0',
    description: 'Stripe API call failed — payment, webhook, or subscription error.',
  },
  network: {
    label: 'Network',
    color: '#e0a03a',
    description: 'External fetch failed — DNS, timeout, or connection refused. May indicate an infrastructure issue.',
  },
  client: {
    label: 'Client',
    color: '#aaa',
    description: '4xx error — bad request, missing auth, or not found. Caused by the caller, not the server.',
  },
  server: {
    label: 'Server',
    color: '#e05252',
    description: 'Node / Express error — uncaught exception, middleware failure, or 5xx response.',
  },
}

export default function ErrorLogSection({ authHeaders }: SectionProps) {
  const [entries, setEntries] = useState<ErrorEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [contextFilter, setContextFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (contextFilter !== 'all') params.set('context', contextFilter)
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      const qs = params.toString() ? `?${params}` : ''
      const res = await fetch(`/api/admin/error-log${qs}`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setEntries(data.items ?? [])
        setTotal(data.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [contextFilter, sourceFilter])

  useEffect(() => {
    void load()
  }, [load])

  async function handleClear() {
    setClearing(true)
    await fetch('/api/admin/error-log', { method: 'DELETE', headers: authHeaders() })
    setEntries([])
    setTotal(0)
    setClearing(false)
    setConfirmClear(false)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const contexts = ['all', ...Array.from(new Set(entries.map(e => e.context)))]
  const sources = Object.keys(SOURCE_META)

  // Count entries per source for the filter badges
  const sourceCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.source ?? 'server'] = (acc[e.source ?? 'server'] ?? 0) + 1
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionCard
        title={`Error Log — ${total} recorded`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => void load()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--color-text)',
              }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
            {confirmClear ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Clear all logs?
                </span>
                <button
                  onClick={() => void handleClear()}
                  disabled={clearing}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    background: '#e05252',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: '#fff',
                    opacity: clearing ? 0.6 : 1,
                  }}
                >
                  {clearing ? 'Clearing…' : 'Yes, clear'}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  disabled={clearing}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={entries.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: entries.length === 0 ? 'var(--color-bg)' : '#e0525220',
                  border: `1px solid ${entries.length === 0 ? 'var(--color-border)' : '#e05252'}`,
                  borderRadius: 6,
                  cursor: entries.length === 0 ? 'not-allowed' : 'pointer',
                  color: entries.length === 0 ? 'var(--color-text-muted)' : '#e05252',
                }}
              >
                <Trash2 size={13} /> Clear All
              </button>
            )}
          </div>
        }
      >
        {/* Context filter */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: 4 }}>Area</span>
          {contexts.map(ctx => (
            <button
              key={ctx}
              onClick={() => setContextFilter(ctx)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                background:
                  contextFilter === ctx
                    ? (CONTEXT_COLORS[ctx] ?? 'var(--color-brand)')
                    : 'var(--color-bg)',
                color: contextFilter === ctx ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {ctx}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: 4 }}>Source</span>
          <button
            onClick={() => setSourceFilter('all')}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              background: sourceFilter === 'all' ? 'var(--color-brand)' : 'var(--color-bg)',
              color: sourceFilter === 'all' ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            ALL
          </button>
          {sources.map(src => {
            const meta = SOURCE_META[src]
            const count = sourceCounts[src] ?? 0
            const active = sourceFilter === src
            return (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                title={meta.description}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 20,
                  border: `1px solid ${active ? meta.color : 'transparent'}`,
                  cursor: 'pointer',
                  background: active ? `${meta.color}25` : 'var(--color-bg)',
                  color: active ? meta.color : 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {meta.label}
                {count > 0 && (
                  <span style={{
                    background: active ? meta.color : 'var(--color-border)',
                    color: active ? '#fff' : 'var(--color-text-muted)',
                    borderRadius: 10,
                    padding: '0 5px',
                    fontSize: 10,
                    fontWeight: 800,
                    lineHeight: '16px',
                    minWidth: 16,
                    textAlign: 'center',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 13,
            }}
          >
            Loading error log...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <AlertTriangle size={28} color="var(--color-text-muted)" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
              No errors logged. That's a good sign.
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry, i) => {
              const isOpen = expanded.has(entry.id)
              const ctxColor = CONTEXT_COLORS[entry.context] ?? '#aaa'
              const srcMeta = SOURCE_META[entry.source ?? 'server']
              return (
                <div
                  key={entry.id}
                  style={{
                    borderBottom: i < entries.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <button
                    onClick={() => toggleExpand(entry.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '12px 20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <Circle
                      size={8}
                      fill={ctxColor}
                      color={ctxColor}
                      style={{ marginTop: 5, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                      >
                        {/* Context badge */}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color: ctxColor,
                            padding: '2px 6px',
                            background: `${ctxColor}20`,
                            borderRadius: 4,
                          }}
                        >
                          {entry.context}
                        </span>

                        {/* Source badge */}
                        <span
                          title={srcMeta?.description}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color: srcMeta?.color ?? '#aaa',
                            padding: '2px 6px',
                            background: `${srcMeta?.color ?? '#aaa'}15`,
                            borderRadius: 4,
                            border: `1px solid ${srcMeta?.color ?? '#aaa'}40`,
                          }}
                        >
                          {srcMeta?.label ?? entry.source ?? 'server'}
                        </span>

                        {entry.route && (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--color-text-muted)',
                              fontFamily: 'monospace',
                            }}
                          >
                            {entry.method} {entry.route}
                          </span>
                        )}
                        {entry.statusCode && (
                          <span
                            style={{
                              fontSize: 11,
                              color: entry.statusCode >= 500 ? '#e05252' : '#e0a03a',
                              fontWeight: 700,
                            }}
                          >
                            {entry.statusCode}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--color-text-muted)',
                            marginLeft: 'auto',
                          }}
                        >
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: '4px 0 0',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--color-text)',
                        }}
                      >
                        {entry.message}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronUp size={14} color="var(--color-text-muted)" />
                    ) : (
                      <ChevronDown size={14} color="var(--color-text-muted)" />
                    )}
                  </button>

                  {isOpen && (
                    <div
                      style={{
                        padding: '0 20px 16px 40px',
                        background: 'var(--color-bg)',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      {/* Source explanation */}
                      {srcMeta && (
                        <div style={{
                          marginTop: 12,
                          padding: '8px 12px',
                          borderRadius: 6,
                          background: `${srcMeta.color}10`,
                          border: `1px solid ${srcMeta.color}30`,
                          fontSize: 12,
                          color: srcMeta.color,
                          fontWeight: 500,
                        }}>
                          <strong>Source — {srcMeta.label}:</strong> {srcMeta.description}
                        </div>
                      )}

                      {entry.detail && (
                        <div style={{ marginTop: 12 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--color-text-muted)',
                              margin: '0 0 4px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Detail
                          </p>
                          <p
                            style={{
                              fontSize: 13,
                              color: 'var(--color-text)',
                              margin: 0,
                              lineHeight: 1.6,
                            }}
                          >
                            {entry.detail}
                          </p>
                        </div>
                      )}
                      {entry.userId && (
                        <div style={{ marginTop: 10 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--color-text-muted)',
                              margin: '0 0 4px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            User ID
                          </p>
                          <code
                            style={{
                              fontSize: 12,
                              color: 'var(--color-text)',
                              fontFamily: 'monospace',
                            }}
                          >
                            {entry.userId}
                          </code>
                        </div>
                      )}
                      {entry.stack && (
                        <div style={{ marginTop: 10 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--color-text-muted)',
                              margin: '0 0 4px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Stack Trace
                          </p>
                          <pre
                            style={{
                              fontSize: 11,
                              color: '#e05252',
                              fontFamily: 'monospace',
                              background: '#1a0a0a',
                              padding: 12,
                              borderRadius: 6,
                              overflowX: 'auto',
                              margin: 0,
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                            }}
                          >
                            {entry.stack}
                          </pre>
                        </div>
                      )}
                      <p
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-muted)',
                          margin: '10px 0 0',
                        }}
                      >
                        Error ID: <code style={{ fontFamily: 'monospace' }}>{entry.id}</code>
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Source legend */}
      <SectionCard title="Error Sources — What They Mean">
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {Object.entries(SOURCE_META).map(([src, meta]) => (
              <div
                key={src}
                style={{
                  padding: 12,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  borderLeft: `3px solid ${meta.color}`,
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: meta.color }}>
                  {meta.label}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  {meta.description}
                </p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--color-text)' }}>Note:</strong> Infrastructure crashes
            (container OOM, Coolify restarts) cannot be logged — the process is already dead.
            They appear as sudden gaps in the log timeline or as prior <strong>Network</strong> errors
            if a downstream service became unreachable before the crash.
          </p>
        </div>
      </SectionCard>

      {/* Context legend */}
      <SectionCard title="Error Areas — What They Mean">
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { ctx: 'post', label: 'Post Creation', desc: 'Errors when users try to create a feed post. Usually a database permission issue.' },
              { ctx: 'upload', label: 'File Upload', desc: 'Photo uploads failing. Usually Supabase storage bucket permissions.' },
              { ctx: 'onboarding', label: 'Onboarding', desc: 'Profile setup failures. Usually missing required fields or schema mismatch.' },
              { ctx: 'auth', label: 'Authentication', desc: 'Login or token verification failures.' },
              { ctx: 'stripe', label: 'Stripe / Payments', desc: 'Credit purchase or webhook processing errors.' },
              { ctx: 'sms', label: 'SMS', desc: 'Text message dispatch failures via Telnyx.' },
              { ctx: 'admin', label: 'Admin Actions', desc: 'Errors triggered by admin panel operations.' },
              { ctx: 'server', label: 'Server / General', desc: 'Uncaught server errors or unhandled exceptions.' },
            ].map(({ ctx, label, desc }) => (
              <div
                key={ctx}
                style={{
                  padding: 12,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  borderLeft: `3px solid ${CONTEXT_COLORS[ctx] ?? '#aaa'}`,
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                  {label}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
