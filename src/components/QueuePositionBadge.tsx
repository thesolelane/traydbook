import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface QueueData {
  position: number
  total: number
  trade: string
  trust_score: number
  score_to_advance: number | null
  percentile: number
}

interface Props {
  userId: string
}

function positionColor(position: number, total: number): string {
  const pct = total > 1 ? (position - 1) / (total - 1) : 0
  if (pct <= 0.1) return '#10B981'
  if (pct <= 0.3) return '#F59E0B'
  if (pct <= 0.6) return '#F97316'
  return 'var(--color-text-muted)'
}

export default function QueuePositionBadge({ userId }: Props) {
  const [data, setData] = useState<QueueData | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch(`/api/contractor/${userId}/queue-position`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (res.ok) setData(await res.json())
    }
    load()
  }, [userId])

  if (!data) return null

  const color = positionColor(data.position, data.total)

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 180,
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
        }}
      >
        Queue Position · {data.trade}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontFamily: 'var(--font-condensed)',
            fontSize: 28,
            fontWeight: 900,
            color,
            lineHeight: 1,
          }}
        >
          #{data.position}
        </span>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>of {data.total}</span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: 'var(--color-border)',
          borderRadius: 2,
          overflow: 'hidden',
          marginTop: 2,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${data.percentile}%`,
            background: color,
            borderRadius: 2,
            transition: 'width 0.6s ease',
          }}
        />
      </div>

      {data.position === 1 ? (
        <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600, marginTop: 2 }}>
          Top of queue — first to receive leads
        </div>
      ) : data.score_to_advance !== null ? (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
          +{data.score_to_advance} Trust Score pts to move up
        </div>
      ) : null}
    </div>
  )
}
