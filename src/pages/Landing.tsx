import { Link } from 'react-router-dom'
import '../styles/landing.css'

function TraydBookNavLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{
        width: 30, height: 30, background: '#e85d04', borderRadius: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg viewBox="0 0 17 17" fill="none" width={16} height={16}>
          <rect x="2" y="1.5" width="9" height="13" rx="1.5" fill="rgba(255,255,255,0.12)" stroke="white" strokeWidth="1.2" />
          <rect x="5" y="1.5" width="9" height="13" rx="1.5" fill="rgba(255,255,255,0.25)" stroke="white" strokeWidth="1.2" />
          <path d="M7 6h4M7 9h3M7 12h2" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      <span style={{ fontFamily: 'var(--font-condensed)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>
        <span style={{ color: '#f0ece6' }}>Trayd</span><span style={{ color: '#e85d04' }}>Book</span>
      </span>
    </div>
  )
}

const trades = [
  'Electricians', 'Plumbers', 'HVAC Techs', 'Carpenters', 'Ironworkers',
  'Masons', 'Painters', 'Roofers', 'Welders', 'General Contractors',
]

const features = [
  {
    icon: '🏗️',
    title: 'Post Your Work',
    desc: 'Share project photos, milestones, and trade tips with a professional network that understands your craft.',
  },
  {
    icon: '📋',
    title: 'Submit Bids',
    desc: 'Browse real RFQs posted by verified project owners. Submit structured bids and win more contracts.',
  },
  {
    icon: '💼',
    title: 'Find Good Jobs',
    desc: 'Filter by trade, pay, location, and job type. Apply in seconds with your verified profile.',
  },
  {
    icon: '⭐',
    title: 'Build Your Reputation',
    desc: 'Verified credentials, client reviews, and a portfolio of completed work — all in one place.',
  },
]

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <TraydBookNavLogo />
        <div className="landing-header-actions">
          <Link to="/login" className="btn-ghost">Sign In</Link>
          <Link to="/signup" className="btn-primary">Join Free</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-badge">Free for all trade accounts — always</div>
          <h1 className="landing-headline">
            The professional network<br />built for the<br />
            <span className="landing-headline-accent">construction trades</span>
          </h1>
          <p className="landing-subhead">
            Post work, find jobs, submit bids, and build a verified reputation.
            Connect with contractors, project owners, and design professionals.
          </p>
          <div className="landing-cta-row">
            <Link
              to="/signup/trade-select"
              className="btn-primary btn-lg"
            >
              Join as Contractor
            </Link>
            <Link
              to="/signup"
              state={{ preselectOwner: true }}
              className="btn-outline btn-lg"
            >
              Find a Contractor
            </Link>
          </div>
          <div className="landing-trades-row">
            {trades.map(t => (
              <span key={t} className="landing-trade-chip">{t}</span>
            ))}
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-card-stack">
            <div className="landing-mock-card">
              <div className="lmc-header">
                <div className="lmc-avatar" />
                <div>
                  <div className="lmc-name">Mike R. · Licensed Electrician</div>
                  <div className="lmc-meta">Chicago, IL · ⭐ 4.9 (87 reviews)</div>
                </div>
                <span style={{
                  fontFamily: 'var(--font-condensed)', fontSize: 10, fontWeight: 700,
                  letterSpacing: 1, textTransform: 'uppercase',
                  padding: '3px 8px', borderRadius: 3,
                  background: 'rgba(232,93,4,0.12)', color: '#e85d04', marginLeft: 'auto',
                }}>Project</span>
              </div>
              <div className="lmc-img" />
              <div className="lmc-body">Finished rough-in on a 24-unit residential build. 3 weeks ahead of schedule. #Electrical #Residential</div>
              <div className="lmc-stats">
                <span>❤️ 142</span>
                <span>💬 18</span>
                <span style={{ color: '#2ecc71' }}>✓ Verified</span>
              </div>
            </div>
            <div className="landing-mock-card">
              <div className="lmc-header">
                <div className="lmc-avatar lmc-avatar--2" />
                <div>
                  <div className="lmc-name">Rivera Construction</div>
                  <div className="lmc-meta">Open Bid · Denver, CO</div>
                </div>
                <span style={{
                  fontFamily: 'var(--font-condensed)', fontSize: 10, fontWeight: 700,
                  letterSpacing: 1, textTransform: 'uppercase',
                  padding: '3px 8px', borderRadius: 3,
                  background: 'rgba(30,180,100,0.12)', color: '#2ecc71', marginLeft: 'auto',
                }}>RFQ</span>
              </div>
              <div className="lmc-body">
                <strong style={{ color: 'var(--color-text)' }}>Commercial Plumbing Install</strong><br />
                4,500 sq ft office build-out. Budget $80k–$120k. Bid deadline in 5 days.
              </div>
              <div className="lmc-stats">
                <span>📋 14 bids</span>
                <span>📍 Denver, CO</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-social-proof">
        <div className="landing-proof-stat">
          <div className="landing-proof-number">12,000+</div>
          <div className="landing-proof-label">Verified Contractors</div>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-stat">
          <div className="landing-proof-number">50,000+</div>
          <div className="landing-proof-label">Bids Submitted</div>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-stat">
          <div className="landing-proof-number">$2.4B+</div>
          <div className="landing-proof-label">Work Value Tracked</div>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-stat">
          <div className="landing-proof-number">4.9★</div>
          <div className="landing-proof-label">Average Contractor Rating</div>
        </div>
      </section>

      <section className="landing-features">
        <h2 className="landing-section-title">Everything your trade career needs</h2>
        <div className="landing-features-grid">
          {features.map(f => (
            <div key={f.title} className="landing-feature-card">
              <div className="lfc-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta-section">
        <h2>Ready to grow your trade career?</h2>
        <p>Contractors and tradespeople are always free. No credit card needed.</p>
        <Link to="/signup" className="btn-primary btn-lg">Get Started for Free</Link>
      </section>

      <footer className="landing-footer">
        <span>© 2025 TraydBook</span>
        <span>·</span>
        <a href="#">Privacy</a>
        <span>·</span>
        <a href="#">Terms</a>
      </footer>
    </div>
  )
}
