#!/usr/bin/env node
// TraydBook End-to-End Simulation — v3
//
// Manual run (on Coolify host):
//   NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/simulate.mjs
//
// Env vars:
//   SIM_SB_URL          Supabase project URL
//   SIM_SB_ANON_KEY     Supabase anon key
//   SIM_SB_SERVICE_KEY  Supabase service role key
//   SIM_APP_URL         App base URL  (default: https://dev.traydbook.com)
//   SIM_CLEANUP         Set to "1" or "true" to delete sim users after the run
//                       Default: OFF — data persists so you can inspect it in admin
//
// Covers: health · auth guards · signup · onboarding · wallet setup (contractors) ·
//         image upload · posts · comments · likes · fund owners ·
//         RFQs · bids · bid award · wallet access · [optional cleanup]

import { Keypair } from '@solana/web3.js'

const SB         = process.env.SIM_SB_URL         || ''
const AK         = process.env.SIM_SB_ANON_KEY    || ''
const SK         = process.env.SIM_SB_SERVICE_KEY || ''
const APP        = process.env.SIM_APP_URL        || 'https://dev.traydbook.com'
const CLEANUP    = ['1', 'true'].includes((process.env.SIM_CLEANUP || '').toLowerCase())
// SIM_EMAIL: real inbox for wallet key emails (e.g. you@traydbook.com)
// Contractor sim users get addresses like: you+sim_contractor_1_TS@traydbook.com
// All wallet key emails land in this one inbox. Optional — skips email step if not set.
const SIM_EMAIL  = process.env.SIM_EMAIL || ''
const SIM_WALLET_PASSWORD = 'TraydSimWallet2026!'

if (!SB || !AK || !SK) {
  console.error('[sim] Missing required env vars: SIM_SB_URL, SIM_SB_ANON_KEY, SIM_SB_SERVICE_KEY')
  process.exit(1)
}

// Encrypt privkey JSON using AES-256-GCM + PBKDF2 — same as browser flow
async function encryptPrivateKey(privkeyJson, password) {
  const enc      = new TextEncoder()
  const salt     = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const iv       = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const keyMat   = await globalThis.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  const derived  = await globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  const encrypted = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, derived, enc.encode(privkeyJson))
  const toB64 = (buf) => Buffer.from(buf).toString('base64')
  return { encryptedKey: toB64(encrypted), iv: toB64(iv), salt: toB64(salt) }
}

const TS = Date.now()
const PW = 'TraydSim2026!'

// Minimal 1×1 transparent GIF (35 bytes) used for image upload tests
const GIF1x1 = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64')

const USERS = [
  { i:1,  type:'contractor',    trade:'Electrician', name:'Alex Sparks',    city:'Los Angeles',  state:'CA' },
  { i:2,  type:'contractor',    trade:'Plumber',     name:'Jordan Pipes',   city:'Phoenix',      state:'AZ' },
  { i:3,  type:'contractor',    trade:'HVAC Tech',   name:'Sam Coldair',    city:'Las Vegas',    state:'NV' },
  { i:4,  type:'contractor',    trade:'Carpenter',   name:'Casey Frame',    city:'San Diego',    state:'CA' },
  { i:5,  type:'contractor',    trade:'Painter',     name:'Riley Brush',    city:'Denver',       state:'CO' },
  { i:6,  type:'project_owner', trade:null,          name:'Morgan Build',   city:'Los Angeles',  state:'CA' },
  { i:7,  type:'project_owner', trade:null,          name:'Taylor Develop', city:'Austin',       state:'TX' },
  { i:8,  type:'project_owner', trade:null,          name:'Drew Construct', city:'Seattle',      state:'WA' },
  { i:9,  type:'project_owner', trade:null,          name:'Quinn Projects', city:'Chicago',      state:'IL' },
  { i:10, type:'project_owner', trade:null,          name:'Blake Estate',   city:'Miami',        state:'FL' },
]

let pass = 0, fail = 0
const ok  = (m, d='') => { console.log(`  ✅ ${m}${d ? ' — ' + d : ''}`); pass++ }
const no  = (m, d='') => { console.log(`  ❌ ${m}${d ? ' — ' + d : ''}`); fail++ }
const sep = (t)        =>   console.log(`\n── ${t} ──`)

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function req(method, url, body, token, admin) {
  const h = { 'Content-Type': 'application/json' }
  if (admin)      { h['Authorization'] = `Bearer ${SK}`; h['apikey'] = SK }
  else if (token)   h['Authorization'] = `Bearer ${token}`
  else              h['apikey'] = AK
  const opts = { method, headers: h }
  if (body && method !== 'GET' && method !== 'DELETE') opts.body = JSON.stringify(body)
  const r = await fetch(url, opts)
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

async function rpc(fn, args, token) {
  const h = {
    'Content-Type': 'application/json',
    'apikey': AK,
    'Authorization': `Bearer ${token}`,
  }
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method:'POST', headers:h, body:JSON.stringify(args) })
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

async function sbInsert(table, row, token) {
  const h = {
    'Content-Type': 'application/json',
    'apikey': AK,
    'Authorization': `Bearer ${token}`,
    'Prefer': 'return=representation',
  }
  const r = await fetch(`${SB}/rest/v1/${table}`, { method:'POST', headers:h, body:JSON.stringify(row) })
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

async function sbAdminPatch(table, match, update) {
  const qs = Object.entries(match).map(([k,v]) => `${k}=eq.${v}`).join('&')
  const h = {
    'Content-Type': 'application/json',
    'apikey': SK,
    'Authorization': `Bearer ${SK}`,
    'Prefer': 'return=representation',
  }
  const r = await fetch(`${SB}/rest/v1/${table}?${qs}`, { method:'PATCH', headers:h, body:JSON.stringify(update) })
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

async function uploadImage(token) {
  const form = new FormData()
  form.append('files', new Blob([GIF1x1], { type: 'image/gif' }), 'sim-test.gif')
  const r = await fetch(`${APP}/api/upload/post-media`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  })
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

// ── Main simulation ─────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(52)}`)
console.log(`  TraydBook Simulation v3`)
console.log(`  Cleanup: ${CLEANUP ? 'ON (data will be deleted)' : 'OFF (data will persist)'}`)
console.log(`  Target:  ${APP}`)
console.log(`${'═'.repeat(52)}`)

// 1. Health check
sep('Health')
const hc = await req('GET', `${APP}/healthz`)
hc.b?.ok ? ok('Health check', 'ok:true') : no('Health check', hc.s)

// 2. Auth guards — all protected routes must return 401 when unauthenticated
sep('Auth Guards')
for (const [m, p, b] of [
  ['GET',  '/api/wallet/status',       null],
  ['POST', '/api/team/invite',         {}  ],
  ['POST', '/api/onboarding/complete', {}  ],
  ['POST', '/api/posts',               {}  ],
  ['POST', '/api/upload/post-media',   null],
]) {
  const r = await req(m, `${APP}${p}`, b)
  r.s === 401
    ? ok(`Guard ${m} ${p}`, '401')
    : no(`Guard ${m} ${p}`, `got ${r.s}`)
}

// 3. Sign up via the real Supabase auth endpoint — same call the app's /signup page makes.
//    Then auto-confirm via admin API so the sim can proceed without clicking an email link.
sep('Signup (real flow)')
for (const u of USERS) {
  if (SIM_EMAIL && u.type === 'contractor') {
    const [local, domain] = SIM_EMAIL.split('@')
    u.email = `${local}+sim_${u.type}_${u.i}_${TS}@${domain}`
  } else {
    u.email = `sim_${u.type}_${u.i}_${TS}@traydbook-sim.test`
  }

  // Step 1 — real signup (same as supabase.auth.signUp() in the browser)
  const signup = await req('POST', `${SB}/auth/v1/signup`, { email: u.email, password: PW })
  if (!signup.b?.id) {
    no(`Signup #${u.i} ${u.name}`, signup.b?.message || signup.b?.msg || signup.s)
    continue
  }
  u.id = signup.b.id

  // Step 2 — auto-confirm email so the sim can sign in without clicking a link
  const confirm = await req('PUT', `${SB}/auth/v1/admin/users/${u.id}`,
    { email_confirm: true }, null, true)
  confirm.s === 200
    ? ok(`Signup #${u.i} ${u.name}`, u.id.slice(0,8) + '...')
    : no(`Confirm #${u.i} ${u.name}`, confirm.b?.message || confirm.s)
}

// 4. Sign in — same token endpoint Supabase client uses
sep('Sign In')
for (const u of USERS) {
  if (!u.id) continue
  const r = await req('POST', `${SB}/auth/v1/token?grant_type=password`, { email: u.email, password: PW })
  if (r.b?.access_token) {
    u.token = r.b.access_token
    ok(`Sign in #${u.i} ${u.name}`)
  } else {
    no(`Sign in #${u.i} ${u.name}`, r.b?.error_description || r.s)
  }
}

// 5. Onboarding — POST /api/onboarding/complete (app endpoint)
//    Creates row in users table + contractor_profiles for contractors
sep('Onboarding')
for (const u of USERS) {
  if (!u.token) continue
  const body = {
    display_name:   u.name,
    account_type:   u.type,
    location_city:  u.city,
    location_state: u.state,
  }
  if (u.trade) body.trade = u.trade
  const r = await req('POST', `${APP}/api/onboarding/complete`, body, u.token)
  r.s === 200 || r.s === 409
    ? ok(`Onboard #${u.i} ${u.name}`, `${u.type}${u.city ? ' · ' + u.city : ''}`)
    : no(`Onboard #${u.i} ${u.name}`, JSON.stringify(r.b).slice(0,80))
}

// 6. Wallet setup — contractors only
//    Mirrors the real /wallet-setup page flow:
//      a) generate keypair (browser does this automatically on page load)
//      b) save pubkey via POST /api/wallet/save-pubkey
//      c) optionally email encrypted key via POST /api/wallet/email-key
//         (only when SIM_EMAIL is set — use SIM_WALLET_PASSWORD to decrypt)
sep('Wallet Setup (contractors)')
const contractors = USERS.filter(u => u.type === 'contractor')
for (const u of contractors) {
  if (!u.token) continue
  const keypair    = Keypair.generate()
  const pubkey     = keypair.publicKey.toBase58()
  const privkeyJson = JSON.stringify(Array.from(keypair.secretKey))
  u.solana_pubkey  = pubkey

  // a) save pubkey
  const r = await req('POST', `${APP}/api/wallet/save-pubkey`, { pubkey }, u.token)
  r.s === 200
    ? ok(`Wallet #${u.i} ${u.name}`, pubkey.slice(0,12) + '...')
    : no(`Wallet #${u.i} ${u.name}`, r.b?.error || r.s)

  // b) email encrypted key (only if SIM_EMAIL is set)
  if (SIM_EMAIL && r.s === 200) {
    try {
      const { encryptedKey, iv, salt } = await encryptPrivateKey(privkeyJson, SIM_WALLET_PASSWORD)
      const er = await req('POST', `${APP}/api/wallet/email-key`, { encryptedKey, iv, salt, pubkey }, u.token)
      er.s === 200
        ? ok(`Wallet email #${u.i} ${u.name}`, u.email)
        : no(`Wallet email #${u.i} ${u.name}`, er.b?.error || er.s)
    } catch (e) {
      no(`Wallet email #${u.i} ${u.name}`, e.message)
    }
  }
}

// 7. Image upload (contractors)
sep('Image Upload')
for (const u of contractors) {
  if (!u.token) continue
  const r = await uploadImage(u.token)
  if (r.s === 200 && Array.isArray(r.b.urls) && r.b.urls.length > 0) {
    u.imageUrl = r.b.urls[0]
    ok(`Upload #${u.i} ${u.name}`, 'got public URL')
  } else {
    no(`Upload #${u.i} ${u.name}`, r.b?.error || r.s)
  }
}

// 8. Posts — all 10 users create a post via POST /api/posts
sep('Posts')
const POST_TYPES = {
  contractor:    ['trade_tip', 'project_update', 'safety_alert'],
  project_owner: ['project_update', 'story'],
}
for (const u of USERS) {
  if (!u.token) continue
  const types    = POST_TYPES[u.type] ?? ['project_update']
  const postType = types[u.i % types.length]
  const body = {
    post_type: postType,
    body:      `[SIM] ${u.name} — ${postType} posted at ${new Date(TS).toISOString()}`,
    hashtags:  ['TraydBook', 'SimTest'],
    ...(u.imageUrl ? { media_urls: [u.imageUrl] } : {}),
  }
  const r = await req('POST', `${APP}/api/posts`, body, u.token)
  if (r.s === 200 && r.b?.post?.id) {
    u.postId = r.b.post.id
    ok(`Post #${u.i} ${u.name}`, `${postType}${u.imageUrl ? ' +image' : ''}`)
  } else {
    no(`Post #${u.i} ${u.name}`, JSON.stringify(r.b).slice(0,80))
  }
}

// 9. Comments — cross-role engagement
sep('Comments')
const owners = USERS.filter(u => u.type === 'project_owner')
const contractorsWithPosts = contractors.filter(u => u.token && u.postId)
const ownersWithPosts      = owners.filter(u => u.token && u.postId)

for (const owner of ownersWithPosts.slice(0,3)) {
  for (const contractor of contractorsWithPosts.slice(0,3)) {
    const r = await rpc('post_comment', {
      p_post_id: contractor.postId,
      p_body:    `[SIM] ${owner.name} → ${contractor.name}: great work!`,
    }, owner.token)
    typeof r.b === 'string' && r.b.length === 36
      ? ok(`Comment: ${owner.name} → ${contractor.name}`)
      : no(`Comment: ${owner.name} → ${contractor.name}`, JSON.stringify(r.b).slice(0,60))
  }
}
for (const contractor of contractorsWithPosts.slice(0,3)) {
  for (const owner of ownersWithPosts.slice(0,2)) {
    const r = await rpc('post_comment', {
      p_post_id: owner.postId,
      p_body:    `[SIM] ${contractor.name} → ${owner.name}: interested in this project!`,
    }, contractor.token)
    typeof r.b === 'string' && r.b.length === 36
      ? ok(`Comment: ${contractor.name} → ${owner.name}`)
      : no(`Comment: ${contractor.name} → ${owner.name}`, JSON.stringify(r.b).slice(0,60))
  }
}

// 10. Likes — each user likes the next user's post
sep('Likes')
for (const u of USERS) {
  if (!u.token) continue
  const target = USERS[u.i % USERS.length]
  if (!target.postId) continue
  const r = await rpc('increment_post_like', { post_id: target.postId, delta: 1 }, u.token)
  r.s === 200 || r.s === 204
    ? ok(`Like: ${u.name} → ${target.name}'s post`)
    : no(`Like: ${u.name} → ${target.name}`, `${r.s} ${JSON.stringify(r.b).slice(0,40)}`)
}

// 11. Fund owners (50 credits each — needed for posting RFQs)
sep('Fund Owners (50 credits each)')
for (const u of owners) {
  const r = await sbAdminPatch('users', { id: u.id }, { credit_balance: 50 })
  const row = Array.isArray(r.b) ? r.b[0] : r.b
  row?.credit_balance === 50
    ? ok(`Fund ${u.name}`, '50 credits')
    : no(`Fund ${u.name}`, JSON.stringify(r.b).slice(0,60))
}

// 12. Post RFQs (each owner posts one, costs 10 credits via RPC)
sep('Post RFQs')
const TRADES_FOR_RFQ = ['Electrical', 'Plumbing', 'HVAC', 'Carpentry', 'Painting']
const bidDeadline    = new Date(TS + 30 * 24 * 60 * 60 * 1000).toISOString()

for (const [idx, u] of owners.entries()) {
  if (!u.token) continue
  const trade = TRADES_FOR_RFQ[idx % TRADES_FOR_RFQ.length]
  const r = await rpc('post_rfq', {
    p_title:             `[SIM] ${u.name} — ${trade} Project`,
    p_trade_needed:      trade,
    p_project_type:      'renovation',
    p_scope_description: `Sim RFQ by ${u.name}. Seeking ${trade} work for a 2,000 sqft space in ${u.city}.`,
    p_budget_min:        5000,
    p_budget_max:        15000,
    p_sq_footage:        2000,
    p_start_date:        null,
    p_duration_weeks:    4,
    p_bid_deadline:      bidDeadline,
    p_location_zip:      `9000${u.i}`,
    p_location_city:     u.city,
    p_location_state:    u.state,
    p_requirements:      ['Licensed', 'Insured'],
    p_share_to_feed:     false,
  }, u.token)
  if (r.s === 200 && typeof r.b === 'string') {
    u.rfqId = r.b
    ok(`RFQ #${u.i} ${u.name}`, `${trade} · id: ${r.b.slice(0,8)}...`)
  } else {
    no(`RFQ #${u.i} ${u.name}`, JSON.stringify(r.b))
  }
}

// 13. All contractors bid on Morgan Build's RFQ
sep('Submit Bids')
const targetOwner = owners[0]
if (targetOwner?.rfqId) {
  for (const [idx, contractor] of contractors.entries()) {
    if (!contractor.token) continue
    const amount = 7500 + idx * 500
    const r = await rpc('submit_bid', {
      p_rfq_id:         targetOwner.rfqId,
      p_amount:         amount,
      p_timeline_weeks: 3 + idx,
      p_cover_note:     `[SIM] ${contractor.name} — ${contractor.trade} at $${amount}`,
      p_document_url:   null,
    }, contractor.token)
    if (r.s === 200 && typeof r.b === 'string') {
      contractor.bidId = r.b
      ok(`Bid: ${contractor.name}`, `$${amount} — id: ${r.b.slice(0,8)}...`)
    } else {
      no(`Bid: ${contractor.name}`, JSON.stringify(r.b).slice(0,80))
    }
  }
} else {
  no('Bids skipped', 'owner #6 RFQ not created')
}

// 14. Award Alex Sparks' bid
sep('Award Bid')
const winner = contractors[0]
if (targetOwner?.rfqId && winner?.bidId) {
  const r = await rpc('award_bid', {
    p_bid_id: winner.bidId,
    p_rfq_id: targetOwner.rfqId,
  }, targetOwner.token)
  r.s === 200 || r.s === 204
    ? ok(`Award: ${targetOwner.name} → ${winner.name}`, 'bid awarded')
    : no(`Award: ${targetOwner.name} → ${winner.name}`, JSON.stringify(r.b).slice(0,80))
} else {
  no('Award skipped', 'missing rfqId or bidId')
}

// 15. Wallet access — contractors should get 200, owners should get 403/404
sep('Wallet Access')
for (const u of USERS) {
  if (!u.token) continue
  const r = await req('GET', `${APP}/api/wallet/status`, null, u.token)
  if (u.type === 'contractor' && r.s === 200) {
    ok(`Wallet #${u.i} contractor`, `pubkey: ${r.b.solana_pubkey?.slice(0,12) || 'none'}...`)
  } else if (u.type === 'project_owner' && (r.s === 403 || r.s === 404)) {
    ok(`Wallet #${u.i} owner blocked`, `${r.s} correct`)
  } else {
    no(`Wallet #${u.i}`, `expected ${u.type === 'contractor' ? 200 : '403/404'} got ${r.s}`)
  }
}

// 16. Cleanup — only if SIM_CLEANUP=1
sep('Cleanup')
if (!CLEANUP) {
  console.log(`  ⏭  Skipped — set SIM_CLEANUP=1 to delete sim users after the run`)
  console.log(`  ℹ  ${USERS.filter(u => u.id).length} sim users are now visible in the admin panel`)
  if (SIM_EMAIL) {
    console.log(`  ✉  Wallet key emails sent to: ${SIM_EMAIL} (+ addressing per contractor)`)
    console.log(`  🔑  Decrypt password: ${SIM_WALLET_PASSWORD}`)
  }
} else {
  for (const u of USERS) {
    if (!u.id) continue
    const r = await req('DELETE', `${SB}/auth/v1/admin/users/${u.id}`, null, null, true)
    r.s === 200
      ? ok(`Delete #${u.i} ${u.name}`)
      : no(`Delete #${u.i}`, r.s)
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(52)}`)
console.log(`  ✅ Passed: ${pass}`)
console.log(`  ❌ Failed: ${fail}`)
console.log(`  Total:    ${pass + fail}`)
if (!CLEANUP) {
  console.log(`\n  Sim users persist. To clean up later:`)
  console.log(`  DELETE from auth.users where email like 'sim_%@traydbook-sim.test'`)
}
console.log(`${'═'.repeat(52)}\n`)
