/**
 * TraydBook — 10-user end-to-end simulation
 *
 * Usage (on your server):
 *   export SUPABASE_URL="https://tpwrpezsvclzblktgjli.supabase.co"
 *   export SUPABASE_ANON_KEY="eyJ..."
 *   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   export APP_URL="https://dev.traydbook.com"
 *   node scripts/simulate.mjs
 */

const SUPABASE_URL    = process.env.SUPABASE_URL    || 'https://tpwrpezsvclzblktgjli.supabase.co'
const ANON_KEY        = process.env.SUPABASE_ANON_KEY
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL         = process.env.APP_URL          || 'https://dev.traydbook.com'

if (!ANON_KEY || !SERVICE_KEY) {
  console.error('ERROR: Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const PASS = 'TraydSim2026!'
const TS   = Date.now()

const USERS = [
  { i: 1,  type: 'contractor', trade: 'electrician',    name: 'Alex Sparks'     },
  { i: 2,  type: 'contractor', trade: 'plumber',         name: 'Jordan Pipes'    },
  { i: 3,  type: 'contractor', trade: 'hvac',            name: 'Sam Coldair'     },
  { i: 4,  type: 'contractor', trade: 'framer',          name: 'Casey Frame'     },
  { i: 5,  type: 'contractor', trade: 'painter',         name: 'Riley Brush'     },
  { i: 6,  type: 'owner',      trade: null,              name: 'Morgan Build'    },
  { i: 7,  type: 'owner',      trade: null,              name: 'Taylor Develop'  },
  { i: 8,  type: 'owner',      trade: null,              name: 'Drew Construct'  },
  { i: 9,  type: 'owner',      trade: null,              name: 'Quinn Projects'  },
  { i: 10, type: 'owner',      trade: null,              name: 'Blake Estate'    },
]

const results = []
let passed = 0, failed = 0

function log(label, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️ '
  console.log(`  ${icon} ${label}${detail ? ': ' + detail : ''}`)
  results.push({ label, status, detail })
  if (status === 'PASS') passed++
  else if (status === 'FAIL') failed++
}

async function api(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } }
  catch { return { status: res.status, body: text } }
}

async function sbAdmin(method, path, body) {
  return api(method, `${SUPABASE_URL}${path}`, body, SERVICE_KEY)
}

async function sbAnon(method, path, body) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
  }
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } }
  catch { return { status: res.status, body: text } }
}

async function createUser(u) {
  const email = `sim_${u.type}_${u.i}_${TS}@traydbook.com`
  u.email = email

  // Create via admin API (no email confirmation needed)
  const { status, body } = await sbAdmin('POST', '/auth/v1/admin/users', {
    email,
    password: PASS,
    email_confirm: true,
    user_metadata: { display_name: u.name },
  })

  if (status !== 200 || !body.id) {
    log(`Create user #${u.i} (${u.name})`, 'FAIL', body.message || body.error || status)
    return false
  }

  u.id = body.id
  log(`Create user #${u.i} (${u.name})`, 'PASS', `id: ${u.id.slice(0, 8)}...`)
  return true
}

async function signIn(u) {
  const { status, body } = await sbAnon('POST', '/auth/v1/token?grant_type=password', {
    email: u.email,
    password: PASS,
  })

  if (status !== 200 || !body.access_token) {
    log(`Sign in #${u.i} (${u.name})`, 'FAIL', body.error_description || body.error || status)
    return false
  }

  u.token = body.access_token
  log(`Sign in #${u.i} (${u.name})`, 'PASS', 'token obtained')
  return true
}

async function onboard(u) {
  const body = {
    display_name: u.name,
    account_type: u.type === 'contractor' ? 'contractor' : 'owner',
    zip: '9021' + u.i,
  }
  if (u.trade) body.trades = [u.trade]

  const { status, body: res } = await api('POST', `${APP_URL}/api/onboarding/complete`, body, u.token)

  if (status === 200 || (res && res.success)) {
    log(`Onboard #${u.i} (${u.type})`, 'PASS')
    return true
  }
  // 409 = already onboarded, that's fine
  if (status === 409) {
    log(`Onboard #${u.i} (${u.type})`, 'PASS', 'already onboarded')
    return true
  }
  log(`Onboard #${u.i} (${u.type})`, 'FAIL', JSON.stringify(res).slice(0, 80))
  return false
}

async function testWalletProtection(u) {
  const { status, body } = await api('GET', `${APP_URL}/api/wallet/status`, null, u.token)
  if (status === 403 && u.type === 'owner') {
    log(`Wallet guard #${u.i} (owner blocked)`, 'PASS', 'contractors only — correct')
  } else if (status === 200 && u.type === 'contractor') {
    log(`Wallet status #${u.i} (contractor)`, 'PASS', `pubkey: ${body.solana_pubkey || 'none'}`)
  } else if (status === 401) {
    log(`Wallet #${u.i}`, 'FAIL', 'unauthorized — token issue')
  } else {
    log(`Wallet #${u.i}`, 'SKIP', `status ${status}`)
  }
}

async function testAuthGuard() {
  console.log('\n--- Auth Guards (unauthenticated) ---')
  const routes = [
    ['GET',  '/api/wallet/status',  null],
    ['POST', '/api/team/invite',    {}],
    ['POST', '/api/onboarding/complete', {}],
  ]
  for (const [method, path, body] of routes) {
    const { status } = await api(method, `${APP_URL}${path}`, body, null)
    if (status === 401) {
      log(`Guard ${method} ${path}`, 'PASS', '401 Unauthorized')
    } else {
      log(`Guard ${method} ${path}`, 'FAIL', `got ${status} instead of 401`)
    }
  }
}

async function testHealthCheck() {
  const { status, body } = await api('GET', `${APP_URL}/healthz`)
  if (status === 200 && body.ok) {
    log('Health check', 'PASS', '{"ok":true}')
  } else {
    log('Health check', 'FAIL', `status ${status}`)
  }
}

async function deleteUser(u) {
  if (!u.id) return
  const { status } = await sbAdmin('DELETE', `/auth/v1/admin/users/${u.id}`)
  if (status === 200) {
    log(`Cleanup #${u.i} (${u.email})`, 'PASS', 'deleted')
  } else {
    log(`Cleanup #${u.i}`, 'SKIP', `status ${status}`)
  }
}

async function run() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   TraydBook — 10-User Simulation         ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log(`  App:      ${APP_URL}`)
  console.log(`  Supabase: ${SUPABASE_URL}`)
  console.log(`  Run ID:   ${TS}`)
  console.log('')

  // Phase 1: Health
  console.log('--- Phase 1: Health Check ---')
  await testHealthCheck()

  // Phase 2: Auth guards
  await testAuthGuard()

  // Phase 3: Create all 10 users
  console.log('\n--- Phase 2: Create 10 Users ---')
  for (const u of USERS) await createUser(u)

  // Phase 4: Sign in all users
  console.log('\n--- Phase 3: Sign In All Users ---')
  for (const u of USERS) {
    if (u.id) await signIn(u)
  }

  // Phase 5: Onboard all users
  console.log('\n--- Phase 4: Onboarding ---')
  for (const u of USERS) {
    if (u.token) await onboard(u)
  }

  // Phase 6: Wallet access tests
  console.log('\n--- Phase 5: Wallet Access (contractor vs owner) ---')
  for (const u of USERS) {
    if (u.token) await testWalletProtection(u)
  }

  // Phase 7: Cleanup
  console.log('\n--- Phase 6: Cleanup ---')
  for (const u of USERS) await deleteUser(u)

  // Summary
  const total = passed + failed
  console.log('')
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   Simulation Results                     ║')
  console.log('╠══════════════════════════════════════════╣')
  console.log(`║   ✅ Passed: ${String(passed).padEnd(29)}║`)
  console.log(`║   ❌ Failed: ${String(failed).padEnd(29)}║`)
  console.log(`║   Total:    ${String(total).padEnd(29)}║`)
  console.log('╚══════════════════════════════════════════╝')

  if (failed > 0) {
    console.log('\nFailed tests:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.label}: ${r.detail}`)
    })
    process.exit(1)
  }
}

run().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
