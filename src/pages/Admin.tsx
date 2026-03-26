import { useState, useEffect, useCallback } from 'react'
import {
  BarChart2, Users, Wallet, MessageSquare, Settings, CreditCard,
  Globe, RefreshCw, Trash2, CheckCircle,
  XCircle, AlertTriangle, Search, Shield, TrendingUp, DollarSign,
  Plus, Minus, ExternalLink, Megaphone,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import StaffPanel from '../components/StaffPanel'
import { getRoleLabel, isSuperAdmin } from '../lib/roles'

type Section = 'overview' | 'users' | 'wallets' | 'feed' | 'controls' | 'payments' | 'domains'

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',  label: 'Analytics Overview',    icon: <BarChart2 size={16} /> },
  { id: 'users',     label: 'User Management',        icon: <Users size={16} /> },
  { id: 'wallets',   label: 'Wallet & Credits',       icon: <Wallet size={16} /> },
  { id: 'feed',      label: 'Feed Moderation',        icon: <MessageSquare size={16} /> },
  { id: 'controls',  label: 'Platform Controls',      icon: <Settings size={16} /> },
  { id: 'payments',  label: 'Stripe & Payments',      icon: <CreditCard size={16} /> },
  { id: 'domains',   label: 'Domain Status',          icon: <Globe size={16} /> },
]

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 15, letterSpacing: '0.3px' }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

function StatCard({ label, value, sub, icon, color = 'var(--color-brand)' }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        <span style={{ color, opacity: 0.75 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-condensed)', color: 'var(--color-text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  )
}

function AdminInput({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '8px 12px', borderRadius: 8, fontSize: 13,
        border: '1.5px solid var(--color-border)', background: 'var(--color-bg)',
        color: 'var(--color-text)', outline: 'none', ...style,
      }}
    />
  )
}

function LoadingRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '10px 12px' }}>
          <div style={{ height: 14, background: 'var(--color-border)', borderRadius: 4, opacity: 0.5 }} />
        </td>
      ))}
    </tr>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)',
  borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap',
}
const tableCellStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--color-border)',
  color: 'var(--color-text)',
}

export default function Admin() {
  const { session, profile } = useAuth()
  const [section, setSection] = useState<Section>('overview')
  const isSuperAdminUser = isSuperAdmin(profile?.account_type)

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}>
      <aside style={{
        width: 220, flexShrink: 0, borderRight: '1px solid var(--color-border)',
        background: 'var(--color-surface)', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 2,
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid var(--color-border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color="var(--color-brand)" />
            <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 16, letterSpacing: '0.5px' }}>ADMIN</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {isSuperAdminUser ? 'Super Admin' : 'Admin'}
          </div>
        </div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 20px', background: section === item.id ? 'rgba(226,114,42,0.1)' : 'none',
              border: 'none', borderRight: section === item.id ? '3px solid var(--color-brand)' : '3px solid transparent',
              cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 600,
              color: section === item.id ? 'var(--color-brand)' : 'var(--color-text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </aside>

      <main style={{ flex: 1, padding: 32, maxWidth: 1100, minWidth: 0 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-condensed)', fontWeight: 900, fontSize: 26, margin: 0, letterSpacing: '0.5px' }}>
            {NAV_ITEMS.find(n => n.id === section)?.label}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>Traydbook Admin Control Center</p>
        </div>

        {section === 'overview'  && <OverviewSection authHeaders={authHeaders} />}
        {section === 'users'     && <UsersSection authHeaders={authHeaders} />}
        {section === 'wallets'   && <WalletsSection authHeaders={authHeaders} />}
        {section === 'feed'      && <FeedSection authHeaders={authHeaders} />}
        {section === 'controls'  && <ControlsSection />}
        {section === 'payments'  && <PaymentsSection authHeaders={authHeaders} />}
        {section === 'domains'   && <DomainsSection />}
      </main>
    </div>
  )
}

interface SectionProps {
  authHeaders: () => Record<string, string>
}

function OverviewSection({ authHeaders }: SectionProps) {
  const [stats, setStats] = useState<{
    totalUsers: number
    adminCount: number
    contractorCount: number
    ownerCount: number
    postCount: number
    jobCount: number
    rfqCount: number
    bidCount: number
    totalCreditsIssued: number
    totalCreditSpent: number
    recentSignups: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setErr('')
      try {
        const res = await fetch('/api/admin/stats', { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load stats')
        setStats(await res.json())
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load stats')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 20px', height: 90 }} />
        ))}
      </div>
    )
  }

  if (err) {
    return <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, color: '#DC2626', fontSize: 13 }}>{err}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} sub={`${stats?.recentSignups ?? 0} in last 30d`} icon={<Users size={18} />} />
        <StatCard label="Contractors" value={stats?.contractorCount ?? 0} icon={<TrendingUp size={18} />} color="#D97706" />
        <StatCard label="Owners / Homeowners" value={stats?.ownerCount ?? 0} icon={<Users size={18} />} color="#2563EB" />
        <StatCard label="Admins" value={stats?.adminCount ?? 0} icon={<Shield size={18} />} color="#E85D04" />
        <StatCard label="Total Posts" value={stats?.postCount ?? 0} icon={<MessageSquare size={18} />} color="#7C3AED" />
        <StatCard label="Job Listings" value={stats?.jobCount ?? 0} icon={<BarChart2 size={18} />} color="#059669" />
        <StatCard label="RFQs Posted" value={stats?.rfqCount ?? 0} icon={<BarChart2 size={18} />} color="#0891B2" />
        <StatCard label="Bids Submitted" value={stats?.bidCount ?? 0} icon={<BarChart2 size={18} />} color="#E85D04" />
        <StatCard label="Credits Issued" value={stats?.totalCreditsIssued ?? 0} icon={<DollarSign size={18} />} color="#059669" />
        <StatCard label="Credits Spent" value={stats?.totalCreditSpent ?? 0} icon={<Minus size={18} />} color="#DC2626" />
      </div>
    </div>
  )
}

interface UserRow {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  account_type: string
  credit_balance: number
  created_at: string
  deleted_at: string | null
}

function UsersSection({ authHeaders }: SectionProps) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [msgErr, setMsgErr] = useState('')
  const PAGE_SIZE = 25

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      const res = await fetch(`/api/admin/users?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch (e) {
      setMsgErr(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, page])

  useEffect(() => { void loadUsers() }, [loadUsers])

  async function handleRoleChange(userId: string, newRole: string) {
    setActionLoading(userId + ':role')
    setMsg('')
    setMsgErr('')
    try {
      const res = await fetch(`/api/admin/user/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ role: newRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update role')
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, account_type: newRole } : u))
      setMsg('Role updated.')
      setTimeout(() => setMsg(''), 2500)
    } catch (e) {
      setMsgErr(e instanceof Error ? e.message : 'Failed to update role')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSuspend(userId: string, suspend: boolean) {
    setActionLoading(userId + ':suspend')
    setMsg('')
    setMsgErr('')
    try {
      const res = await fetch(`/api/admin/user/${userId}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ suspend }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update account')
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, deleted_at: suspend ? new Date().toISOString() : null } : u))
      setMsg(suspend ? 'Account suspended.' : 'Account reinstated.')
      setTimeout(() => setMsg(''), 2500)
    } catch (e) {
      setMsgErr(e instanceof Error ? e.message : 'Failed to update account')
    } finally {
      setActionLoading(null)
    }
  }

  const ALL_ROLES = ['admin', 'admin_2', 'hired_dev', 'moderator', 'contractor', 'project_owner', 'agent', 'homeowner']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg && (
        <div style={{ padding: '10px 14px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 8, fontSize: 13, color: '#059669' }}>{msg}</div>
      )}
      {msgErr && (
        <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{msgErr}</div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 2, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <AdminInput
            value={search}
            onChange={v => { setSearch(v); setPage(0) }}
            placeholder="Search by name or handle…"
            style={{ width: '100%', paddingLeft: 32, boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
        >
          <option value="">All Roles</option>
          {ALL_ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
        </select>
        <button onClick={() => void loadUsers()} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--color-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface)' }}>
              <th style={tableHeaderStyle}>User</th>
              <th style={tableHeaderStyle}>Handle</th>
              <th style={tableHeaderStyle}>Role</th>
              <th style={tableHeaderStyle}>Credits</th>
              <th style={tableHeaderStyle}>Joined</th>
              <th style={tableHeaderStyle}>Status</th>
              <th style={tableHeaderStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} cols={7} />)
            ) : users.length === 0 ? (
              <tr><td colSpan={7} style={{ ...tableCellStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No users found.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} style={{ background: u.deleted_at ? 'rgba(220,38,38,0.04)' : 'transparent' }}>
                <td style={tableCellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        {u.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{u.display_name}</span>
                  </div>
                </td>
                <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)' }}>@{u.handle}</td>
                <td style={tableCellStyle}>
                  <select
                    value={u.account_type}
                    onChange={e => void handleRoleChange(u.id, e.target.value)}
                    disabled={actionLoading === u.id + ':role'}
                    style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer' }}
                  >
                    {ALL_ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                  </select>
                </td>
                <td style={{ ...tableCellStyle, fontVariantNumeric: 'tabular-nums' }}>{u.credit_balance}</td>
                <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)' }}>{formatDate(u.created_at)}</td>
                <td style={tableCellStyle}>
                  {u.deleted_at ? (
                    <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 700, background: 'rgba(220,38,38,0.1)', padding: '2px 8px', borderRadius: 20 }}>Suspended</span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#059669', fontWeight: 700, background: 'rgba(5,150,105,0.1)', padding: '2px 8px', borderRadius: 20 }}>Active</span>
                  )}
                </td>
                <td style={tableCellStyle}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a href={`/profile/${u.handle}`} target="_blank" rel="noreferrer" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                      <ExternalLink size={11} /> Profile
                    </a>
                    <button
                      onClick={() => void handleSuspend(u.id, !u.deleted_at)}
                      disabled={actionLoading === u.id + ':suspend'}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: u.deleted_at ? '#059669' : '#DC2626', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {u.deleted_at ? <><CheckCircle size={11} /> Reinstate</> : <><XCircle size={11} /> Suspend</>}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: page === 0 ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', opacity: page === 0 ? 0.4 : 1 }}>
          Prev
        </button>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Page {page + 1}</span>
        <button disabled={users.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: users.length < PAGE_SIZE ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', opacity: users.length < PAGE_SIZE ? 0.4 : 1 }}>
          Next
        </button>
      </div>
    </div>
  )
}

interface WalletUser {
  id: string
  display_name: string
  handle: string
  credit_balance: number
  wallet_address: string | null
  wallet_network: string | null
}

function WalletsSection({ authHeaders }: SectionProps) {
  const [wallets, setWallets] = useState<WalletUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adjustUserId, setAdjustUserId] = useState('')
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [adjustMsg, setAdjustMsg] = useState('')
  const [adjustErr, setAdjustErr] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/wallets', { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
        const data = await res.json()
        setWallets(data.wallets ?? [])
      } catch (e) {
        setAdjustErr(e instanceof Error ? e.message : 'Failed to load wallets')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const filtered = wallets.filter(w =>
    !search || w.display_name.toLowerCase().includes(search.toLowerCase()) || w.handle.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!adjustUserId || !adjustDelta || !adjustReason.trim()) { setAdjustErr('All fields required.'); return }
    const delta = parseInt(adjustDelta, 10)
    if (isNaN(delta) || delta === 0) { setAdjustErr('Delta must be a non-zero integer.'); return }
    setAdjusting(true)
    setAdjustErr('')
    try {
      const res = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId: adjustUserId, delta, reason: adjustReason }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setAdjustMsg(`Credits adjusted. New balance: ${json.balance ?? '–'}`)
      setAdjustUserId('')
      setAdjustDelta('')
      setAdjustReason('')
      setWallets(prev => prev.map(w => w.id === adjustUserId ? { ...w, credit_balance: json.balance ?? w.credit_balance + delta } : w))
      setTimeout(() => setAdjustMsg(''), 4000)
    } catch (err) {
      setAdjustErr(err instanceof Error ? err.message : 'Failed to adjust credits')
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionCard title="Manual Credit Adjustment">
        <form onSubmit={e => void handleAdjust(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={adjustUserId}
              onChange={e => setAdjustUserId(e.target.value)}
              style={{ flex: 2, minWidth: 200, padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            >
              <option value="">Select user…</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>{w.display_name} (@{w.handle}) — {w.credit_balance} cr</option>
              ))}
            </select>
            <AdminInput
              value={adjustDelta}
              onChange={setAdjustDelta}
              placeholder="Delta (e.g. 50 or -10)"
              style={{ width: 140 }}
            />
            <AdminInput
              value={adjustReason}
              onChange={setAdjustReason}
              placeholder="Reason / note"
              style={{ flex: 1, minWidth: 200 }}
            />
            <button type="submit" disabled={adjusting} className="btn btn-primary" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <Plus size={13} /> Adjust
            </button>
          </div>
          {adjustErr && <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{adjustErr}</p>}
          {adjustMsg && <p style={{ fontSize: 12, color: '#059669', margin: 0 }}>{adjustMsg}</p>}
        </form>
      </SectionCard>

      <SectionCard title="User Wallets & Credit Balances" action={
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <AdminInput value={search} onChange={setSearch} placeholder="Search…" style={{ paddingLeft: 26, width: 180 }} />
        </div>
      }>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>User</th>
                <th style={tableHeaderStyle}>Handle</th>
                <th style={tableHeaderStyle}>Credits</th>
                <th style={tableHeaderStyle}>Solana Wallet</th>
                <th style={tableHeaderStyle}>Network</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} cols={5} />)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ ...tableCellStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No users found.</td></tr>
              ) : filtered.map(w => (
                <tr key={w.id}>
                  <td style={tableCellStyle}><span style={{ fontWeight: 600 }}>{w.display_name}</span></td>
                  <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)' }}>@{w.handle}</td>
                  <td style={{ ...tableCellStyle, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{w.credit_balance}</td>
                  <td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {w.wallet_address ? w.wallet_address.slice(0, 8) + '…' + w.wallet_address.slice(-6) : <span style={{ opacity: 0.4 }}>—</span>}
                  </td>
                  <td style={tableCellStyle}>{w.wallet_network ?? <span style={{ opacity: 0.4 }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

interface PostRow {
  id: string
  body: string
  post_type: string
  like_count: number
  comment_count: number
  created_at: string
  is_flagged: boolean
  author: { display_name: string; handle: string } | null
}

interface CommentRow {
  id: string
  body: string
  post_id: string
  created_at: string
  author: { display_name: string; handle: string } | null
}

function FeedSection({ authHeaders }: SectionProps) {
  const [posts, setPosts] = useState<PostRow[]>([])
  const [flaggedPosts, setFlaggedPosts] = useState<PostRow[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadingFlagged, setLoadingFlagged] = useState(true)
  const [loadingComments, setLoadingComments] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [actionErr, setActionErr] = useState('')

  function showMsg(msg: string) {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 2500)
  }
  function showErr(err: string) {
    setActionErr(err)
    setTimeout(() => setActionErr(''), 4000)
  }

  useEffect(() => {
    async function loadPosts() {
      setLoadingPosts(true)
      try {
        const res = await fetch('/api/admin/posts', { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
        const data = await res.json()
        setPosts(data.posts ?? [])
      } finally {
        setLoadingPosts(false)
      }
    }
    async function loadFlagged() {
      setLoadingFlagged(true)
      try {
        const res = await fetch('/api/admin/flagged-posts', { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
        const data = await res.json()
        setFlaggedPosts(data.posts ?? [])
      } finally {
        setLoadingFlagged(false)
      }
    }
    async function loadComments() {
      setLoadingComments(true)
      try {
        const res = await fetch('/api/admin/comments', { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
        const data = await res.json()
        setComments(data.comments ?? [])
      } finally {
        setLoadingComments(false)
      }
    }
    void loadPosts()
    void loadFlagged()
    void loadComments()
  }, [])

  async function deletePost(postId: string) {
    if (!confirm('Delete this post? This cannot be undone.')) return
    const res = await fetch(`/api/admin/post/${postId}`, { method: 'DELETE', headers: authHeaders() })
    if (res.ok) {
      setPosts(prev => prev.filter(p => p.id !== postId))
      setFlaggedPosts(prev => prev.filter(p => p.id !== postId))
      showMsg('Post deleted.')
    } else {
      const json = await res.json().catch(() => ({}))
      showErr(json.error ?? 'Failed to delete post')
    }
  }

  async function flagPost(postId: string, flagged: boolean) {
    const res = await fetch(`/api/admin/post/${postId}/flag`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ flagged }),
    })
    if (res.ok) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_flagged: flagged } : p))
      if (!flagged) {
        setFlaggedPosts(prev => prev.filter(p => p.id !== postId))
      } else {
        const flaggedPost = posts.find(p => p.id === postId)
        if (flaggedPost) setFlaggedPosts(prev => [{ ...flaggedPost, is_flagged: true }, ...prev])
      }
      showMsg(flagged ? 'Post flagged for review.' : 'Flag removed.')
    } else {
      const json = await res.json().catch(() => ({}))
      showErr(json.error ?? 'Failed to update flag')
    }
  }

  async function deleteComment(commentId: string) {
    if (!confirm('Delete this comment? This cannot be undone.')) return
    const res = await fetch(`/api/admin/comment/${commentId}`, { method: 'DELETE', headers: authHeaders() })
    if (res.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId))
      showMsg('Comment deleted.')
    } else {
      const json = await res.json().catch(() => ({}))
      showErr(json.error ?? 'Failed to delete comment')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {actionMsg && (
        <div style={{ padding: '10px 14px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 8, fontSize: 13, color: '#059669' }}>{actionMsg}</div>
      )}
      {actionErr && (
        <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{actionErr}</div>
      )}

      <SectionCard title={`Flagged Content Queue (${loadingFlagged ? '…' : flaggedPosts.length})`}>
        {loadingFlagged ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : flaggedPosts.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>No flagged content. Flag posts from the list below to surface them here for review.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Author</th>
                  <th style={tableHeaderStyle}>Type</th>
                  <th style={tableHeaderStyle}>Content</th>
                  <th style={tableHeaderStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {flaggedPosts.map(p => (
                  <tr key={p.id} style={{ background: 'rgba(245,158,11,0.04)' }}>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.author?.display_name ?? '–'}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>@{p.author?.handle ?? '–'}</div>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{ fontSize: 11, background: 'var(--color-border)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-text-muted)' }}>{p.post_type}</span>
                    </td>
                    <td style={{ ...tableCellStyle, maxWidth: 350 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.body}</span>
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => void flagPost(p.id, false)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', cursor: 'pointer', color: '#B45309', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          Unflag
                        </button>
                        <button
                          onClick={() => void deletePost(p.id)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', cursor: 'pointer', color: '#DC2626', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent Posts (last 30)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Author</th>
                <th style={tableHeaderStyle}>Type</th>
                <th style={tableHeaderStyle}>Content</th>
                <th style={tableHeaderStyle}>Likes</th>
                <th style={tableHeaderStyle}>Posted</th>
                <th style={tableHeaderStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingPosts ? (
                Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} cols={6} />)
              ) : posts.length === 0 ? (
                <tr><td colSpan={6} style={{ ...tableCellStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No posts.</td></tr>
              ) : posts.map(p => (
                <tr key={p.id} style={{ background: p.is_flagged ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
                  <td style={tableCellStyle}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.author?.display_name ?? '–'}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>@{p.author?.handle ?? '–'}</div>
                  </td>
                  <td style={tableCellStyle}>
                    <span style={{ fontSize: 11, background: 'var(--color-border)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-text-muted)' }}>{p.post_type}</span>
                  </td>
                  <td style={{ ...tableCellStyle, maxWidth: 300 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.body}</span>
                  </td>
                  <td style={tableCellStyle}>{p.like_count}</td>
                  <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatDate(p.created_at)}</td>
                  <td style={tableCellStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => void flagPost(p.id, !p.is_flagged)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${p.is_flagged ? 'rgba(245,158,11,0.4)' : 'var(--color-border)'}`, background: p.is_flagged ? 'rgba(245,158,11,0.1)' : 'none', cursor: 'pointer', color: p.is_flagged ? '#B45309' : 'var(--color-text-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        {p.is_flagged ? 'Unflag' : 'Flag'}
                      </button>
                      <button
                        onClick={() => void deletePost(p.id)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', cursor: 'pointer', color: '#DC2626', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Recent Comments (last 30)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Author</th>
                <th style={tableHeaderStyle}>Comment</th>
                <th style={tableHeaderStyle}>Posted</th>
                <th style={tableHeaderStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingComments ? (
                Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} cols={4} />)
              ) : comments.length === 0 ? (
                <tr><td colSpan={4} style={{ ...tableCellStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No comments.</td></tr>
              ) : comments.map(c => (
                <tr key={c.id}>
                  <td style={tableCellStyle}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.author?.display_name ?? '–'}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>@{c.author?.handle ?? '–'}</div>
                  </td>
                  <td style={{ ...tableCellStyle, maxWidth: 350 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body}</span>
                  </td>
                  <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                  <td style={tableCellStyle}>
                    <button
                      onClick={() => void deleteComment(c.id)}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', cursor: 'pointer', color: '#DC2626', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

function ControlsSection() {
  const [announcement, setAnnouncement] = useState('')
  const [announcementMsg, setAnnouncementMsg] = useState('')

  function handleAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    if (!announcement.trim()) return
    setAnnouncementMsg('Announcement queued (integrate with notification system to dispatch).')
    setAnnouncement('')
    setTimeout(() => setAnnouncementMsg(''), 4000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionCard title="Staff & Role Invites">
        <StaffPanel />
      </SectionCard>

      <SectionCard title="Feature Flags" action={
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Backend integration pending</span>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { key: 'maintenance_mode', label: 'Maintenance Mode', desc: 'Show maintenance page to non-admin visitors' },
            { key: 'new_feed_algo',    label: 'New Feed Algorithm', desc: 'Enable experimental feed ranking' },
            { key: 'crypto_payments', label: 'Crypto Payments', desc: 'Allow Solana-based credit purchases' },
          ].map(flag => (
            <div key={flag.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{flag.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{flag.desc}</div>
              </div>
              <div style={{ width: 36, height: 20, borderRadius: 20, background: 'var(--color-border)', position: 'relative', cursor: 'not-allowed', opacity: 0.6 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Platform Announcement">
        <form onSubmit={handleAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            value={announcement}
            onChange={e => setAnnouncement(e.target.value)}
            placeholder="Write a platform-wide announcement…"
            rows={4}
            style={{ padding: '10px 12px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', resize: 'vertical', fontFamily: 'var(--font-sans)' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="submit" className="btn btn-primary" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Megaphone size={13} /> Send Announcement
            </button>
            {announcementMsg && <span style={{ fontSize: 12, color: '#059669' }}>{announcementMsg}</span>}
          </div>
        </form>
      </SectionCard>
    </div>
  )
}

interface PurchaseRow {
  id: string
  credits: number
  amount_cents: number
  status: string
  created_at: string
  users: { display_name: string; handle: string } | null
}

interface PaymentTotals {
  completed: number
  failed: number
  totalCents: number
}

function PaymentsSection({ authHeaders }: SectionProps) {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [totals, setTotals] = useState<PaymentTotals>({ completed: 0, failed: 0, totalCents: 0 })
  const [err, setErr] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setErr('')
      try {
        const params = new URLSearchParams()
        if (statusFilter) params.set('status', statusFilter)
        const res = await fetch(`/api/admin/purchases?${params}`, { headers: authHeaders() })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
        const data = await res.json()
        setPurchases(data.purchases ?? [])
        if (data.totals) setTotals(data.totals)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load payments')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [statusFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {err && <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard label="Completed Payments" value={totals.completed} icon={<CheckCircle size={18} />} color="#059669" />
        <StatCard label="Failed Payments" value={totals.failed} icon={<XCircle size={18} />} color="#DC2626" />
        <StatCard label="Total Revenue" value={formatDollars(totals.totalCents)} icon={<DollarSign size={18} />} color="#7C3AED" />
      </div>

      <SectionCard title="Recent Transactions" action={
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      }>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>User</th>
                <th style={tableHeaderStyle}>Credits</th>
                <th style={tableHeaderStyle}>Amount</th>
                <th style={tableHeaderStyle}>Status</th>
                <th style={tableHeaderStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} cols={5} />)
              ) : purchases.length === 0 ? (
                <tr><td colSpan={5} style={{ ...tableCellStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No transactions found.</td></tr>
              ) : purchases.map(p => (
                <tr key={p.id}>
                  <td style={tableCellStyle}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.users?.display_name ?? '–'}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>@{p.users?.handle ?? '–'}</div>
                  </td>
                  <td style={{ ...tableCellStyle, fontVariantNumeric: 'tabular-nums' }}>{p.credits} cr</td>
                  <td style={{ ...tableCellStyle, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatDollars(p.amount_cents)}</td>
                  <td style={tableCellStyle}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: p.status === 'completed' ? 'rgba(5,150,105,0.12)' : p.status === 'failed' ? 'rgba(220,38,38,0.1)' : 'rgba(107,114,128,0.1)',
                      color: p.status === 'completed' ? '#059669' : p.status === 'failed' ? '#DC2626' : '#6B7280',
                    }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

function DomainsSection() {
  const domains = [
    {
      domain: 'traydbook.com',
      label: 'Marketing Site',
      env: 'Production',
      status: 'operational',
      note: 'Public-facing landing page. Hosted on Replit.',
    },
    {
      domain: 'app.traydbook.com',
      label: 'Web App',
      env: 'Production',
      status: 'operational',
      note: 'Main application. Supabase backend, React frontend.',
    },
    {
      domain: 'secure.traydbook.com',
      label: 'Auth / API',
      env: 'Production',
      status: 'operational',
      note: 'Supabase auth and API endpoint. Managed by Supabase.',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 13, color: '#B45309', display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={14} />
        Domain status cards are informational labels only. No live ping checks are performed.
      </div>

      {domains.map(d => (
        <div key={d.domain} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 3,
            background: d.status === 'operational' ? '#059669' : d.status === 'degraded' ? '#D97706' : '#DC2626',
            boxShadow: `0 0 0 3px ${d.status === 'operational' ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.15)'}`,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 15, fontFamily: 'monospace' }}>{d.domain}</span>
              <span style={{ fontSize: 11, background: 'var(--color-border)', padding: '2px 8px', borderRadius: 20, color: 'var(--color-text-muted)', fontWeight: 700 }}>{d.label}</span>
              <span style={{ fontSize: 11, background: 'rgba(37,99,235,0.1)', padding: '2px 8px', borderRadius: 20, color: '#2563EB', fontWeight: 700 }}>{d.env}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: d.status === 'operational' ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.1)',
                color: d.status === 'operational' ? '#059669' : '#DC2626',
              }}>
                {d.status.toUpperCase()}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>{d.note}</p>
          </div>
          <a href={`https://${d.domain}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
            <ExternalLink size={14} />
          </a>
        </div>
      ))}

      <SectionCard title="Environment Labels">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Supabase Project', value: 'traydbook (production)', color: '#059669' },
            { label: 'Auth Provider',    value: 'Supabase Auth (email + OAuth)', color: '#2563EB' },
            { label: 'Payments',         value: 'Stripe (live mode)', color: '#7C3AED' },
            { label: 'SMS Alerts',       value: 'Telnyx (production)', color: '#D97706' },
            { label: 'Hosting',          value: 'Replit Deployments', color: '#0891B2' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', minWidth: 140 }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
