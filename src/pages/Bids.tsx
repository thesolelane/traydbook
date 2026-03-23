import { Clock, CheckCircle, XCircle, Star as StarIcon } from 'lucide-react';
import { myBids } from '../data/mockData';

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: '#D97706', bg: '#FFFBEB', icon: <Clock size={13} /> },
  shortlisted: { label: 'Shortlisted', color: '#2563EB', bg: '#EFF6FF', icon: <StarIcon size={13} /> },
  accepted: { label: 'Accepted', color: '#059669', bg: '#ECFDF5', icon: <CheckCircle size={13} /> },
  rejected: { label: 'Not Selected', color: '#DC2626', bg: '#FEF2F2', icon: <XCircle size={13} /> },
};

export default function Bids() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontWeight: 800, fontSize: 26, color: 'var(--color-text)' }}>My Bids</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Track all your submitted bids and their status
        </p>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        {['Total', 'Pending', 'Shortlisted', 'Accepted', 'Not Selected'].map((label) => {
          const count = label === 'Total' ? myBids.length :
            myBids.filter(b => b.status === label.toLowerCase().replace(' ', '')).length;
          return (
            <div key={label} className="card" style={{ padding: '14px 20px', flex: 1, minWidth: 120, textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--color-text)' }}>{count}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {myBids.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <p style={{ fontWeight: 600, fontSize: 16 }}>No bids yet</p>
            <p style={{ fontSize: 14, marginTop: 6 }}>Browse the job board and submit your first bid</p>
          </div>
        ) : (
          myBids.map(bid => {
            const status = statusConfig[bid.status];
            return (
              <div key={bid.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>{bid.jobTitle}</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>{bid.company}</p>
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Your Bid</p>
                        <p style={{ fontWeight: 700, fontSize: 16, color: '#059669', marginTop: 2 }}>{bid.amount}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Submitted</p>
                        <p style={{ fontSize: 14, marginTop: 2, color: 'var(--color-text-muted)' }}>{bid.submittedAt}</p>
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 14px',
                    borderRadius: 20,
                    background: status.bg,
                    color: status.color,
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {status.icon} {status.label}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
