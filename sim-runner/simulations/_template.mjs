#!/usr/bin/env node
// ── NEW APP SIMULATION TEMPLATE ────────────────────────────────
// Copy this file, rename it to your-app.mjs, then:
//   1. Add env vars to .env (APP_URL + any auth keys)
//   2. Register the app in server.mjs APPS array
//   3. Replace stub sections below with real checks
//
// Required env vars (set in .env):
//   SIM_APP_URL   https://your-app.yourdomain.com

const APP = process.env.SIM_APP_URL || ''
if (!APP) { console.error('[sim] Missing SIM_APP_URL'); process.exit(1) }

let pass = 0, fail = 0
const ok  = (m, d='') => { console.log(`  ✅ ${m}${d ? ' — '+d : ''}`); pass++ }
const no  = (m, d='') => { console.log(`  ❌ ${m}${d ? ' — '+d : ''}`); fail++ }
const sep = t          =>   console.log(`\n── ${t} ──`)

async function req(method, url, body, token) {
  const h = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  const opts = { method, headers: h }
  if (body && method !== 'GET') opts.body = JSON.stringify(body)
  const r = await fetch(url, opts)
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

console.log(`\n${'═'.repeat(52)}\n  [YOUR APP] Simulation\n  ${new Date().toISOString()}\n${'═'.repeat(52)}`)

sep('Health')
const hc = await req('GET', `${APP}/healthz`)
hc.b?.ok || hc.s === 200 ? ok('Health check') : no('Health check', hc.s)

sep('Auth Guards')
// for (const [m, p] of [['GET', '/api/protected']]) {
//   const r = await req(m, `${APP}${p}`)
//   r.s === 401 ? ok(`Guard ${p}`) : no(`Guard ${p}`, `got ${r.s}`)
// }
ok('Stub — add your protected routes')

sep('Core Flows')
// TODO: sign up, sign in, main feature flows, cleanup
ok('Stub — add your user journeys')

console.log(`\n${'═'.repeat(52)}`)
console.log(`  ✅ Passed: ${pass}`)
console.log(`  ❌ Failed: ${fail}`)
console.log(`  Total:    ${pass+fail}`)
console.log(`${'═'.repeat(52)}\n`)
if (fail > 0) process.exit(1)
