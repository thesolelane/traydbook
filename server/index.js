import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './lib/clients.js'
import stripeRoutes from './routes/stripe.js'
import teamRoutes   from './routes/team.js'
import adminRoutes  from './routes/admin.js'
import smsRoutes, { sendSmsAlert } from './routes/sms.js'
import walletRoutes from './routes/wallet.js'

const app = express()

app.use(stripeRoutes)

app.use(express.json())

app.use(teamRoutes)
app.use(adminRoutes)
app.use(smsRoutes)
app.use(walletRoutes)

if (process.env.NODE_ENV === 'production') {
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const __dirname = path.default.dirname(fileURLToPath(import.meta.url))
  const distPath = path.default.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.default.join(distPath, 'index.html'))
  })
}

const PORT = process.env.PORT ?? process.env.API_PORT ?? 3001
app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT} (${process.env.NODE_ENV ?? 'development'})`)
  startNotificationListener()
})

function startNotificationListener() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[sms-listener] SUPABASE_SERVICE_ROLE_KEY not set — SMS dispatch disabled')
    return
  }

  const listenerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  listenerClient
    .channel('server-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'type=eq.message_received' },
      async (payload) => {
        const notif = payload.new
        if (!notif) return

        const recipientId = notif.user_id
        const entityId    = notif.entity_id
        const entityType  = notif.entity_type ?? ''
        const threadId    = entityType.startsWith('thread:') ? entityType.slice(7) : null

        const { data: sender } = await supabaseAdmin
          .from('users')
          .select('display_name')
          .eq('id', entityId)
          .single()

        const senderName = sender?.display_name ?? 'Someone'
        sendSmsAlert(recipientId, senderName, threadId ?? '').catch(() => {})
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[sms-listener] Listening for message_received notifications')
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[sms-listener] Channel error — SMS dispatch may be unavailable')
      }
    })
}
