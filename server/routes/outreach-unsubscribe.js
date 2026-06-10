import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { verifyUnsubscribeToken } from '../lib/unsubscribe-token.js'

const router = Router()

const CONFIRMATION_HTML = (email) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsubscribed — TraydBook</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f1117;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1a1d2e;
      border: 1px solid #2d3148;
      border-radius: 12px;
      padding: 40px 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.6; }
    .email { color: #e2724a; font-weight: 600; }
    .footer { margin-top: 28px; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>You've been unsubscribed</h1>
    <p>
      <span class="email">${email}</span> has been removed from our
      outreach list. You will not receive any further emails from TraydBook
      outreach campaigns.
    </p>
    <p class="footer">
      If this was a mistake, please contact us at
      <a href="mailto:support@traydbook.com" style="color:#e2724a;">support@traydbook.com</a>.
    </p>
  </div>
</body>
</html>`

const INVALID_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invalid Link — TraydBook</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f1117;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1a1d2e;
      border: 1px solid #2d3148;
      border-radius: 12px;
      padding: 40px 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>Invalid or expired link</h1>
    <p>
      This unsubscribe link is invalid or has already been used.
      If you want to opt out, please reply "unsubscribe" to any of our
      emails or contact <a href="mailto:support@traydbook.com" style="color:#e2724a;">support@traydbook.com</a>.
    </p>
  </div>
</body>
</html>`

// GET /api/outreach/unsubscribe?token=<signed-token>
// Public — no auth required. Verifies the HMAC token, records the opt-out,
// and returns a confirmation HTML page.
router.get('/api/outreach/unsubscribe', async (req, res) => {
  const { token } = req.query

  const email = verifyUnsubscribeToken(token)
  if (!email) {
    return res.status(400).type('html').send(INVALID_HTML)
  }

  const { error } = await supabaseAdmin
    .from('outreach_unsubscribes')
    .upsert(
      { email: email.toLowerCase(), source: 'email_link', unsubscribed_at: new Date().toISOString() },
      { onConflict: 'email', ignoreDuplicates: false }
    )

  if (error) {
    console.error('[unsubscribe] DB error:', error.message)
    return res.status(500).type('html').send(INVALID_HTML)
  }

  res.type('html').send(CONFIRMATION_HTML(email))
})

// GET /api/admin/outreach/unsubscribes — admin list
// Requires service key or staff auth (handled by admin-outreach-templates router)
export { router as unsubscribePublicRouter }

export default router
