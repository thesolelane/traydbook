import { MapPin, Star, CheckCircle, Briefcase, Award, Edit2 } from 'lucide-react';
import { currentUser, posts } from '../data/mockData';
import PostCard from '../components/PostCard';

export default function Profile() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <div className="card" style={{ padding: 28, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="avatar-placeholder" style={{ width: 80, height: 80, background: currentUser.avatarColor, fontSize: 26, flexShrink: 0 }}>
            {currentUser.initials}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontWeight: 800, fontSize: 22, color: 'var(--color-text)' }}>{currentUser.name}</h1>
              {currentUser.verified && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#EFF6FF', padding: '3px 10px', borderRadius: 20 }}>
                  <CheckCircle size={13} color="#2563EB" fill="#2563EB" />
                  <span style={{ fontSize: 12, color: '#2563EB', fontWeight: 700 }}>Verified</span>
                </div>
              )}
              <span className="badge badge-brand">{currentUser.trade}</span>
            </div>
            <p style={{ fontSize: 15, color: 'var(--color-text-muted)', marginTop: 4 }}>{currentUser.title}</p>
            {currentUser.company && (
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{currentUser.company}</p>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--color-text-muted)' }}>
                <MapPin size={13} /> {currentUser.location}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#D97706', fontWeight: 600 }}>
                <Star size={13} fill="#D97706" /> {currentUser.rating} ({currentUser.reviewCount} reviews)
              </span>
            </div>
          </div>

          <button className="btn btn-ghost" style={{ flexShrink: 0 }}>
            <Edit2 size={14} /> Edit Profile
          </button>
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--color-text)' }}>{currentUser.jobsCompleted}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Jobs Completed</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--color-text)' }}>{currentUser.yearsExp}yr</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Experience</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--color-text)' }}>{currentUser.rating}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Rating</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--color-text)' }}>{currentUser.reviewCount}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Reviews</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Briefcase size={16} color="var(--color-brand)" /> About
            </h3>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-muted)' }}>{currentUser.bio}</p>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={16} color="var(--color-brand)" /> Skills & Specialties
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {currentUser.skills.map(skill => (
                <span key={skill} className="tag" style={{ fontSize: 13 }}>{skill}</span>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: 'var(--color-text)' }}>Recent Posts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {posts.slice(0, 2).map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </div>
        </div>

        <aside style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Licenses & Certs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { title: 'Master Electrician', issuer: 'Texas TDLR', year: '2018' },
                { title: 'IBEW Member', issuer: 'IBEW Local 520', year: '2014' },
                { title: 'OSHA 30', issuer: 'OSHA', year: '2022' },
              ].map(cert => (
                <div key={cert.title} style={{ paddingBottom: 12, borderBottom: '1px solid var(--color-border-light)' }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>{cert.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>{cert.issuer} · {cert.year}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        @media (max-width: 700px) {
          aside { width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
