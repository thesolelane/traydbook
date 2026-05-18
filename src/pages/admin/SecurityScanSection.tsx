import { useState } from 'react'
import {
  Bug,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Camera,
  FileSearch,
  Package,
  FileDiff,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { SectionCard, SectionProps } from './shared'

type Tab = 'audit' | 'codescan' | 'integrity'

// ── Dependency Audit types ────────────────────────────────────────────────────
interface AuditVuln {
  name: string
  severity: string
  via: string[]
  fixAvailable: boolean | { name: string; version: string }
  range: string
}

// ── Code scan types ───────────────────────────────────────────────────────────
interface Finding {
  patternId: string
  label: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  file: string
  line: number
  snippet: string
}

// ── Snapshot types ────────────────────────────────────────────────────────────
interface SnapshotBaseline {
  label: string
  createdAt: string
  fileCount: number
}
interface SnapshotComparison {
  added: string[]
  removed: string[]
  modified: string[]
  unchanged: number
}

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, moderate: 2, medium: 2, low: 3, info: 4 }
const SEV_COLOR: Record<string, string> = {
  critical: '#e05252',
  high: '#E85D04',
  moderate: '#d97706',
  medium: '#d97706',
  low: '#059669',
  info: '#6B7280',
}
const SEV_BG: Record<string, string> = {
  critical: 'rgba(224,82,82,0.12)',
  high: 'rgba(232,93,4,0.12)',
  moderate: 'rgba(217,119,6,0.12)',
  medium: 'rgba(217,119,6,0.12)',
  low: 'rgba(5,150,105,0.12)',
  info: 'rgba(107,114,128,0.1)',
}

function SevBadge({ sev }: { sev: string }) {
  const s = sev.toLowerCase()
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: '0.5px',
      padding: '2px 8px', borderRadius: 20, flexShrink: 0,
      background: SEV_BG[s] ?? SEV_BG.info,
      color: SEV_COLOR[s] ?? SEV_COLOR.info,
      textTransform: 'uppercase',
    }}>
      {sev}
    </span>
  )
}

// ── Dependency Audit Tab ──────────────────────────────────────────────────────
function AuditTab({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ vulns: AuditVuln[]; metadata: Record<string, number> } | null>(null)
  const [err, setErr] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  async function run() {
    setLoading(true); setErr(''); setResult(null)
    try {
      const res = await fetch('/api/admin/security/audit', { headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Failed'); return }
      const report = data.report ?? {}
      const vulnMap: Record<string, AuditVuln> = report.vulnerabilities ?? {}
      const vulns = Object.entries(vulnMap).map(([name, v]: [string, any]) => ({
        name,
        severity: v.severity ?? 'info',
        via: Array.isArray(v.via) ? v.via.map((x: any) => (typeof x === 'string' ? x : x.name ?? x.title ?? '')).filter(Boolean) : [],
        fixAvailable: v.fixAvailable ?? false,
        range: v.range ?? '',
      })) as AuditVuln[]
      vulns.sort((a, b) => (SEV_ORDER[a.severity] ?? 99) - (SEV_ORDER[b.severity] ?? 99))
      const meta = report.metadata?.vulnerabilities ?? {}
      setResult({ vulns, metadata: meta })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const counts = result?.metadata ?? {}
  const total = Object.values(counts).reduce((a: number, b) => a + (b as number), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', flex: 1, margin: 0 }}>
          Runs <code style={{ fontSize: 11, background: 'var(--color-border)', padding: '1px 6px', borderRadius: 4 }}>npm audit</code> against all installed packages and reports known CVE vulnerabilities.
        </p>
        <button
          onClick={run}
          disabled={loading}
          className="btn btn-primary"
          style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
          {loading ? 'Running…' : 'Run Audit'}
        </button>
      </div>

      {err && (
        <div style={{ padding: '12px 16px', background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 8, fontSize: 13, color: '#e05252', marginBottom: 16 }}>
          {err}
        </div>
      )}

      {result && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            {Object.entries(counts).sort(([a], [b]) => (SEV_ORDER[a] ?? 99) - (SEV_ORDER[b] ?? 99)).map(([sev, count]) => (
              <div key={sev} style={{
                padding: '10px 16px', borderRadius: 10,
                background: SEV_BG[sev] ?? SEV_BG.info,
                border: `1px solid ${SEV_COLOR[sev] ?? SEV_COLOR.info}30`,
                textAlign: 'center', minWidth: 80,
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: SEV_COLOR[sev] ?? SEV_COLOR.info }}>{count as number}</div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: SEV_COLOR[sev] ?? SEV_COLOR.info, opacity: 0.8 }}>{sev}</div>
              </div>
            ))}
            {total === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600 }}>
                <CheckCircle2 size={16} /> No vulnerabilities found
              </div>
            )}
          </div>

          {result.vulns.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.vulns.map(v => (
                <div key={v.name}
                  style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === v.name ? null : v.name)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--color-surface)' }}>
                    <Package size={14} style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{v.name}</span>
                    <SevBadge sev={v.severity} />
                    <ChevronRight size={14} style={{ color: 'var(--color-text-muted)', transform: expanded === v.name ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                  </div>
                  {expanded === v.name && (
                    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)', fontSize: 12 }}>
                      <div style={{ marginBottom: 6 }}><strong>Range:</strong> <code style={{ background: 'var(--color-border)', padding: '1px 5px', borderRadius: 3 }}>{v.range || 'unknown'}</code></div>
                      {v.via.length > 0 && <div style={{ marginBottom: 6 }}><strong>Via:</strong> {v.via.join(', ')}</div>}
                      <div>
                        <strong>Fix:</strong>{' '}
                        {v.fixAvailable === true ? <span style={{ color: '#059669' }}>Available (run npm audit fix)</span>
                          : typeof v.fixAvailable === 'object' ? <span style={{ color: '#d97706' }}>Breaking fix via {v.fixAvailable.name}@{v.fixAvailable.version}</span>
                          : <span style={{ color: '#e05252' }}>No automatic fix available</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!result && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
          <Package size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
          <p>Click "Run Audit" to check for dependency vulnerabilities.</p>
        </div>
      )}
    </div>
  )
}

// ── Code Scan Tab ─────────────────────────────────────────────────────────────
function CodeScanTab({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ findings: Finding[]; filesScanned: number; scannedAt: string } | null>(null)
  const [err, setErr] = useState('')
  const [filterSev, setFilterSev] = useState<string>('all')

  async function run() {
    setLoading(true); setErr(''); setResult(null)
    try {
      const res = await fetch('/api/admin/security/codescan', { headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Failed'); return }
      setResult(data)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const findings = result?.findings ?? []
  const filtered = filterSev === 'all' ? findings : findings.filter(f => f.severity === filterSev)
  const bySev = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const f of findings) { if (f.severity in bySev) (bySev as any)[f.severity]++ }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', flex: 1, margin: 0 }}>
          Scans <code style={{ fontSize: 11, background: 'var(--color-border)', padding: '1px 6px', borderRadius: 4 }}>src/</code>, <code style={{ fontSize: 11, background: 'var(--color-border)', padding: '1px 6px', borderRadius: 4 }}>server/</code>, and <code style={{ fontSize: 11, background: 'var(--color-border)', padding: '1px 6px', borderRadius: 4 }}>admin-app/</code> for hardcoded secrets, eval usage, SQL injection, XSS risks, and more.
        </p>
        <button
          onClick={run}
          disabled={loading}
          className="btn btn-primary"
          style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSearch size={13} />}
          {loading ? 'Scanning…' : 'Run Scan'}
        </button>
      </div>

      {err && (
        <div style={{ padding: '12px 16px', background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 8, fontSize: 13, color: '#e05252', marginBottom: 16 }}>
          {err}
        </div>
      )}

      {result && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            {(['critical', 'high', 'medium', 'low'] as const).map(s => (
              <button key={s}
                onClick={() => setFilterSev(filterSev === s ? 'all' : s)}
                style={{
                  padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: filterSev === s ? SEV_BG[s] : 'var(--color-surface)',
                  color: filterSev === s ? SEV_COLOR[s] : 'var(--color-text-muted)',
                  outline: filterSev === s ? `1.5px solid ${SEV_COLOR[s]}50` : 'none',
                }}
              >
                {s.toUpperCase()} ({(bySev as any)[s]})
              </button>
            ))}
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 4 }}>
              {result.filesScanned} files scanned · {new Date(result.scannedAt).toLocaleTimeString()}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600 }}>
              <CheckCircle2 size={16} /> {findings.length === 0 ? 'No issues detected across all scanned files.' : 'No issues at this severity level.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map((f, i) => (
                <div key={i} style={{
                  padding: '10px 14px', background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)', borderRadius: 8,
                  borderLeft: `3px solid ${SEV_COLOR[f.severity] ?? '#6B7280'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <SevBadge sev={f.severity} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                    {f.file}:{f.line}
                  </div>
                  {f.snippet && (
                    <code style={{
                      display: 'block', fontSize: 11, padding: '5px 8px',
                      background: 'var(--color-bg)', borderRadius: 4,
                      color: 'var(--color-text-muted)', fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    }}>
                      {f.snippet}
                    </code>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!result && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
          <Bug size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
          <p>Click "Run Scan" to check for security anti-patterns in the codebase.</p>
        </div>
      )}
    </div>
  )
}

// ── File Integrity Tab ────────────────────────────────────────────────────────
function IntegrityTab({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [loading, setLoading] = useState(false)
  const [snapping, setSnapping] = useState(false)
  const [baseline, setBaseline] = useState<SnapshotBaseline | null>(null)
  const [comparison, setComparison] = useState<SnapshotComparison | null>(null)
  const [clean, setClean] = useState<boolean | null>(null)
  const [err, setErr] = useState('')
  const [snapLabel, setSnapLabel] = useState('')
  const [snapDone, setSnapDone] = useState('')

  async function loadSnapshot() {
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/admin/security/snapshot', { headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Failed'); return }
      setBaseline(data.baseline ?? null)
      setComparison(data.comparison ?? null)
      setClean(data.clean ?? null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function takeSnapshot() {
    setSnapping(true); setSnapDone('')
    try {
      const res = await fetch('/api/admin/security/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ label: snapLabel.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Failed'); return }
      setSnapDone(`Snapshot saved: "${data.label}" — ${data.fileCount} files`)
      setSnapLabel('')
      loadSnapshot()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSnapping(false)
    }
  }

  const hasChanges = comparison && (comparison.added.length + comparison.removed.length + comparison.modified.length) > 0

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
        Take a SHA-256 hash snapshot of the entire codebase as a baseline. Run again later to detect any modified, added, or removed files — useful for catching unauthorized changes or intrusions.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={snapLabel}
          onChange={e => setSnapLabel(e.target.value)}
          placeholder="Snapshot label (optional)"
          style={{
            flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 8, fontSize: 13,
            border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)',
          }}
        />
        <button
          onClick={takeSnapshot}
          disabled={snapping}
          className="btn btn-primary"
          style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {snapping ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={13} />}
          {snapping ? 'Saving…' : 'Save Baseline'}
        </button>
        <button
          onClick={loadSnapshot}
          disabled={loading}
          style={{
            fontSize: 13, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileDiff size={13} />}
          Compare
        </button>
      </div>

      {snapDone && (
        <div style={{ padding: '10px 14px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 8, color: '#059669', fontSize: 13, marginBottom: 16 }}>
          <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 6 }} />{snapDone}
        </div>
      )}

      {err && (
        <div style={{ padding: '12px 16px', background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 8, fontSize: 13, color: '#e05252', marginBottom: 16 }}>
          {err}
        </div>
      )}

      {baseline && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 10 }}>
            Active Baseline
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Label</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{baseline.label}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Created</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(baseline.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Files Hashed</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{baseline.fileCount}</div>
            </div>
          </div>
        </div>
      )}

      {comparison && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {clean ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600 }}>
              <ShieldCheck size={16} /> Codebase matches baseline — no changes detected.
            </div>
          ) : (
            <>
              {hasChanges && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(232,93,4,0.08)', border: '1px solid rgba(232,93,4,0.3)', borderRadius: 10, color: 'var(--color-brand)', fontSize: 13, fontWeight: 600 }}>
                  <ShieldAlert size={16} /> Changes detected since baseline
                </div>
              )}
              {comparison.modified.length > 0 && (
                <ChangeList title="Modified" files={comparison.modified} color="#E85D04" />
              )}
              {comparison.added.length > 0 && (
                <ChangeList title="Added (new files)" files={comparison.added} color="#059669" />
              )}
              {comparison.removed.length > 0 && (
                <ChangeList title="Removed (deleted files)" files={comparison.removed} color="#e05252" />
              )}
            </>
          )}
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'right' }}>
            {comparison.unchanged} files unchanged
          </div>
        </div>
      )}

      {!baseline && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
          <Camera size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
          <p>No baseline snapshot yet. Save one now to enable change detection.</p>
        </div>
      )}
    </div>
  )
}

function ChangeList({ title, files, color }: { title: string; files: string[]; color: string }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? files : files.slice(0, 5)
  return (
    <div style={{ background: 'var(--color-surface)', border: `1px solid ${color}30`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: `${color}10`, borderBottom: `1px solid ${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{title} ({files.length})</span>
      </div>
      <div style={{ padding: '8px 0' }}>
        {visible.map(f => (
          <div key={f} style={{ padding: '4px 14px', fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{f}</div>
        ))}
        {files.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ padding: '4px 14px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color }}
          >
            {expanded ? 'Show less' : `+${files.length - 5} more…`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Section ──────────────────────────────────────────────────────────────
export default function SecurityScanSection({ authHeaders }: SectionProps) {
  const [tab, setTab] = useState<Tab>('audit')

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'audit',     label: 'Dependency Audit', icon: <Package size={14} /> },
    { id: 'codescan',  label: 'Code Scan',        icon: <Bug size={14} /> },
    { id: 'integrity', label: 'File Integrity',   icon: <Camera size={14} /> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--color-brand)' : '2px solid transparent',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: tab === t.id ? 'var(--color-brand)' : 'var(--color-text-muted)',
              marginBottom: -1,
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <SectionCard
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {TABS.find(t => t.id === tab)?.icon}
            {TABS.find(t => t.id === tab)?.label}
          </span>
        }
      >
        {tab === 'audit'     && <AuditTab authHeaders={authHeaders} />}
        {tab === 'codescan'  && <CodeScanTab authHeaders={authHeaders} />}
        {tab === 'integrity' && <IntegrityTab authHeaders={authHeaders} />}
      </SectionCard>

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1, color: '#d97706' }} />
        <span>These tools are supplemental. They flag common patterns but are not a replacement for a full penetration test or professional security audit. Always review findings manually before taking action.</span>
      </div>
    </div>
  )
}
