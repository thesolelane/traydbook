import { useState, useEffect } from 'react'
import { Plus, ToggleLeft, ToggleRight, PackageOpen } from 'lucide-react'
import {
  SectionProps,
  SectionCard,
  tableHeaderStyle,
  tableCellStyle,
  formatDollars,
} from './shared'

interface Bundle {
  id: string
  name: string
  credits: number
  price_cents: number
  stripe_price_id: string | null
  stripe_product_id: string | null
  active: boolean
  sort_order: number
  created_at: string
}

const inputStyle: React.CSSProperties = {
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 6,
  color: '#f0f0f0',
  padding: '7px 10px',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#999',
  marginBottom: 4,
  display: 'block',
}

export default function BundlesSection({ authHeaders }: SectionProps) {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({ name: '', credits: '', price_dollars: '', sort_order: '0' })
  const [formErr, setFormErr] = useState('')

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/bundles', { headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load')
      const data = await res.json()
      setBundles(data.bundles ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load bundles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormErr('')
    const credits = parseInt(form.credits, 10)
    const price_cents = Math.round(parseFloat(form.price_dollars) * 100)
    const sort_order = parseInt(form.sort_order, 10)

    if (!form.name.trim()) return setFormErr('Name is required')
    if (isNaN(credits) || credits <= 0) return setFormErr('Credits must be a positive number')
    if (isNaN(price_cents) || price_cents <= 0) return setFormErr('Price must be a positive amount')

    setSaving(true)
    try {
      const res = await fetch('/api/admin/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: form.name.trim(), credits, price_cents, sort_order }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create')
      setForm({ name: '', credits: '', price_dollars: '', sort_order: '0' })
      setShowForm(false)
      await load()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(bundle: Bundle) {
    try {
      const res = await fetch(`/api/admin/bundles/${bundle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ active: !bundle.active }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update bundle')
    }
  }

  const centsPerCredit = (b: Bundle) =>
    b.credits > 0 ? (b.price_cents / b.credits).toFixed(1) + '¢' : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {err && (
        <div
          style={{
            padding: '10px 14px',
            background: '#2a1515',
            border: '1px solid #e05252',
            borderRadius: 8,
            color: '#e05252',
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      <SectionCard
        title="Credit Bundles"
        subtitle="Manage available credit packages. Creating a bundle provisions a Stripe product and price automatically."
        action={
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: 'var(--color-brand)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} /> New Bundle
          </button>
        }
      >
        {showForm && (
          <form
            onSubmit={handleCreate}
            style={{
              padding: '16px 20px',
              background: '#111',
              borderBottom: '1px solid #222',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 12 }}>
              <div>
                <label style={labelStyle}>Bundle Name</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Enterprise"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Credits</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  placeholder="e.g. 1000"
                  value={form.credits}
                  onChange={e => setForm(f => ({ ...f, credits: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Price (USD)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={0.01}
                  step={0.01}
                  placeholder="e.g. 49.99"
                  value={form.price_dollars}
                  onChange={e => setForm(f => ({ ...f, price_dollars: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Order</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                />
              </div>
            </div>
            {formErr && <div style={{ color: '#e05252', fontSize: 12 }}>{formErr}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '7px 16px',
                  background: 'var(--color-brand)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Creating…' : 'Create Bundle'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setFormErr('')
                }}
                style={{
                  padding: '7px 16px',
                  background: 'transparent',
                  border: '1px solid #333',
                  borderRadius: 6,
                  color: '#999',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: '#666' }}>
              This will create a Stripe product and price. Prices cannot be edited after creation —
              deactivate and create a new bundle to change pricing.
            </p>
          </form>
        )}

        {loading ? (
          <div style={{ padding: 24, color: '#666', fontSize: 13 }}>Loading…</div>
        ) : bundles.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#666' }}>
            <PackageOpen size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div style={{ fontSize: 13 }}>No bundles yet</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'Name',
                  'Credits',
                  'Price',
                  'Per credit',
                  'Stripe price',
                  'Order',
                  'Status',
                  '',
                ].map(h => (
                  <th key={h} style={tableHeaderStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bundles.map(b => (
                <tr key={b.id} style={{ opacity: b.active ? 1 : 0.45 }}>
                  <td style={tableCellStyle}>
                    <span style={{ fontWeight: 600 }}>{b.name}</span>
                  </td>
                  <td style={tableCellStyle}>{b.credits.toLocaleString()}</td>
                  <td style={tableCellStyle}>{formatDollars(b.price_cents)}</td>
                  <td style={tableCellStyle}>{centsPerCredit(b)}</td>
                  <td
                    style={{
                      ...tableCellStyle,
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: '#888',
                    }}
                  >
                    {b.stripe_price_id ?? <span style={{ color: '#e05252' }}>none</span>}
                  </td>
                  <td style={tableCellStyle}>{b.sort_order}</td>
                  <td style={tableCellStyle}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        background: b.active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                        color: b.active ? '#4ade80' : '#666',
                      }}
                    >
                      {b.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                    <button
                      onClick={() => toggleActive(b)}
                      title={b.active ? 'Deactivate' : 'Activate'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: b.active ? '#4ade80' : '#555',
                        padding: 4,
                      }}
                    >
                      {b.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <div
        style={{
          padding: '12px 16px',
          background: '#111',
          border: '1px solid #222',
          borderRadius: 8,
          fontSize: 12,
          color: '#666',
        }}
      >
        <strong style={{ color: '#888' }}>Note:</strong> To change a bundle's price or credit count,
        deactivate it and create a new one. Stripe prices are immutable once created. Active bundles
        appear in the checkout UI automatically.
      </div>
    </div>
  )
}
