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
  const [confirmed, setConfirmed] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!profile) return

    if (!isContractor) {
      navigate('/feed', { replace: true })
      return
    }

    async function checkExistingWallet() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          setStatusChecked(true)
          return
        }

        const res = await fetch('/api/wallet/status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.solana_pubkey) {
            navigate('/settings/wallet', { replace: true })
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

  async function handleConfirm() {
    if (!confirmed || !pubkeyB58) return
    setSaving(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated. Please sign in again.')

      const res = await fetch('/api/wallet/save-pubkey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pubkey: pubkeyB58 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save wallet')
      setSaved(true)
      navigate('/settings/wallet', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setSaving(false)
    }
  }

  if (!profile || !isContractor || !statusChecked || !mnemonic) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg)',
        }}
      >
        <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Setting up your wallet…
        </div>
      </div>
    )
  }

  const words = mnemonic.split(' ')

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: '100%',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          padding: '36px 32px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #9945ff, #14f195)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            ◎
          </div>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: 22,
                fontWeight: 800,
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '0.3px',
              }}
            >
              Your Crypto Wallet Seed Phrase
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, marginTop: 2 }}>
              Hi {profile?.display_name ?? 'there'} — your 12-word seed phrase has been generated.
            </p>
          </div>
        </div>

        {/* Warning banner */}
        <div
          style={{
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.25)',
            borderRadius: 10,
            padding: '12px 16px',
            marginTop: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-condensed)',
              fontSize: 14,
              fontWeight: 800,
              color: '#DC2626',
              letterSpacing: '0.4px',
              marginBottom: 4,
            }}
          >
            ⚠ Write this down now — it is shown only once
          </div>
          <p style={{ fontSize: 13, color: '#DC2626', margin: 0, lineHeight: 1.6 }}>
            Your seed phrase is generated entirely in your browser and is{' '}
            <strong>never sent to our servers</strong>. Anyone with these 12 words can access your
            wallet. Store them offline in a safe place.
          </p>
        </div>

        {/* Seed phrase word grid */}
        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '16px',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-condensed)',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Seed Phrase — 12 Words (BIP-39)
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}
          >
            {words.map((word, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 7,
                  padding: '8px 10px',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-condensed)',
                    fontWeight: 700,
                    color: 'var(--color-text-muted)',
                    minWidth: 16,
                    textAlign: 'right',
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: 'monospace',
                    color: 'var(--color-text)',
                    fontWeight: 600,
                  }}
                >
                  {word}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={copyMnemonic}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              marginTop: 12,
              padding: '9px 16px',
              background: copied ? 'rgba(5,150,105,0.1)' : 'transparent',
              border: `1px solid ${copied ? 'rgba(5,150,105,0.3)' : 'var(--color-border)'}`,
              borderRadius: 7,
              cursor: 'pointer',
              fontFamily: 'var(--font-condensed)',
              fontSize: 12,
              fontWeight: 700,
              color: copied ? '#059669' : 'var(--color-text-muted)',
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}
          >
            {copied ? '✓ Copied to Clipboard' : '⎘ Copy All 12 Words'}
          </button>
        </div>

        {/* Public key display */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-condensed)',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Wallet Address (Public Key)
          </div>
          <div
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <code
              style={{
                fontSize: 12,
                fontFamily: 'monospace',
                color: 'var(--color-text-muted)',
                wordBreak: 'break-all',
                lineHeight: 1.5,
              }}
            >
              {pubkeyB58}
            </code>
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
            Derivation path: m/44'/501'/0'/0' — importable directly into Phantom or Solflare using
            your seed phrase.
          </p>
        </div>

        {/* Confirmation checkbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            background: 'var(--color-bg)',
            border: `1px solid ${confirmed ? 'rgba(5,150,105,0.4)' : 'var(--color-border)'}`,
            borderRadius: 10,
            padding: '14px 16px',
            cursor: 'pointer',
            marginBottom: 20,
            transition: 'border-color 0.15s',
          }}
        >
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            style={{
              width: 18,
              height: 18,
              marginTop: 1,
              cursor: 'pointer',
              flexShrink: 0,
              accentColor: 'var(--color-brand)',
            }}
          />
          <span style={{ fontSize: 14, color: 'var(--color-text)', lineHeight: 1.5 }}>
            <strong>I've written down my seed phrase</strong> and stored it safely. I understand
            that TraydBook cannot recover it if lost.
          </span>
        </label>

        {error && (
          <div
            style={{
              background: 'rgba(220,38,38,0.08)',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#DC2626',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!confirmed || saving || !pubkeyB58}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: confirmed && pubkeyB58 ? 'var(--color-brand)' : 'var(--color-border)',
            border: 'none',
            borderRadius: 8,
            cursor: confirmed && pubkeyB58 ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-condensed)',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: confirmed && pubkeyB58 ? '#fff' : 'var(--color-text-muted)',
            transition: 'background 0.2s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'I\'ve Saved My Seed Phrase — Activate Wallet'}
        </button>
      </div>
    </div>
  )
}
