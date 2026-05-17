import { createHash, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const isBeta = process.env.SUPABASE_ENV === 'beta'
const url = isBeta
  ? (process.env.BETA_SUPABASE_URL?.startsWith('http') ? process.env.BETA_SUPABASE_URL : process.env.VITE_SUPABASE_URL)
  : process.env.VITE_SUPABASE_URL
const key = isBeta
  ? (process.env.BETA_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  : process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !url.startsWith('http')) {
  console.error('Missing or invalid SUPABASE URL. Got:', url)
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const raw = 'trayd_' + randomBytes(32).toString('base64url')
const hash = createHash('sha256').update(raw).digest('hex')
const prefix = raw.slice(0, 14)

const { data, error } = await sb
  .from('service_api_keys')
  .insert({
    name: 'bob-agent',
    key_hash: hash,
    key_prefix: prefix,
    scopes: ['leads:read', 'leads:write', 'agent:log', 'contractor:read', 'agent:read'],
  })
  .select('id, name, key_prefix, scopes, created_at')
  .single()

if (error) {
  console.error('DB error:', error.message)
  process.exit(1)
}

console.log('\n========================================')
console.log('  BOB API KEY CREATED')
console.log('========================================')
console.log('ID      :', data.id)
console.log('Name    :', data.name)
console.log('Prefix  :', data.key_prefix)
console.log('Scopes  :', data.scopes.join(', '))
console.log('Created :', data.created_at)
console.log('\n  RAW KEY — copy now, never shown again:')
console.log('\n  ' + raw)
console.log('\n========================================\n')
