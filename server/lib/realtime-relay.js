import { EventEmitter } from 'events'
import { supabaseAdmin } from './clients.js'

export const realtimeEmitter = new EventEmitter()
realtimeEmitter.setMaxListeners(200)

const TABLES = [
  'users',
  'posts',
  'comments',
  'bids',
  'job_listings',
  'rfqs',
  'credit_ledger',
  'contractor_profiles',
  'lead_bank_ledger',
  'purchases',
  'credit_bundles',
  'credit_transfers',
  'referral_signups',
  'agent_logs',
  'outreach_prospects',
  'outreach_send_log',
  'content_moderation_queue',
  'admin_audit_log',
  'bob_control',
  'leads',
  'platform_settings',
  'security_events',
]

let started = false
let activeChannel = null

export function startRealtimeRelay() {
  if (started) return
  started = true

  console.log(`[realtime-relay] Subscribing to ${TABLES.length} tables…`)

  activeChannel = supabaseAdmin.channel('admin-relay-v1')

  for (const table of TABLES) {
    activeChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      payload => {
        realtimeEmitter.emit('change', {
          table,
          event: payload.eventType,
          record: payload.new ?? null,
          old_record: payload.old ?? null,
        })
      }
    )
  }

  activeChannel.subscribe(status => {
    console.log(`[realtime-relay] ${status}`)
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn('[realtime-relay] Channel error — reconnecting in 5s…')
      started = false
      activeChannel = null
      setTimeout(startRealtimeRelay, 5000)
    }
  })
}
