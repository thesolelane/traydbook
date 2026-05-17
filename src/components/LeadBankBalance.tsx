import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layers, TrendingUp, TrendingDown } from 'lucide-react'

interface LedgerEntry {
  id: string
  delta: number
  balance_after: number
  reason: string
  created_at: string
}

interface BankData {
  balance: number
  ledger: LedgerEntry[]
}

interface Props {
  userId: string
}

function friendlyReason(reason: string): string {
  const map: Record<string, string> = {
    manual_grant: 'Leads granted',
    lead_claimed: 'Lead claimed',
    lead_returned: 'Lead returned',
    lead_expired: 'Lead expired',
    admin_adjustment: 'Admin adjustment',
  }
  return map[reason] ?? reason.replace(/_/g, ' ')
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function LeadBankBalance({ userId }: Props) {
  const [data, setData] = useState<BankData | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch('/api/lead-bank/balance', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (res.ok) setData(await res.json())
    }
    load()
  }, [userId])

  if (!data) return null

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        minWidth: 180,
        display: 'inline-block',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-condensed)',
          marginBottom: 4,
        }}
      >
        Lead Bank
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <Layers size={16} color="var(--color-brand)" />
        <span
          style={{
            fontFamily: 'var(--font-condensed)',
            fontSize: 28,
            fontWeight: 900,
            color: data.balance > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
            lineHeight: 1,
          }}
        >
          {data.balance}
        </span>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {data.balance === 1 ? 'lead' : 'leads'}
        </span>
      </div>

      {data.balance === 0 && (
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          No leads in your bank yet
        </p>
      )}

      {data.ledger.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              color: 'var(--color-brand)',
              padding: '4px 0 0',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {expanded ? 'Hide history' : `View history (${data.ledger.length})`}
          </button>

          {expanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.ledger.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12,
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {entry.delta >= 0 ? (
                      <TrendingUp size={11} color="#10B981" />
                    ) : (
                      <TrendingDown size={11} color="#DC2626" />
                    )}
                    <span style={{ color: 'var(--color-text)' }}>
                      {friendlyReason(entry.reason)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: entry.delta >= 0 ? '#10B981' : '#DC2626',
                      }}
                    >
                      {entry.delta >= 0 ? '+' : ''}
                      {entry.delta}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                      {timeAgo(entry.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
