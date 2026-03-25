import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
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

const POST_TYPE_META: Record<string, { icon: string; label: string }> = {
  project_update: { icon: '🏗️', label: 'Project Update' },
  open_bid:       { icon: '📋', label: 'Open Bid' },
  urgent_hire:    { icon: '🔴', label: 'Urgent Hire' },
  trade_tip:      { icon: '💡', label: 'Trade Tip' },
  safety_alert:   { icon: '⚠️', label: 'Safety Alert' },
  referral:       { icon: '⭐', label: 'Referral' },
}

const FALLBACK_TICKER = [
  { key: 'f1', text: '🔨 James M. joined as Electrician · Houston, TX' },
  { key: 'f2', text: '📋 New RFQ posted: Roofing Install · Phoenix, AZ' },
  { key: 'f3', text: '🏗️ Project Update: 18-unit build complete · Chicago, IL' },
  { key: 'f4', text: '👷 Maria G. joined as General Contractor · Miami, FL' },
  { key: 'f5', text: '📋 New RFQ posted: Commercial Plumbing · Denver, CO' },
  { key: 'f6', text: '💡 Trade Tip shared: Estimating HVAC systems · Atlanta, GA' },
  { key: 'f7', text: '🔨 Carlos R. joined as Mason · San Antonio, TX' },
  { key: 'f8', text: '🏗️ Project Update: Bridge repair phase 2 complete · Seattle, WA' },
]

const BLOG_POSTS = [
  {
    id: 1,
    category: 'Contractor Tips',
    title: 'How to Win More Bids Without Lowering Your Price',
    excerpt: 'The contractors winning on TraydBook aren\'t the cheapest — they\'re the most credible. Here\'s how to present your bid to win at the price you deserve.',
    readTime: '4 min read',
    accent: '#e85d04',
  },
  {
    id: 2,
    category: 'Platform Guide',
    title: 'Getting Your Verified Badge: A Step-by-Step Walkthrough',
    excerpt: 'Your Pro Verified badge is the fastest way to stand out on the Explore page and signal to project owners that you\'re the real deal. Here\'s exactly what you need.',
    readTime: '3 min read',
    accent: '#3b82f6',
  },
  {
    id: 3,
    category: 'Industry Insight',
    title: 'Why Contractors Are Leaving Angi — And Where They\'re Going',
    excerpt: 'Lead-gen fees, non-exclusive leads, and review manipulation have pushed thousands of trade professionals to seek better alternatives.',
    readTime: '6 min read',
    accent: '#22c55e',
  },
]

interface TickerItem { key: string; text: string }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function ActivityTicker({ items }: { items: TickerItem[] }) {
  const doubled = [...items, ...items]
  return (
    <div className="landing-ticker">
      <div className="landing-ticker-label">LIVE</div>
      <div className="landing-ticker-track">
        <div className="landing-ticker-inner" style={{ animationDuration: `${Math.max(20, items.length * 4)}s` }}>
          {doubled.map((item, i) => (
            <span key={`${item.key}-${i}`} className="landing-ticker-item">
              {item.text}
              <span className="landing-ticker-sep">·</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const [tickerItems, setTickerItems] = useState<TickerItem[]>(FALLBACK_TICKER)
  const [todayCount, setTodayCount] = useState<number | null>(null)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, trade, location, created_at')
        .gte('created_at', since48h)
        .order('created_at', { ascending: false })
        .limit(15),

      supabase
        .from('posts')
        .select('id, post_type, location, created_at')
        .gte('created_at', since48h)
        .order('created_at', { ascending: false })
        .limit(15),

      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString()),
    ]).then(([profilesRes, postsRes, countRes]) => {
      const items: TickerItem[] = []

      for (const p of profilesRes.data ?? []) {
        const firstName = (p.full_name ?? '').split(' ')[0]
        const lastInitial = (p.full_name ?? '').split(' ')[1]?.[0]
        const name = lastInitial ? `${firstName} ${lastInitial}.` : firstName
        const trade = p.trade ?? 'Tradesperson'
        const loc = p.location ? ` · ${p.location}` : ''
        const when = timeAgo(p.created_at)
        items.push({ key: `p-${p.id}`, text: `🔨 ${name} joined as ${trade}${loc} · ${when}` })
      }

      for (const post of postsRes.data ?? []) {
        const meta = POST_TYPE_META[post.post_type] ?? { icon: '📌', label: post.post_type }
        const loc = post.location ? ` · ${post.location}` : ''
        const when = timeAgo(post.created_at)
        items.push({ key: `post-${post.id}`, text: `${meta.icon} New ${meta.label} posted${loc} · ${when}` })
      }

      if (items.length >= 4) {
        items.sort(() => Math.random() - 0.5)
        setTickerItems(items)
      }

      if (countRes.count !== null) setTodayCount(countRes.count)
    })
  }, [])

  return (
    <div className="landing">
      <header className="landing-header">
        <TraydBookNavLogo />
        <div className="landing-header-actions">
          <Link to="/login" className="btn-ghost">Sign In</Link>
          <Link to="/signup" className="btn-primary">Join Free</Link>
        </div>
      </header>

      <ActivityTicker items={tickerItems} />

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
            <Link to="/signup/trade-select" className="btn-primary btn-lg">
              Join as Contractor
            </Link>
            <Link to="/signup" state={{ preselectOwner: true }} className="btn-outline btn-lg">
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
        {todayCount !== null && todayCount > 0 && (
          <>
            <div className="landing-proof-stat">
              <div className="landing-proof-number landing-proof-live">
                <span className="landing-live-dot" />
                {todayCount}
              </div>
              <div className="landing-proof-label">New Members Today</div>
            </div>
            <div className="landing-proof-divider" />
          </>
        )}
        <div className="landing-proof-stat">
          <div className="landing-proof-number">$2.4B+</div>
          <div className="landing-proof-label">Work Value Tracked</div>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-stat">
          <div className="landing-proof-number">4.9★</div>
          <div className="landing-proof-label">Avg Contractor Rating</div>
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

      {/* ── Blog / Insights section ── */}
      <section className="landing-blog">
        <div className="landing-blog-header">
          <div>
            <h2 className="landing-section-title" style={{ textAlign: 'left', marginBottom: 6 }}>
              From the TraydBook Blog
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>
              Tips, guides, and insights for trade professionals.
            </p>
          </div>
          <Link to="/login" className="btn-outline" style={{ flexShrink: 0 }}>
            View All Posts
          </Link>
        </div>
        <div className="landing-blog-grid">
          {BLOG_POSTS.map(post => (
            <article key={post.id} className="landing-blog-card">
              <div className="lbc-accent" style={{ background: post.accent }} />
              <div className="lbc-body">
                <div className="lbc-category" style={{ color: post.accent }}>{post.category}</div>
                <h3 className="lbc-title">{post.title}</h3>
                <p className="lbc-excerpt">{post.excerpt}</p>
                <div className="lbc-footer">
                  <span className="lbc-read-time">{post.readTime}</span>
                  <Link to="/login" className="lbc-read-more">Read article →</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta-section">
        <h2>Ready to grow your trade career?</h2>
        <p>Contractors and tradespeople are always free. No credit card needed.</p>
        <Link to="/signup" className="btn-primary btn-lg">Get Started for Free</Link>
      </section>

      <footer className="landing-footer">
        <TraydBookNavLogo />
        <div className="landing-footer-links">
          <Link to="/login">Sign In</Link>
          <Link to="/signup">Join Free</Link>
          <a href="#">Blog</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
        <span className="landing-footer-copy">© 2026 TraydBook</span>
      </footer>
    </div>
  )
}
