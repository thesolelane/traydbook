import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as bip39 from 'bip39'
import { derivePath } from 'ed25519-hd-key'
import { Keypair } from '@solana/web3.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function deriveKeypairFromMnemonic(mnemonic: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const { key } = derivePath("m/44'/501'/0'/0'", seed.toString('hex'))
  return Keypair.fromSeed(key)
}

export default function WalletSetup() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const isContractor = profile?.account_type === 'contractor'

  const [statusChecked, setStatusChecked] = useState(false)
  const [mnemonic, setMnemonic] = useState('')
  const [pubkeyB58, setPubkeyB58] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!profile) return

    if (!isContractor) {
      navigate('/feed', { replace: true })
      return
    }

    async function checkExistingWallet() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) { setStatusChecked(true); return }

        const res = await fetch('/api/wallet/status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.solana_pubkey) {
            navigate('/feed', { replace: true })
            return
          }
        }
      } catch {
        // wallet check failed — proceed to setup
      }
      setStatusChecked(true)
    }

    checkExistingWallet()
  }, [profile, isContractor, navigate])

  useEffect(() => {
    if (!statusChecked) return
    const phrase = bip39.generateMnemonic()
    const keypair = deriveKeypairFromMnemonic(phrase)
    setMnemonic(phrase)
    setPubkeyB58(keypair.publicKey.toBase58())
  }, [statusChecked])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!saved) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saved])

  const copyMnemonic = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mnemonic)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Failed to copy to clipboard.')
    }
  }, [mnemonic])

  async function handleContinue() {
    if (!pubkeyB58) return
    setSaving(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated. Please sign in again.')

      const res = await fetch('/api/wallet/save-pubkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pubkey: pubkeyB58 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save wallet')
      setSaved(true)
      navigate('/feed', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setSaving(false)
    }
  }

  if (!profile || !isContractor || !statusChecked || !mnemonic) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Getting things ready…</div>
      </div>
    )
  }

  const words = mnemonic.split(' ')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ maxWidth: 520, width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '36px 32px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <h1 style={{ fontFamily: 'var(--font-condensed)', fontSize: 24, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px', letterSpacing: '0.3px' }}>
            You're all set, {profile?.display_name?.split(' ')[0] ?? 'there'}!
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>
            Your TraydBook rewards wallet is ready. You'll earn credits for completing your profile, posting work, and referring other pros — redeemable for platform features.
          </p>
        </div>

        {/* What you can earn */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {[
            { icon: '✅', label: 'Complete your profile', reward: '25 credits' },
            { icon: '📸', label: 'Post a project photo', reward: '10 credits' },
            { icon: '👷', label: 'Refer a trade pro', reward: '50 credits' },
          ].map(({ icon, label, reward }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span style={{ fontSize: 13, color: 'var(--color-text)', flex: 1 }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-brand)' }}>{reward}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, color: '#DC2626', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Primary CTA */}
        <button
          onClick={handleContinue}
          disabled={saving || !pubkeyB58}
          style={{
            width: '100%', padding: '14px 20px',
            background: 'var(--color-brand)', border: 'none', borderRadius: 8,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-condensed)', fontSize: 16, fontWeight: 800,
            letterSpacing: '0.5px', textTransform: 'uppercase', color: '#fff',
            opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s',
          }}
        >
          {saving ? 'One second…' : 'Take Me to My Feed →'}
        </button>

        {/* Advanced toggle */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--color-text-muted)',
              textDecoration: 'underline', padding: 0, display: 'block', margin: '0 auto',
            }}
          >
            {showAdvanced ? '▲ Hide wallet details' : '▾ Advanced: view wallet details'}
          </button>

          {showAdvanced && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Info */}
              <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: '#DC2626', margin: 0, lineHeight: 1.6 }}>
                  <strong>Save your seed phrase if you want to import this wallet into an external app later.</strong> TraydBook generates it entirely in your browser and never stores it. If you lose it, you cannot recover it — but your TraydBook credits and profile are always safe with your account login.
                </p>
              </div>

              {/* Seed phrase */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-condensed)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                  Seed Phrase — 12 Words
                </div>
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {words.map((word, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 8px' }}>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700, minWidth: 14, textAlign: 'right' }}>{i + 1}</span>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text)', fontWeight: 600 }}>{word}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={copyMnemonic}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      width: '100%', marginTop: 10, padding: '7px 12px',
                      background: copied ? 'rgba(5,150,105,0.1)' : 'transparent',
                      border: `1px solid ${copied ? 'rgba(5,150,105,0.3)' : 'var(--color-border)'}`,
                      borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      color: copied ? '#059669' : 'var(--color-text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.4px',
                    }}
                  >
                    {copied ? '✓ Copied' : '⎘ Copy all 12 words'}
                  </button>
                </div>
              </div>

              {/* Wallet address */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-condensed)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>
                  Wallet Address
                </div>
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px' }}>
                  <code style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)', wordBreak: 'break-all', lineHeight: 1.5 }}>
                    {pubkeyB58}
                  </code>
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                  Derivation path: m/44'/501'/0'/0' — importable into Phantom or Solflare using your seed phrase.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
