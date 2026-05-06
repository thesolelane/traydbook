import { readFileSync } from 'fs'
import { execSync } from 'child_process'

export async function loadSecrets() {
  const isBeta = process.env.SUPABASE_ENV === 'beta'

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

  // Resolve actual URL/key based on project conventions (beta vs production)
  const supabaseUrl = isBeta
    ? (process.env.BETA_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)
    : process.env.VITE_SUPABASE_URL

  const serviceRoleKey = isBeta
    ? (process.env.BETA_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)
    : process.env.SUPABASE_SERVICE_ROLE_KEY

  const missing = []
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL')
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missing.length) {
    throw new Error(`Missing required secrets: ${missing.join(', ')}`)
  }

  if (!supabaseUrl.startsWith('https://')) {
    throw new Error('Supabase URL must be HTTPS')
  }

  if (!process.env.KEY_MASTER_SECRET) {
    console.warn('[admin] ⚠️  KEY_MASTER_SECRET not set — key rotation disabled')
  }
  if (!process.env.ADMIN_REQUEST_SECRET) {
    console.warn('[admin] ⚠️  ADMIN_REQUEST_SECRET not set — request signing in passthrough mode')
  }

  console.log('[admin] 🔐 Secrets loaded')
}
