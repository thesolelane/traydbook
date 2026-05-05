#!/usr/bin/env node
// TraydBook End-to-End Simulation — v3
// 112 checks: health · auth guards · create/signin/onboard 10 users ·
// image upload · posts · comments · likes · fund owners ·
// RFQs · bids · bid award · wallet access · cleanup
//
// Required env vars (set in sim-runner .env):
//   SIM_APP_URL        https://dev.traydbook.com
//   SIM_SB_URL         Supabase project URL
//   SIM_SB_ANON_KEY    Supabase anon key
//   SIM_SB_SERVICE_KEY Supabase service role key

const APP = process.env.SIM_APP_URL        || ''
const SB  = process.env.SIM_SB_URL         || ''
const AK  = process.env.SIM_SB_ANON_KEY    || ''
const SK  = process.env.SIM_SB_SERVICE_KEY || ''

if (!APP || !SB || !AK || !SK) {
  console.error('[traydbook] Missing env vars: SIM_APP_URL, SIM_SB_URL, SIM_SB_ANON_KEY, SIM_SB_SERVICE_KEY')
  process.exit(1)
}

const TS  = Date.now()
const PW  = 'TraydSim2026!'
const GIF = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64')

const USERS = [
  { i:1,  type:'contractor',    trade:'Electrician', name:'Alex Sparks'    },
  { i:2,  type:'contractor',    trade:'Plumber',     name:'Jordan Pipes'   },
  { i:3,  type:'contractor',    trade:'HVAC Tech',   name:'Sam Coldair'    },
  { i:4,  type:'contractor',    trade:'Carpenter',   name:'Casey Frame'    },
  { i:5,  type:'contractor',    trade:'Painter',     name:'Riley Brush'    },
  { i:6,  type:'project_owner', trade:null,          name:'Morgan Build'   },
  { i:7,  type:'project_owner', trade:null,          name:'Taylor Develop' },
  { i:8,  type:'project_owner', trade:null,          name:'Drew Construct' },
  { i:9,  type:'project_owner', trade:null,          name:'Quinn Projects' },
  { i:10, type:'project_owner', trade:null,          name:'Blake Estate'   },
]

let pass = 0, fail = 0
const ok  = (m, d='') => { console.log(`  ✅ ${m}${d ? ' — '+d : ''}`); pass++ }
const no  = (m, d='') => { console.log(`  ❌ ${m}${d ? ' — '+d : ''}`); fail++ }
const sep = t          =>   console.log(`\n── ${t} ──`)

async function req(method, url, body, token, admin) {
  const h = { 'Content-Type': 'application/json' }
  if (admin)    { h['Authorization'] = `Bearer ${SK}`; h['apikey'] = SK }
  else if (token) h['Authorization'] = `Bearer ${token}`
  else            h['apikey'] = AK
  const opts = { method, headers: h }
  if (body && method !== 'GET' && method !== 'DELETE') opts.body = JSON.stringify(body)
  const r = await fetch(url, opts)
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

async function rpc(fn, args, token) {
  const h = { 'Content-Type':'application/json', 'apikey':AK, 'Authorization':`Bearer ${token}` }
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method:'POST', headers:h, body:JSON.stringify(args) })
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

async function sbAdminPatch(table, match, update) {
  const qs = Object.entries(match).map(([k,v]) => `${k}=eq.${v}`).join('&')
  const h  = { 'Content-Type':'application/json', 'apikey':SK, 'Authorization':`Bearer ${SK}`, 'Prefer':'return=representation' }
  const r  = await fetch(`${SB}/rest/v1/${table}?${qs}`, { method:'PATCH', headers:h, body:JSON.stringify(update) })
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

async function uploadImage(token) {
  const form = new FormData()
  form.append('files', new Blob([GIF], { type:'image/gif' }), 'sim-test.gif')
  const r = await fetch(`${APP}/api/upload/post-media`, {
    method:'POST', headers:{ 'Authorization':`Bearer ${token}` }, body: form,
  })
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

console.log(`\n${'═'.repeat(52)}\n  TraydBook Simulation\n  ${new Date().toISOString()}\n${'═'.repeat(52)}`)

sep('Health')
const hc = await req('GET', `${APP}/healthz`)
hc.b?.ok ? ok('Health check') : no('Health check', hc.s)

sep('Auth Guards')
for (const [m, p, b] of [
  ['GET',  '/api/wallet/status',       null],
  ['POST', '/api/team/invite',         {}  ],
  ['POST', '/api/onboarding/complete', {}  ],
  ['POST', '/api/posts',               {}  ],
  ['POST', '/api/upload/post-media',   null],
]) {
  const r = await req(m, `${APP}${p}`, b)
  r.s === 401 ? ok(`Guard ${m} ${p}`) : no(`Guard ${m} ${p}`, `got ${r.s}`)
}

sep('Create 10 Users')
for (const u of USERS) {
  u.email = `sim_${u.i}_${TS}@traydbook.sim`
  const r = await req('POST', `${SB}/auth/v1/admin/users`,
    { email: u.email, password: PW, email_confirm: true }, null, true)
  if (r.s === 200 && r.b.id) { u.id = r.b.id; ok(`Create ${u.name}`, u.id.slice(0,8)+'...') }
  else no(`Create ${u.name}`, r.b?.message || r.s)
}

sep('Sign In All')
for (const u of USERS) {
  if (!u.id) continue
  const r = await req('POST', `${SB}/auth/v1/token?grant_type=password`, { email: u.email, password: PW })
  if (r.b?.access_token) { u.token = r.b.access_token; ok(`Sign in ${u.name}`) }
  else no(`Sign in ${u.name}`, r.b?.error_description || r.s)
}

sep('Onboarding')
for (const u of USERS) {
  if (!u.token) continue
  const body = { display_name: u.name, account_type: u.type, ...(u.trade ? { trade: u.trade } : {}) }
  const r = await req('POST', `${APP}/api/onboarding/complete`, body, u.token)
  r.s === 200 || r.s === 409 ? ok(`Onboard ${u.name}`) : no(`Onboard ${u.name}`, JSON.stringify(r.b))
}

sep('Image Upload')
for (const u of USERS.filter(u => u.type === 'contractor')) {
  if (!u.token) continue
  const r = await uploadImage(u.token)
  if (r.s === 200 && r.b.urls?.length) { u.imageUrl = r.b.urls[0]; ok(`Upload ${u.name}`) }
  else no(`Upload ${u.name}`, r.b?.error || r.s)
}

sep('Posts')
const POST_TYPES = { contractor: ['trade_tip','project_update','safety_alert'], project_owner: ['project_update','story'] }
for (const u of USERS) {
  if (!u.token) continue
  const types = POST_TYPES[u.type] ?? ['project_update']
  const postType = types[u.i % types.length]
  const body = {
    post_type: postType,
    body: `[SIM] ${u.name} — ${postType} at ${new Date(TS).toISOString()}`,
    hashtags: ['TraydBook','SimTest'],
    ...(u.imageUrl ? { media_urls: [u.imageUrl] } : {}),
  }
  const r = await req('POST', `${APP}/api/posts`, body, u.token)
  if (r.s === 200 && r.b?.post?.id) { u.postId = r.b.post.id; ok(`Post ${u.name}`, postType) }
  else no(`Post ${u.name}`, JSON.stringify(r.b))
}

sep('Comments')
const contractors = USERS.filter(u => u.type==='contractor'    && u.token && u.postId)
const owners      = USERS.filter(u => u.type==='project_owner' && u.token && u.postId)
for (const o of owners.slice(0,3)) for (const c of contractors.slice(0,3)) {
  const r = await rpc('post_comment', { p_post_id: c.postId, p_body: `[SIM] ${o.name} → ${c.name}` }, o.token)
  typeof r.b==='string' && r.b.length===36 ? ok(`Comment ${o.name}→${c.name}`) : no(`Comment ${o.name}→${c.name}`, JSON.stringify(r.b))
}
for (const c of contractors.slice(0,3)) for (const o of owners.slice(0,2)) {
  const r = await rpc('post_comment', { p_post_id: o.postId, p_body: `[SIM] ${c.name} → ${o.name}` }, c.token)
  typeof r.b==='string' && r.b.length===36 ? ok(`Comment ${c.name}→${o.name}`) : no(`Comment ${c.name}→${o.name}`, JSON.stringify(r.b))
}

sep('Likes')
for (const u of USERS) {
  if (!u.token) continue
  const target = USERS[u.i % USERS.length]
  if (!target.postId) continue
  const r = await rpc('increment_post_like', { post_id: target.postId, delta: 1 }, u.token)
  r.s===200||r.s===204 ? ok(`Like ${u.name}→${target.name}`) : no(`Like ${u.name}→${target.name}`, r.s)
}

sep('Fund Owners')
for (const u of owners) {
  const r = await sbAdminPatch('users', { id: u.id }, { credit_balance: 50 })
  const row = Array.isArray(r.b) ? r.b[0] : r.b
  row?.credit_balance===50 ? ok(`Fund ${u.name}`) : no(`Fund ${u.name}`, JSON.stringify(r.b))
}

sep('Post RFQs')
const TRADES = ['Electrical','Plumbing','HVAC','Carpentry','Painting']
const deadline = new Date(TS + 30*24*60*60*1000).toISOString()
for (const [i, u] of owners.entries()) {
  if (!u.token) continue
  const trade = TRADES[i % TRADES.length]
  const r = await rpc('post_rfq', {
    p_title: `[SIM] ${u.name} — ${trade}`, p_trade_needed: trade,
    p_project_type: 'renovation', p_scope_description: `Sim RFQ by ${u.name}`,
    p_budget_min: 5000, p_budget_max: 15000, p_sq_footage: 2000,
    p_start_date: null, p_duration_weeks: 4, p_bid_deadline: deadline,
    p_location_zip: `9000${u.i}`, p_location_city: 'Los Angeles', p_location_state: 'CA',
    p_requirements: ['Licensed','Insured'], p_share_to_feed: false,
  }, u.token)
  if (r.s===200 && typeof r.b==='string') { u.rfqId=r.b; ok(`RFQ ${u.name}`, trade) }
  else no(`RFQ ${u.name}`, JSON.stringify(r.b))
}

sep('Submit Bids')
const targetOwner = owners[0]
if (targetOwner?.rfqId) {
  for (const [i, c] of contractors.entries()) {
    if (!c.token) continue
    const amount = 7500 + i*500
    const r = await rpc('submit_bid', {
      p_rfq_id: targetOwner.rfqId, p_amount: amount,
      p_timeline_weeks: 3+i, p_cover_note: `[SIM] ${c.name} $${amount}`, p_document_url: null,
    }, c.token)
    if (r.s===200 && typeof r.b==='string') { c.bidId=r.b; ok(`Bid ${c.name}`, `$${amount}`) }
    else no(`Bid ${c.name}`, JSON.stringify(r.b))
  }
} else no('Bids skipped', 'no RFQ')

sep('Award Bid')
const winner = contractors[0]
if (targetOwner?.rfqId && winner?.bidId) {
  const r = await rpc('award_bid', { p_bid_id: winner.bidId, p_rfq_id: targetOwner.rfqId }, targetOwner.token)
  r.s===200||r.s===204 ? ok(`Award ${winner.name}`) : no(`Award`, JSON.stringify(r.b))
} else no('Award skipped', 'missing rfqId or bidId')

sep('Wallet Access')
for (const u of USERS) {
  if (!u.token) continue
  const r = await req('GET', `${APP}/api/wallet/status`, null, u.token)
  if (u.type==='contractor' && r.s===200) ok(`Wallet ${u.name}`, 'allowed')
  else if (u.type==='project_owner' && (r.s===403||r.s===404)) ok(`Wallet ${u.name}`, 'blocked correctly')
  else no(`Wallet ${u.name}`, `expected ${u.type==='contractor'?200:'403/404'} got ${r.s}`)
}

sep('Cleanup')
for (const u of USERS) {
  if (!u.id) continue
  const r = await req('DELETE', `${SB}/auth/v1/admin/users/${u.id}`, null, null, true)
  r.s===200 ? ok(`Delete ${u.name}`) : no(`Delete ${u.name}`, r.s)
}

console.log(`\n${'═'.repeat(52)}`)
console.log(`  ✅ Passed: ${pass}`)
console.log(`  ❌ Failed: ${fail}`)
console.log(`  Total:    ${pass+fail}`)
console.log(`${'═'.repeat(52)}\n`)
if (fail > 0) process.exit(1)
