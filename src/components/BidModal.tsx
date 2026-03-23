import { X } from 'lucide-react';
import { Job } from '../data/mockData';
import { useState } from 'react';

interface BidModalProps {
  job: Job;
  onClose: () => void;
  onSubmit: (jobId: string, amount: string, message: string) => void;
}

export default function BidModal({ job, onClose, onSubmit }: BidModalProps) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount.trim()) return;
    onSubmit(job.id, amount, message);
    setSubmitted(true);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div
        className="card"
        style={{ width: '100%', maxWidth: 500, padding: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Submit Bid</h2>
          <button style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', padding: 4 }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 56, height: 56,
              background: '#ECFDF5',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 24,
            }}>✓</div>
            <h3 style={{ fontWeight: 700, fontSize: 17, color: '#059669' }}>Bid Submitted!</h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 8 }}>
              Your bid for <strong>{job.title}</strong> has been submitted. You'll be notified when the company responds.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>Bidding on:</p>
              <p style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{job.title}</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{job.company} · {job.location}</p>
              {job.budget && (
                <p style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 4 }}>Budget: {job.budget}</p>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 20 }} />

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Your Bid Amount *
              </label>
              <input
                type="text"
                placeholder="e.g. $290,000 or $45/hr"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Cover Message
              </label>
              <textarea
                placeholder="Briefly describe your relevant experience and why you're the right fit..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 14,
                  resize: 'vertical',
                  outline: 'none',
                  lineHeight: 1.6,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                Submit Bid
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
