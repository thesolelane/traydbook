import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface BreakdownItem {
  label: string
  earned: boolean
  points: number
  tip: string
}

interface TrustScoreData {
  trust_score: number
  updated_at: string | null
  breakdown: BreakdownItem[]
}

interface Props {
  userId: string
  isOwn?: boolean
  size?: 'sm' | 'md' | 'lg'
}

function scoreColor(score: number): string {
  if (score >= 80) return '#10B981'
  if (score >= 60) return '#F59E0B'
  if (score >= 40) return '#F97316'
  return '#EF4444'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Getting started'
}

export default function TrustScoreBadge({ userId, isOwn = false, size = 'md' }: Props) {
  const [data, setData] = useState<TrustScoreData | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch(`/api/contractor/${userId}/trust-score`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (res.ok) setData(await res.json())
    }
    load()
  }, [userId])

  if (!data) return null

  const score = data.trust_score
  const color = scoreColor(score)
  const dim = size === 'sm' ? 36 : size === 'lg' ? 64 : 48
  const strokeW = size === 'sm' ? 3 : 4
  const radius = dim / 2 - strokeW
  const circumference = 2 * Math.PI * radius
  const dash = (score / 100) * circumference

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => isOwn && setShowBreakdown(v => !v)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: isOwn ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
        title={isOwn ? 'Click to see your Trust Score breakdown' : `Trust Score: ${score}`}
      >
        {/* Ring */}
        <svg width={dim} height={dim} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={strokeW}
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        {/* Number overlay */}
        <span
          style={{
            position: 'absolute',
            left: 0,
            width: dim,
            textAlign: 'center',
            fontFamily: 'var(--font-condensed)',
            fontSize: size === 'sm' ? 11 : size === 'lg' ? 18 : 13,
            fontWeight: 800,
            color,
            lineHeight: `${dim}px`,
            pointerEvents: 'none',
          }}
        >
          {score}
        </span>

        {size !== 'sm' && (
          <div>
            <div
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: size === 'lg' ? 15 : 13,
                fontWeight: 700,
                color,
                lineHeight: 1,
              }}
            >
              Trust Score
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                marginTop: 2,
              }}
            >
              {scoreLabel(score)}
              {isOwn && <span style={{ marginLeft: 4, opacity: 0.6 }}>· click for breakdown</span>}
            </div>
          </div>
        )}
      </button>

      {/* Breakdown panel — own profile only */}
      {isOwn && showBreakdown && (
        <div
          style={{
            position: 'absolute',
            top: dim + 8,
            left: 0,
            zIndex: 200,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
            width: 300,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-condensed)',
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--color-text)',
              marginBottom: 12,
            }}
          >
            Trust Score Breakdown
          </div>

          {data.breakdown.map(item => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 10,
                opacity: item.earned ? 1 : 0.55,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: item.earned ? '#10B981' : 'var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 10,
                  color: '#fff',
                  fontWeight: 700,
                  marginTop: 1,
                }}
              >
                {item.earned ? '✓' : '·'}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    color: 'var(--color-text)',
                    fontWeight: 600,
                  }}
                >
                  <span>{item.label}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-condensed)',
                      color: item.earned ? '#10B981' : 'var(--color-text-muted)',
                    }}
                  >
                    +{item.points}
                  </span>
                </div>
                {!item.earned && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {item.tip}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: 10,
              marginTop: 4,
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-condensed)',
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--color-text)',
            }}
          >
            <span>Total</span>
            <span style={{ color }}>{score} / 100</span>
          </div>

          <button
            onClick={() => setShowBreakdown(false)}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '7px',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontFamily: 'var(--font-condensed)',
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
