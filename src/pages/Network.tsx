import { useState } from 'react';
import { Search } from 'lucide-react';
import UserCard from '../components/UserCard';
import { users, tradeOptions } from '../data/mockData';

export default function Network() {
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('All Trades');

  const filtered = users.filter(user => {
    const matchSearch = !search || user.name.toLowerCase().includes(search.toLowerCase()) || user.trade.toLowerCase().includes(search.toLowerCase()) || user.location.toLowerCase().includes(search.toLowerCase());
    const matchTrade = tradeFilter === 'All Trades' || user.trade === tradeFilter;
    return matchSearch && matchTrade;
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontWeight: 800, fontSize: 26, color: 'var(--color-text)' }}>Trade Network</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Connect with contractors, tradespeople, and design professionals
        </p>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <Search size={14} color="var(--color-text-light)" style={{ position: 'absolute', left: 10 }} />
          <input
            type="text"
            placeholder="Search by name, trade, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 32px',
              border: '1.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        <select
          value={tradeFilter}
          onChange={e => setTradeFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            background: 'white',
            outline: 'none',
            color: 'var(--color-text)',
          }}
        >
          {tradeOptions.map(o => <option key={o}>{o}</option>)}
        </select>

        <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} professional{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No professionals found</p>
          <p style={{ fontSize: 14, marginTop: 6 }}>Try adjusting your filters</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
          {filtered.map(user => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 480px) {
          .network-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
