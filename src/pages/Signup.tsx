import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AccountType } from '../lib/database.types'
import '../styles/auth.css'

const accountTypes: {
  type: AccountType
  icon: string
  title: string
  desc: string
  badge?: string
  free?: boolean
}[] = [
  {
    type: 'contractor',
    icon: '🏗️',
    title: 'Contractor / Tradesperson',
    desc: 'Electricians, plumbers, HVAC, carpenters, and all skilled trades.',
    badge: 'Always Free',
    free: true,
  },
  {
    type: 'project_owner',
    icon: '📋',
    title: 'Project Owner',
    desc: 'Developers, investors, and commercial clients posting RFQs.',
    free: false,
  },
  {
    type: 'agent',
    icon: '🏠',
    title: 'Real Estate Agent',
    desc: 'Agents connecting trades with their clients and projects.',
    free: false,
  },
  {
    type: 'homeowner',
    icon: '🔑',
    title: 'Homeowner',
    desc: 'Homeowners looking for trusted trade professionals.',
    free: false,
  },
]

export default function Signup() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<AccountType | null>(null)

  function handleContinue() {
    if (!selected) return
    if (selected === 'contractor') {
      navigate('/signup/contractor', { state: { accountType: selected } })
    } else {
      navigate('/signup/owner', { state: { accountType: selected } })
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <Link to="/" className="auth-logo">
          <span className="auth-logo-mark">T</span>
          <span>traydbook</span>
        </Link>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Choose how you'll use traydbook</p>

        <div className="account-type-grid">
          {accountTypes.map(at => (
            <button
              key={at.type}
              className={`account-type-card ${selected === at.type ? 'selected' : ''}`}
              onClick={() => setSelected(at.type)}
            >
              <div className="atc-icon">{at.icon}</div>
              <div className="atc-title">{at.title}</div>
              <div className="atc-desc">{at.desc}</div>
              {at.badge && <div className="atc-badge">{at.badge}</div>}
              {!at.free && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  Credit-based access
                </div>
              )}
            </button>
          ))}
        </div>

        <button
          className="btn-primary btn-full"
          style={{ marginTop: 20 }}
          disabled={!selected}
          onClick={handleContinue}
        >
          Continue
        </button>

        <p className="auth-footer-text">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
