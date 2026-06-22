import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronUp, Circle, Download } from 'lucide-react'
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
  bob: '#22c9a5',
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

function dateTag(): string {
  return new Date().toISOString().slice(0, 10)
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function formatJSON(entries: ErrorEntry[]): string {
  return JSON.stringify(entries, null, 2)
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function formatCSV(entries: ErrorEntry[]): string {
  const headers = [
    'error_id', 'timestamp', 'context', 'source', 'route', 'method',
    'status_code', 'message', 'detail', 'user_id', 'stack',
  ]
  const rows = entries.map(e => [
    csvEscape(e.id),
    csvEscape(e.timestamp),
    csvEscape(e.context),
    csvEscape(e.source),
    csvEscape(e.route),
    csvEscape(e.method),
    csvEscape(e.statusCode),
    csvEscape(e.message),
    csvEscape(e.detail),
    csvEscape(e.userId),
    csvEscape(e.stack),
  ].join(','))
  return [headers.join(','), ...rows].join('\r\n')
}

function mdEscape(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function formatMarkdown(entries: ErrorEntry[]): string {
  const tag = dateTag()
  const lines: string[] = [
    `# Error Log Export — ${tag}`,
    '',
    `Total entries: ${entries.length}`,
    '',
  ]
  for (const e of entries) {
    lines.push(`## ${e.message}`)
    lines.push('')
    lines.push('| Field | Value |')
    lines.push('|---|---|')
    lines.push(`| Error ID | \`${e.id}\` |`)
    lines.push(`| Timestamp | ${e.timestamp} |`)
    lines.push(`| Context | ${e.context} |`)
    lines.push(`| Source | ${mdEscape(e.source) || '—'} |`)
    lines.push(`| Route | ${mdEscape(e.route) || '—'} |`)
    lines.push(`| Method | ${mdEscape(e.method) || '—'} |`)
    lines.push(`| Status Code | ${e.statusCode ?? '—'} |`)
    lines.push(`| User ID | ${mdEscape(e.userId) || '—'} |`)
    lines.push(`| Detail | ${mdEscape(e.detail) || '—'} |`)
    lines.push('')
    if (e.stack) {
      lines.push('**Stack Trace:**')
      lines.push('')
      lines.push('```')
      lines.push(e.stack)
      lines.push('```')
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }
  return lines.join('\n')
}

function buildPDFHtml(entries: ErrorEntry[]): string {
  const tag = dateTag()
  const escHtml = (s: string | null | undefined) =>
    (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const entryBlocks = entries.map(e => `
    <div class="entry">
      <div class="entry-header">
        <span class="ctx">${escHtml(e.context)}</span>
        ${e.source ? `<span class="src">${escHtml(e.source)}</span>` : ''}
        ${e.route ? `<span class="route">${escHtml(e.method)} ${escHtml(e.route)}</span>` : ''}
        ${e.statusCode ? `<span class="status">${e.statusCode}</span>` : ''}
        <span class="ts">${new Date(e.timestamp).toLocaleString()}</span>
      </div>
      <div class="message">${escHtml(e.message)}</div>
      ${e.detail ? `<div class="field"><span class="label">Detail:</span> ${escHtml(e.detail)}</div>` : ''}
      ${e.userId ? `<div class="field"><span class="label">User ID:</span> <code>${escHtml(e.userId)}</code></div>` : ''}
      ${e.stack ? `<div class="field"><span class="label">Stack Trace:</span><pre>${escHtml(e.stack)}</pre></div>` : ''}
      <div class="field muted"><span class="label">Error ID:</span> <code>${escHtml(e.id)}</code></div>
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Error Log — ${tag}</title>
<style>
  body { font-family: -apple-system, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .subtitle { color: #666; font-size: 12px; margin: 0 0 24px; }
  .entry { border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; page-break-inside: avoid; }
  .entry-header { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
  .ctx { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
  .src { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: #e8f5ee; color: #3ecf8e; padding: 2px 6px; border-radius: 4px; }
  .route { font-family: monospace; font-size: 11px; color: #555; }
  .status { font-weight: 700; font-size: 11px; color: #c0392b; }
  .ts { font-size: 11px; color: #888; margin-left: auto; }
  .message { font-weight: 600; font-size: 13px; margin-bottom: 8px; }
  .field { font-size: 11px; color: #333; margin-top: 4px; }
  .field .label { font-weight: 700; color: #666; }
  .muted { color: #999; }
  code { font-family: monospace; background: #f5f5f5; padding: 1px 4px; border-radius: 3px; }
  pre { font-family: monospace; font-size: 10px; background: #1a0a0a; color: #e05252; padding: 10px; border-radius: 4px; overflow-wrap: break-word; white-space: pre-wrap; margin: 4px 0 0; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>Error Log Export</h1>
<p class="subtitle">${tag} &mdash; ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}</p>
${entryBlocks}
<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`
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
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!exportOpen) return
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [exportOpen])

  async function fetchAllForExport(): Promise<ErrorEntry[]> {
    const all: ErrorEntry[] = []
    const batchSize = 500
    let offset = 0
    while (true) {
      const params = new URLSearchParams()
      if (contextFilter !== 'all') params.set('context', contextFilter)
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      params.set('limit', String(batchSize))
      params.set('offset', String(offset))
      const res = await fetch(`/api/admin/error-log?${params.toString()}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to fetch error log for export')
      const data = await res.json()
      const items: ErrorEntry[] = data.items ?? []
      all.push(...items)
      if (items.length < batchSize) break
      offset += batchSize
    }
    return all
  }

  async function handleExport(format: 'json' | 'csv' | 'markdown' | 'pdf') {
    setExportOpen(false)

    let pdfWin: Window | null = null
    if (format === 'pdf') {
      pdfWin = window.open('', '_blank')
      if (!pdfWin) {
        alert('PDF export was blocked by your browser. Please allow pop-ups for this page and try again.')
        return
      }
      pdfWin.document.write('<html><body><p style="font-family:sans-serif;padding:24px;color:#666">Preparing export…</p></body></html>')
      pdfWin.document.close()
    }

    setExporting(true)
    try {
      const all = await fetchAllForExport()
      const tag = dateTag()
      if (format === 'json') {
        triggerDownload(formatJSON(all), `error-log-${tag}.json`, 'application/json')
      } else if (format === 'csv') {
        triggerDownload(formatCSV(all), `error-log-${tag}.csv`, 'text/csv')
      } else if (format === 'markdown') {
        triggerDownload(formatMarkdown(all), `error-log-${tag}.md`, 'text/markdown')
      } else if (format === 'pdf' && pdfWin) {
        pdfWin.document.open()
        pdfWin.document.write(buildPDFHtml(all))
        pdfWin.document.close()
      }
    } catch {
      if (pdfWin) pdfWin.close()
      alert('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

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
  const sourceCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.source ?? 'server'] = (acc[e.source ?? 'server'] ?? 0) + 1
    return acc
  }, {})
  const hasEntries = total > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionCard
        title={`Error Log — ${total} recorded`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <div ref={exportRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setExportOpen(o => !o)}
                disabled={!hasEntries || exporting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: hasEntries && !exporting ? 'var(--color-bg)' : 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  cursor: hasEntries && !exporting ? 'pointer' : 'not-allowed',
                  color: hasEntries && !exporting ? 'var(--color-text)' : 'var(--color-text-muted)',
                  opacity: hasEntries && !exporting ? 1 : 0.5,
                }}
              >
                <Download size={13} />
                {exporting ? 'Exporting…' : 'Export'}
                <ChevronDown size={12} />
              </button>
              {exportOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    minWidth: 140,
                    overflow: 'hidden',
                  }}
                >
                  {(['JSON', 'CSV', 'Markdown', 'PDF'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => void handleExport(fmt.toLowerCase() as 'json' | 'csv' | 'markdown' | 'pdf')}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '9px 16px',
                        fontSize: 13,
                        fontWeight: 500,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text)',
                        borderBottom: fmt !== 'PDF' ? '1px solid var(--color-border)' : 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
              { ctx: 'bob', label: 'Bob (AI Agent)', desc: 'Errors communicating with Bob — unreachable, non-2xx response, or AI provider failure.' },
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
