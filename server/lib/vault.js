import { readFileSync } from 'fs'
import { execSync } from 'child_process'

export async function loadSecrets() {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.OP_SERVICE_ACCOUNT_TOKEN) {
      try {
        const serviceKey = execSync('op read op://dev/traydbook-admin/service-role-key', {
          encoding: 'utf8',
        }).trim()
        process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey
      } catch {
        console.warn('[admin] 1Password read failed, falling back to env')
      }
    }

    try {
      const dockerSecret = readFileSync('/run/secrets/supabase_service_role', 'utf8').trim()
      process.env.SUPABASE_SERVICE_ROLE_KEY = dockerSecret
    } catch {
      // not mounted — fine
    }
  }

  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = required.filter(k => !process.env[k])
  if (missing.length) {
    throw new Error(`Missing required secrets: ${missing.join(', ')}`)
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    throw new Error('SUPABASE_URL must be HTTPS')
  }

  if (!process.env.KEY_MASTER_SECRET) {
    console.warn('[admin] ⚠️  KEY_MASTER_SECRET not set — key rotation disabled')
  }
  if (!process.env.ADMIN_REQUEST_SECRET) {
    console.warn('[admin] ⚠️  ADMIN_REQUEST_SECRET not set — request signing disabled')
  }

  console.log('[admin] 🔐 Secrets loaded')
}
