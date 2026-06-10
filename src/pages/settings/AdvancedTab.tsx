import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../../context/AuthContext'
import {
  TabHeading,
  Section,
  SectionHeading,
  SavedBanner,
  ErrorBanner,
  btnPrimary,
  btnGhost,
  apiFetch,
} from './shared'

export default function AdvancedTab() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isContractor = profile?.account_type === 'contractor'

  const [walletPubkey, setWalletPubkey] = useState<string | null | undefined>(undefined)
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletActionLoading, setWalletActionLoading] = useState(false)
  const [walletMsg, setWalletMsg] = useState('')
  const [walletErr, setWalletErr] = useState('')
  const [walletCopied, setWalletCopied] = useState(false)

  useEffect(() => {
    if (!isContractor) return
    setWalletLoading(true)
    apiFetch('/wallet/status', 'GET')
      .then(data => setWalletPubkey(data.solana_pubkey ?? null))
      .catch(() => setWalletPubkey(null))
      .finally(() => setWalletLoading(false))
  }, [isContractor])

  async function handleCopyPubkey() {
    if (!walletPubkey) return
    try {
      await navigator.clipboard.writeText(walletPubkey)
      setWalletCopied(true)
      setTimeout(() => setWalletCopied(false), 2000)
    } catch {
      setWalletErr('Failed to copy.')
    }
  }

  async function handleRemoveWallet() {
    if (!confirm('Remove your wallet? Your public key will be cleared. You can set one up again any time.')) return
    setWalletActionLoading(true)
    setWalletErr('')
    try {
      await apiFetch('/wallet/remove', 'POST')
      setWalletPubkey(null)
      setWalletMsg('Wallet removed.')
      setTimeout(() => setWalletMsg(''), 3500)
    } catch (err: unknown) {
      setWalletErr(err instanceof Error ? err.message : 'Failed to remove wallet')
    } finally {
      setWalletActionLoading(false)
    }
  }

  return (
    <div>
      <TabHeading>Advanced</TabHeading>

      {isContractor && (
        <>
          <SectionHeading>Accept Crypto Payments</SectionHeading>
          <Section>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
              <strong style={{ color: 'var(--color-text)' }}>Optional.</strong> Generate a Solana wallet address that clients can use to pay you directly in crypto. TraydBook only stores your public key — your seed phrase and private key are never sent to our servers.
            </p>

            {walletLoading || walletPubkey === undefined ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading…</div>
            ) : walletPubkey ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'linear-gradient(135deg, #9945ff, #14f195)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>◎</div>
                  <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 700 }}>
                    Active Wallet
                  </div>
                  <span style={{
                    background: 'rgba(5,150,105,0.1)', color: '#059669',
                    borderRadius: 99, padding: '2px 10px', fontSize: 11,
                    fontWeight: 700, fontFamily: 'var(--font-condensed)',
                    letterSpacing: '0.5px', textTransform: 'uppercase',
                  }}>Connected</span>
                </div>

                <div style={{
                  fontSize: 11, color: 'var(--color-text-muted)',
                  fontFamily: 'var(--font-condensed)', fontWeight: 700,
                  letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6,
                }}>Wallet Address (Public Key)</div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  borderRadius: 8, padding: '10px 12px', marginBottom: 16,
                }}>
                  <code style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5 }}>
                    {walletPubkey}
                  </code>
                  <button onClick={handleCopyPubkey} style={{
                    padding: '5px 10px',
                    background: walletCopied ? 'rgba(5,150,105,0.12)' : 'transparent',
                    border: `1px solid ${walletCopied ? 'rgba(5,150,105,0.3)' : 'var(--color-border)'}`,
                    borderRadius: 6, cursor: 'pointer', fontSize: 11,
                    color: walletCopied ? '#059669' : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-condensed)', fontWeight: 700,
                    letterSpacing: '0.3px', textTransform: 'uppercase', flexShrink: 0,
                    transition: 'all 0.15s',
                  }}>
                    {walletCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <div style={{
                    background: '#fff', padding: 12, borderRadius: 10,
                    border: '1px solid var(--color-border)', display: 'inline-block',
                  }}>
                    <QRCodeSVG value={walletPubkey} size={140} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={handleRemoveWallet}
                    disabled={walletActionLoading}
                    style={{ ...btnGhost, fontSize: 12, padding: '7px 14px', color: '#DC2626', borderColor: 'rgba(220,38,38,0.3)', opacity: walletActionLoading ? 0.6 : 1 }}
                  >Remove Wallet</button>
                  <button
                    onClick={() => navigate('/wallet-setup')}
                    disabled={walletActionLoading}
                    style={{ ...btnGhost, fontSize: 12, padding: '7px 14px', opacity: walletActionLoading ? 0.6 : 1 }}
                  >Replace Wallet</button>
                </div>

                {walletMsg && <SavedBanner msg={walletMsg} />}
                {walletErr && <ErrorBanner msg={walletErr} />}

                <div style={{ marginTop: 20, padding: '12px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                  <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Import into Phantom or Solflare</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    Use the 12-word seed phrase you saved during setup. In Phantom: <em>Add / Connect Wallet → Import Secret Recovery Phrase</em>. In Solflare: <em>Access Existing Wallet → Mnemonic Phrase</em>.
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'linear-gradient(135deg, #9945ff, #14f195)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0,
                  }}>◎</div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 15, fontWeight: 800 }}>Solana Wallet</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Accept crypto payments, import into Phantom or Solflare</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
                  Your wallet keypair and seed phrase are generated in your browser — they never leave your device. TraydBook only stores your public key (wallet address).
                </p>
                <button onClick={() => navigate('/wallet-setup')} style={{ ...btnPrimary, fontSize: 13 }}>
                  Set Up Wallet
                </button>
                {walletMsg && <SavedBanner msg={walletMsg} />}
                {walletErr && <ErrorBanner msg={walletErr} />}
              </div>
            )}
          </Section>
        </>
      )}

      {!isContractor && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '20px 0' }}>
          No advanced options available for your account type.
        </div>
      )}
    </div>
  )
}
