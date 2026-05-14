import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { TabHeading, inputStyle, ErrorBanner, SavedBanner } from './shared'

type Modal = 'freeze' | 'delete' | null

export default function DangerTab() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [modal, setModal] = useState<Modal>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  function openModal(m: Modal) {
    setErr('')
    setMsg('')
    setDeleteConfirmText('')
    setModal(m)
  }

  async function handleFreeze() {
    if (!profile) return
    setLoading(true)
    setErr('')
    const { error } = await supabase
      .from('users')
      .update({ account_status: 'frozen', frozen_at: new Date().toISOString() })
      .eq('id', profile.id)
    setLoading(false)
    if (error) { setErr(error.message); return }
    setModal(null)
    await signOut()
    navigate('/', { replace: true })
  }

  async function handleDelete() {
    if (!profile) return
    if (deleteConfirmText !== 'DELETE') {
      setErr('Type DELETE to confirm.')
      return
    }
    setLoading(true)
    setErr('')
    const { error } = await supabase
      .from('users')
      .update({ account_status: 'deleted', deleted_at: new Date().toISOString() })
      .eq('id', profile.id)
    setLoading(false)
    if (error) { setErr(error.message); return }
    setModal(null)
    await signOut()
    navigate('/', { replace: true })
  }

  const isFrozen = (profile as any)?.account_status === 'frozen'

  return (
    <div>
      <TabHeading>Danger Zone</TabHeading>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24 }}>
        These actions affect your account permanently. Read each option carefully before proceeding.
      </div>

      {msg && <SavedBanner msg={msg} />}

      {/* Freeze Account */}
      <div
        style={{
          background: 'rgba(234,179,8,0.05)',
          border: '1px solid rgba(234,179,8,0.22)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-condensed)',
            fontSize: 15,
            fontWeight: 700,
            color: '#B45309',
            marginBottom: 6,
          }}
        >
          Freeze Account
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14, lineHeight: 1.55 }}>
          Temporarily hide your profile and pause all activity. You can log back in any time to reactivate.
          If you do not return within <strong style={{ color: 'var(--color-text)' }}>6 months</strong>,
          your account and all data will be permanently deleted.
        </div>
        {isFrozen ? (
          <div style={{ fontSize: 13, color: '#B45309', fontWeight: 600 }}>
            Your account is currently frozen.
          </div>
        ) : (
          <button
            onClick={() => openModal('freeze')}
            style={{
              padding: '9px 18px',
              background: 'transparent',
              border: '1px solid rgba(234,179,8,0.45)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-condensed)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: '#B45309',
              cursor: 'pointer',
            }}
          >
            Freeze My Account
          </button>
        )}
      </div>

      {/* Delete Account */}
      <div
        style={{
          background: 'rgba(220,38,38,0.05)',
          border: '1px solid rgba(220,38,38,0.18)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-condensed)',
            fontSize: 15,
            fontWeight: 700,
            color: '#DC2626',
            marginBottom: 6,
          }}
        >
          Delete Account
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14, lineHeight: 1.55 }}>
          Permanently delete your TraydBook account. Your profile, posts, bids, messages, and all
          associated data will be removed and <strong style={{ color: 'var(--color-text)' }}>cannot be recovered</strong>.
          Consider freezing your account instead if you may want to return.
        </div>
        <button
          onClick={() => openModal('delete')}
          style={{
            padding: '9px 18px',
            background: 'transparent',
            border: '1px solid rgba(220,38,38,0.4)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-condensed)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: '#DC2626',
            cursor: 'pointer',
          }}
        >
          Delete My Account
        </button>
      </div>

      {/* Modal overlay */}
      {modal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => { if (!loading) setModal(null) }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 28px 24px',
              maxWidth: 440,
              width: '100%',
            }}
            onClick={e => e.stopPropagation()}
          >
            {modal === 'freeze' && (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 18,
                    fontWeight: 800,
                    color: '#B45309',
                    marginBottom: 12,
                  }}
                >
                  Freeze your account?
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                  Your profile will be hidden immediately and you will be signed out.
                  You can log back in any time to reactivate. If you don't return
                  within <strong style={{ color: 'var(--color-text)' }}>6 months</strong>,
                  your account and all data will be permanently deleted with no option to recover it.
                </div>
                {err && <ErrorBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => setModal(null)}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontFamily: 'var(--font-condensed)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFreeze}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#B45309',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontFamily: 'var(--font-condensed)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      textTransform: 'uppercase',
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? 'Freezing…' : 'Yes, Freeze It'}
                  </button>
                </div>
              </>
            )}

            {modal === 'delete' && (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 18,
                    fontWeight: 800,
                    color: '#DC2626',
                    marginBottom: 12,
                  }}
                >
                  This is permanent.
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
                  Deleting your account removes your profile, posts, bids, messages, credits, and
                  all other data. <strong style={{ color: 'var(--color-text)' }}>This cannot be undone.</strong>
                  {' '}There is no grace period and no way to recover your account after this step.
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  Type <strong style={{ color: 'var(--color-text)' }}>DELETE</strong> to confirm:
                </div>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  style={{ ...inputStyle, marginBottom: 14 }}
                  autoFocus
                />
                {err && <ErrorBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => setModal(null)}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontFamily: 'var(--font-condensed)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading || deleteConfirmText !== 'DELETE'}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: deleteConfirmText === 'DELETE' ? '#DC2626' : 'var(--color-bg)',
                      border: '1px solid rgba(220,38,38,0.4)',
                      borderRadius: 'var(--radius-md)',
                      fontFamily: 'var(--font-condensed)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: deleteConfirmText === 'DELETE' ? '#fff' : '#DC2626',
                      cursor: loading || deleteConfirmText !== 'DELETE' ? 'not-allowed' : 'pointer',
                      textTransform: 'uppercase',
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? 'Deleting…' : 'Permanently Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
