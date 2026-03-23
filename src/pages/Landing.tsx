import { Link } from 'react-router-dom'
import '../styles/landing.css'

const trades = [
  'Electricians', 'Plumbers', 'HVAC Techs', 'Carpenters', 'Ironworkers',
  'Masons', 'Painters', 'Roofers', 'Welders', 'General Contractors',
]

const features = [
  {
    icon: '🏗️',
    title: 'Post Your Work',
    desc: 'Share project photos, milestones, and trade tips with a professional network that actually understands your craft.',
  },
  {
    icon: '📋',
    title: 'Submit Bids',
    desc: 'Browse real RFQs posted by verified project owners. Submit bids directly and win more contracts.',
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
        <div className="landing-logo">
          <span className="landing-logo-mark">T</span>
          <span>traydbook</span>
        </div>
        <div className="landing-header-actions">
          <Link to="/login" className="btn-ghost">Sign In</Link>
          <Link to="/signup" className="btn-primary">Join Free</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-badge">Free for all trade accounts — always</div>
          <h1 className="landing-headline">
            The professional network<br />
            built for the<br />
            <span className="landing-headline-accent">construction trades</span>
          </h1>
          <p className="landing-subhead">
            Post work, find jobs, submit bids, and build a verified reputation.
            Connect with contractors, project owners, and design professionals.
          </p>
          <div className="landing-cta-row">
            <Link to="/signup" className="btn-primary btn-lg">Create Your Free Account</Link>
            <Link to="/login" className="btn-outline btn-lg">Sign In</Link>
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
              </div>
              <div className="lmc-img" />
              <div className="lmc-body">Finished rough-in on a 24-unit residential build. 3 weeks ahead of schedule. #Electrical #Residential</div>
              <div className="lmc-stats">
                <span>❤️ 142</span>
                <span>💬 18</span>
                <span>✅ Verified License</span>
              </div>
            </div>
            <div className="landing-mock-card landing-mock-card--offset">
              <div className="lmc-header">
                <div className="lmc-avatar lmc-avatar--2" />
                <div>
                  <div className="lmc-name">Rivera Construction</div>
                  <div className="lmc-meta">Open Bid · Denver, CO</div>
                </div>
              </div>
              <div className="lmc-body">
                <strong>RFQ: Commercial Plumbing Install</strong><br />
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
        <span>© 2025 traydbook</span>
        <span>·</span>
        <a href="#">Privacy</a>
        <span>·</span>
        <a href="#">Terms</a>
      </footer>
    </div>
  )
}
