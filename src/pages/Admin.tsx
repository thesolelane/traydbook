import { useState } from 'react'
import {
  BarChart2,
  Users,
  Wallet,
  MessageSquare,
  Settings,
  CreditCard,
  Globe,
  Shield,
  KeyRound,
  AlertTriangle,
  ShieldAlert,
  ClipboardList,
  ScrollText,
  LogOut,
  Terminal,
  Bot,
  Bug,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSuperAdmin } from '../lib/roles'
import OverviewSection from './admin/OverviewSection'
import UsersSection from './admin/UsersSection'
import WalletsSection from './admin/WalletsSection'
import FeedSection from './admin/FeedSection'
import ControlsSection from './admin/ControlsSection'
import PaymentsSection from './admin/PaymentsSection'
import DomainsSection from './admin/DomainsSection'
import SecretsSection from './admin/SecretsSection'
import ErrorLogSection from './admin/ErrorLogSection'
import ThreatMonitorSection from './admin/ThreatMonitorSection'
import ModerationQueueSection from './admin/ModerationQueueSection'
import AuditLogSection from './admin/AuditLogSection'
import SessionRevokeSection from './admin/SessionRevokeSection'
import AiCommandSection from './admin/AiCommandSection'
import BobMonitorSection from './admin/BobMonitorSection'
import SecurityScanSection from './admin/SecurityScanSection'

type Section =
  | 'overview'
  | 'users'
  | 'wallets'
  | 'feed'
  | 'controls'
  | 'payments'
  | 'domains'
  | 'secrets'
  | 'errors'
  | 'threats'
  | 'moderation'
  | 'audit'
  | 'revoke'
  | 'ai'
  | 'bob'
  | 'code-scan'

type NavItem = { id: Section; label: string; icon: React.ReactNode; superOnly?: boolean }

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Business',
    items: [
      { id: 'overview', label: 'Analytics Overview', icon: <BarChart2 size={16} /> },
      { id: 'users', label: 'User Management', icon: <Users size={16} /> },
      { id: 'wallets', label: 'Wallet & Credits', icon: <Wallet size={16} /> },
      { id: 'feed', label: 'Feed Moderation', icon: <MessageSquare size={16} /> },
      { id: 'payments', label: 'Stripe & Payments', icon: <CreditCard size={16} /> },
      { id: 'errors', label: 'Error Log', icon: <AlertTriangle size={16} />, superOnly: true },
    ],
  },
  {
    label: 'Agent / Bob',
    items: [
      { id: 'bob', label: 'Bob Monitor', icon: <Bot size={16} /> },
      { id: 'ai', label: 'AI Command Bar', icon: <Terminal size={16} />, superOnly: true },
    ],
  },
  {
    label: 'Security',
    items: [
      { id: 'threats', label: 'Threat Monitor', icon: <ShieldAlert size={16} /> },
      { id: 'moderation', label: 'Moderation Queue', icon: <ClipboardList size={16} /> },
      { id: 'audit', label: 'Audit Log', icon: <ScrollText size={16} /> },
      { id: 'revoke', label: 'Session Revoke', icon: <LogOut size={16} />, superOnly: true },
      { id: 'domains', label: 'Domain Status', icon: <Globe size={16} /> },
      { id: 'secrets', label: 'Secrets & Env', icon: <KeyRound size={16} /> },
      { id: 'controls', label: 'Platform Controls', icon: <Settings size={16} /> },
      { id: 'code-scan', label: 'Code Security', icon: <Bug size={16} /> },
    ],
  },
]

const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)

export default function Admin() {
  const { session, profile } = useAuth()
  const [section, setSection] = useState<Section>('overview')
  const isSuperAdminUser = isSuperAdmin(profile?.account_type)

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--color-bg)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: '0 20px 20px',
            borderBottom: '1px solid var(--color-border)',
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color="var(--color-brand)" />
            <span
              style={{
                fontFamily: 'var(--font-condensed)',
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: '0.5px',
              }}
            >
              ADMIN
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {isSuperAdminUser ? 'Super Admin' : 'Admin'}
          </div>
        </div>

        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} style={{ marginTop: gi === 0 ? 0 : 16 }}>
            <div
              style={{
                padding: '0 20px 6px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-text-light)',
                fontFamily: 'var(--font-condensed)',
              }}
            >
              {group.label}
            </div>
            {group.items
              .filter(item => !item.superOnly || isSuperAdminUser)
              .map(item => (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 20px',
                    width: '100%',
                    background: section === item.id ? 'rgba(226,114,42,0.1)' : 'none',
                    border: 'none',
                    borderRight:
                      section === item.id
                        ? '3px solid var(--color-brand)'
                        : '3px solid transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 13,
                    fontWeight: 600,
                    color:
                      item.id === 'errors'
                        ? section === item.id
                          ? '#e05252'
                          : '#e05252cc'
                        : section === item.id
                          ? 'var(--color-brand)'
                          : 'var(--color-text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
          </div>
        ))}
      </aside>

      <main style={{ flex: 1, padding: 32, maxWidth: 1100, minWidth: 0 }}>
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 900,
              fontSize: 26,
              margin: 0,
              letterSpacing: '0.5px',
            }}
          >
            {NAV_ITEMS.find(n => n.id === section)?.label}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Traydbook Admin Control Center
          </p>
        </div>

        {section === 'overview' && <OverviewSection authHeaders={authHeaders} />}
        {section === 'users' && <UsersSection authHeaders={authHeaders} />}
        {section === 'wallets' && <WalletsSection authHeaders={authHeaders} />}
        {section === 'feed' && <FeedSection authHeaders={authHeaders} />}
        {section === 'controls' && <ControlsSection authHeaders={authHeaders} />}
        {section === 'payments' && <PaymentsSection authHeaders={authHeaders} />}
        {section === 'domains' && <DomainsSection authHeaders={authHeaders} />}
        {section === 'secrets' && <SecretsSection authHeaders={authHeaders} />}
        {section === 'errors' && <ErrorLogSection authHeaders={authHeaders} />}
        {section === 'threats' && <ThreatMonitorSection authHeaders={authHeaders} />}
        {section === 'moderation' && <ModerationQueueSection authHeaders={authHeaders} />}
        {section === 'audit' && <AuditLogSection authHeaders={authHeaders} />}
        {section === 'revoke' && <SessionRevokeSection authHeaders={authHeaders} />}
        {section === 'ai' && <AiCommandSection authHeaders={authHeaders} />}
        {section === 'bob' && <BobMonitorSection authHeaders={authHeaders} />}
        {section === 'code-scan' && <SecurityScanSection authHeaders={authHeaders} />}
      </main>
    </div>
  )
}
