import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Keypair } from '@solana/web3.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

async function encryptPrivateKey(
  privkeyJson: string,
  password: string
): Promise<{ encryptedKey: string; iv: string; salt: string }> {
  const enc = new TextEncoder()
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const ivBytes = crypto.getRandomValues(new Uint8Array(12))

  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  const derivedKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes },
    derivedKey,
    enc.encode(privkeyJson)
  )

  const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  return {
    encryptedKey: toB64(encrypted),
    iv: toB64(ivBytes),
    salt: toB64(saltBytes),
  }
}

function toBase58(arr: Uint8Array): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let num = BigInt(0)
  for (const byte of arr) {
    num = num * BigInt(256) + BigInt(byte)
  }
  let encoded = ''
  while (num > BigInt(0)) {
    const remainder = Number(num % BigInt(58))
    num = num / BigInt(58)
    encoded = ALPHABET[remainder] + encoded
  }
  for (const byte of arr) {
    if (byte === 0) encoded = '1' + encoded
    else break
  }
  return encoded
}

export default function WalletSetup() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const isContractor = profile?.account_type === 'contractor'

  const [statusChecked, setStatusChecked] = useState(false)
  const [keypair, setKeypair] = useState<Keypair | null>(null)
  const [pubkeyB58, setPubkeyB58] = useState('')
  const [privkeyB58, setPrivkeyB58] = useState('')
  const [privkeyJson, setPrivkeyJson] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [emailPassword, setEmailPassword] = useState('')
  const [emailPassword2, setEmailPassword2] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')

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
    const kp = Keypair.generate()
    setKeypair(kp)
    const pubB58 = kp.publicKey.toBase58()
    const secKey = kp.secretKey
    const privB58 = toBase58(secKey)
    const privJson = JSON.stringify(Array.from(secKey))
    setPubkeyB58(pubB58)
    setPrivkeyB58(privB58)
    setPrivkeyJson(privJson)
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

  async function handleEmailKey() {
    setEmailError('')
    if (!emailPassword || emailPassword.length < 8) {
      setEmailError('Password must be at least 8 characters')
      return
    }
    if (emailPassword !== emailPassword2) {
      setEmailError('Passwords do not match')
      return
    }
    if (!privkeyJson || !pubkeyB58) return

    setEmailSending(true)
    try {
      const { encryptedKey, iv, salt } = await encryptPrivateKey(privkeyJson, emailPassword)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/wallet/email-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ encryptedKey, iv, salt, pubkey: pubkeyB58 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to send email')
      setEmailSent(true)
      setEmailPassword('')
      setEmailPassword2('')
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setEmailSending(false)
    }
  }

  const copyToClipboard = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('Failed to copy to clipboard.')
    }
  }, [])

  function downloadJson() {
    if (!privkeyJson) return
    const blob = new Blob([privkeyJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'traydbook-wallet.json'
    a.click()
    URL.revokeObjectURL(url)
  }

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
      navigate('/feed', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setSaving(false)
    }
  }

  if (!profile || !isContractor || !statusChecked || !keypair) {
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
              Your TraydBook Wallet is Ready
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, marginTop: 2 }}>
              Hi {profile?.display_name ?? 'there'} — your Solana wallet has been generated.
            </p>
          </div>
        </div>

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
            ⚠ Save this now — TraydBook cannot recover it
          </div>
          <p style={{ fontSize: 13, color: '#DC2626', margin: 0, lineHeight: 1.6 }}>
            Your private key is generated entirely in your browser and is{' '}
            <strong>never sent to our servers</strong>. If you lose it, your wallet cannot be
            recovered. Copy or download it before proceeding.
          </p>
        </div>

        <KeyField
          label="Wallet Address (Public Key)"
          value={pubkeyB58}
          onCopy={() => copyToClipboard(pubkeyB58, 'pubkey')}
          copied={copied === 'pubkey'}
          mono
        />

        <KeyField
          label="Private Key — Base58 format"
          value={privkeyB58}
          onCopy={() => copyToClipboard(privkeyB58, 'privB58')}
          copied={copied === 'privB58'}
          mono
          secret
        />

        <KeyField
          label="Private Key — JSON array format (compatible with Phantom / Solflare import)"
          value={privkeyJson}
          onCopy={() => copyToClipboard(privkeyJson, 'privJson')}
          copied={copied === 'privJson'}
          mono
          secret
        />

        <button
          onClick={downloadJson}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            marginTop: 8,
            marginBottom: 16,
            padding: '10px 16px',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'var(--font-condensed)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            justifyContent: 'center',
          }}
        >
          ⬇ Download Private Key (.json)
        </button>

        {/* ── Email encrypted key ───────────────────────────── */}
        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '16px',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-condensed)',
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '0.4px',
              marginBottom: 4,
            }}
          >
            ✉ Email My Encrypted Key
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
            Set a password — your key will be encrypted in your browser before being sent.
            Only you can decrypt it. Includes a script to import into Solana CLI.
          </p>

          {emailSent ? (
            <div
              style={{
                background: 'rgba(5,150,105,0.1)',
                border: '1px solid rgba(5,150,105,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#059669',
                fontWeight: 600,
              }}
            >
              ✓ Encrypted key sent to your email
            </div>
          ) : (
            <>
              <input
                type="password"
                placeholder="Encryption password (min 8 characters)"
                value={emailPassword}
                onChange={e => setEmailPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 7,
                  color: 'var(--color-text)',
                  fontSize: 13,
                  marginBottom: 8,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={emailPassword2}
                onChange={e => setEmailPassword2(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 7,
                  color: 'var(--color-text)',
                  fontSize: 13,
                  marginBottom: emailError ? 8 : 10,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              {emailError && (
                <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{emailError}</div>
              )}
              <button
                onClick={handleEmailKey}
                disabled={emailSending || !emailPassword || !emailPassword2}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  background: emailPassword && emailPassword2 ? 'rgba(153,69,255,0.15)' : 'transparent',
                  border: '1px solid rgba(153,69,255,0.4)',
                  borderRadius: 7,
                  cursor: emailPassword && emailPassword2 ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: emailPassword && emailPassword2 ? '#9945ff' : 'var(--color-text-muted)',
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase',
                  opacity: emailSending ? 0.7 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {emailSending ? 'Encrypting & Sending…' : '✉ Send Encrypted Key to My Email'}
              </button>
            </>
          )}
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '14px 16px',
            cursor: 'pointer',
            marginBottom: 20,
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
            <strong>I have saved my private key</strong> in a safe place and understand that
            TraydBook cannot recover it if lost.
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
          disabled={!confirmed || saving}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: confirmed ? 'var(--color-brand)' : 'var(--color-border)',
            border: 'none',
            borderRadius: 8,
            cursor: confirmed ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-condensed)',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: confirmed ? '#fff' : 'var(--color-text-muted)',
            transition: 'background 0.2s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Setting up…' : 'Confirm & Go to Feed'}
        </button>
      </div>
    </div>
  )
}

interface KeyFieldProps {
  label: string
  value: string
  onCopy: () => void
  copied: boolean
  mono?: boolean
  secret?: boolean
}

function KeyField({ label, value, onCopy, copied, mono, secret }: KeyFieldProps) {
  const [revealed, setRevealed] = useState(!secret)

  return (
    <div style={{ marginBottom: 16 }}>
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
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '10px 12px',
        }}
      >
        <div
          style={{
            flex: 1,
            fontSize: 12,
            fontFamily: mono ? 'monospace' : 'var(--font-sans)',
            color: 'var(--color-text)',
            wordBreak: 'break-all',
            filter: !revealed ? 'blur(5px)' : 'none',
            userSelect: revealed ? 'text' : 'none',
            transition: 'filter 0.2s',
            lineHeight: 1.6,
          }}
        >
          {value}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {secret && (
            <button
              onClick={() => setRevealed(r => !r)}
              style={{
                padding: '5px 10px',
                background: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-condensed)',
                fontWeight: 700,
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
              }}
            >
              {revealed ? 'Hide' : 'Show'}
            </button>
          )}
          <button
            onClick={onCopy}
            style={{
              padding: '5px 10px',
              background: copied ? 'rgba(5,150,105,0.12)' : 'transparent',
              border: `1px solid ${copied ? 'rgba(5,150,105,0.3)' : 'var(--color-border)'}`,
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11,
              color: copied ? '#059669' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-condensed)',
              fontWeight: 700,
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
