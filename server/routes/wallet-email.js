import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { Resend } from 'resend'
import { requireAuth } from '../lib/auth.js'

const router = Router()

const emailKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req.ip ?? '').replace(/^::ffff:/, ''),
  message: { error: 'Too many email requests from this IP — please wait 15 minutes.' },
})

router.post('/api/wallet/email-key', emailKeyLimiter, requireAuth, async (req, res) => {
  const { encryptedKey, iv, salt, pubkey } = req.body ?? {}

  if (!encryptedKey || !iv || !salt || !pubkey) {
    return res.status(400).json({ error: 'Missing required fields: encryptedKey, iv, salt, pubkey' })
  }

  const userEmail = req.user?.email
  if (!userEmail) {
    return res.status(400).json({ error: 'No email associated with this account' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'Email service not configured' })
  }

  const resend = new Resend(apiKey)

  const decryptScript = `// Run with: node decrypt-wallet.mjs
// Requires Node.js 18+

import { createInterface } from 'readline'

const rl = createInterface({ input: process.stdin, output: process.stdout })
rl.question('Enter your wallet password: ', async (password) => {
  rl.close()

  const enc = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const derivedKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc('${salt}'), iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: enc('${iv}') },
      derivedKey,
      enc('${encryptedKey}')
    )
    const keyArray = JSON.parse(new TextDecoder().decode(decrypted))
    console.log('\\n✅ Decrypted successfully!')
    console.log('\\nJSON keypair (save as keypair.json for Solana CLI):')
    console.log(JSON.stringify(keyArray))
    console.log('\\nSolana CLI import:')
    console.log('  solana config set --keypair ./keypair.json')
  } catch {
    console.error('❌ Wrong password or corrupted data')
  }
})`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden;">

    <div style="background:linear-gradient(135deg,#9945ff22,#14f19522);border-bottom:1px solid #222;padding:32px 32px 24px;">
      <div style="font-size:28px;margin-bottom:8px;">◎</div>
      <h1 style="margin:0;font-size:20px;font-weight:800;color:#fff;letter-spacing:0.3px;">Your TraydBook Wallet Key</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#888;">Public key: <code style="font-size:12px;color:#aaa;">${pubkey}</code></p>
    </div>

    <div style="padding:28px 32px;">

      <div style="background:#1a0a0a;border:1px solid #3a1a1a;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
        <div style="font-size:12px;font-weight:800;color:#ef4444;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:6px;">⚠ Keep this email safe</div>
        <p style="margin:0;font-size:13px;color:#f87171;line-height:1.6;">
          Your private key is encrypted with your password. TraydBook cannot decrypt it — only you can.
          Store this email somewhere safe and <strong>never share the decryption password</strong>.
        </p>
      </div>

      <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#fff;letter-spacing:0.3px;">Encrypted Key Data</h2>
      <div style="background:#0a0a0a;border:1px solid #222;border-radius:8px;padding:14px 16px;margin-bottom:24px;word-break:break-all;">
        <div style="font-size:11px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Encrypted Key (AES-256-GCM)</div>
        <code style="font-size:11px;color:#14f195;line-height:1.8;">${encryptedKey}</code>
        <div style="font-size:11px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 6px;">IV</div>
        <code style="font-size:11px;color:#9945ff;line-height:1.8;">${iv}</code>
        <div style="font-size:11px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 6px;">Salt</div>
        <code style="font-size:11px;color:#9945ff;line-height:1.8;">${salt}</code>
      </div>

      <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#fff;letter-spacing:0.3px;">How to Decrypt & Import</h2>
      <ol style="margin:0 0 20px;padding-left:18px;color:#aaa;font-size:13px;line-height:2;">
        <li>Copy the decrypt script below into a file named <code style="color:#fff;">decrypt-wallet.mjs</code></li>
        <li>Run: <code style="color:#14f195;">node decrypt-wallet.mjs</code></li>
        <li>Enter your wallet password when prompted</li>
        <li>Copy the JSON output into <code style="color:#fff;">keypair.json</code></li>
        <li>Import: <code style="color:#14f195;">solana config set --keypair ./keypair.json</code></li>
      </ol>

      <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#fff;letter-spacing:0.3px;">Decrypt Script</h2>
      <div style="background:#0a0a0a;border:1px solid #222;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
        <pre style="margin:0;font-size:11px;color:#e2e8f0;line-height:1.7;overflow-x:auto;white-space:pre-wrap;word-break:break-word;">${decryptScript.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </div>

      <p style="margin:0;font-size:12px;color:#555;line-height:1.6;border-top:1px solid #222;padding-top:20px;">
        This key was generated in your browser and encrypted before leaving your device.
        TraydBook never had access to your unencrypted private key.
        <br><br>
        Public key: <code style="color:#888;">${pubkey}</code>
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    await resend.emails.send({
      from: 'TraydBook <wallet@traydbook.com>',
      to: userEmail,
      subject: '◎ Your TraydBook Solana Wallet Key',
      html,
    })
    console.log(`[wallet/email-key] Sent encrypted key to ${userEmail}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[wallet/email-key] Resend error:', err?.message)
    res.status(500).json({ error: 'Failed to send email' })
  }
})

export default router
