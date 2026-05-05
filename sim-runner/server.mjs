import 'dotenv/config'
import express from 'express'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app    = express()
const PORT   = process.env.PORT ?? 3000
const SECRET = process.env.SIM_SECRET ?? ''
const MAX_RUNS = 20

// ── App registry ───────────────────────────────────────────────────────────
// Add a new entry here for each app. env vars are passed to the sim script.
const APPS = [
  {
    id:   'traydbook',
    name: 'TraydBook',
    desc: 'Professional network for construction trades',
    sim:  'traydbook.mjs',
    env: {
      SIM_APP_URL:        () => process.env.TB_APP_URL        ?? '',
      SIM_SB_URL:         () => process.env.TB_SB_URL         ?? '',
      SIM_SB_ANON_KEY:    () => process.env.TB_SB_ANON_KEY    ?? '',
      SIM_SB_SERVICE_KEY: () => process.env.TB_SB_SERVICE_KEY ?? '',
    },
  },
  {
    id:   'wallet-buddy',
    name: 'Wallet Buddy Portal',
    desc: 'Solana wallet management + DEX integrations',
    sim:  'wallet-buddy.mjs',
    env: {
      SIM_APP_URL: () => process.env.WB_APP_URL ?? '',
    },
  },
  // Add more apps here following the same pattern:
  // {
  //   id: 'my-app', name: 'My App', desc: '...', sim: 'my-app.mjs',
  //   env: { SIM_APP_URL: () => process.env.MYAPP_URL ?? '' },
  // },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function resultsPath(appId) {
  return path.join(__dirname, 'results', `${appId}.json`)
}

function loadResults(appId) {
  try {
    const p = resultsPath(appId)
    if (!fs.existsSync(p)) return []
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch { return [] }
}

function saveResults(appId, runs) {
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true })
  fs.writeFileSync(resultsPath(appId), JSON.stringify(runs.slice(0, MAX_RUNS), null, 2))
}

function checkSecret(req, res) {
  if (!SECRET) { res.status(503).json({ error: 'SIM_SECRET not configured' }); return false }
  const given = req.query.secret ?? req.headers['x-sim-secret']
  if (given !== SECRET) { res.status(401).json({ error: 'Invalid secret' }); return false }
  return true
}

const running = new Set()

function runSim(app, source) {
  if (running.has(app.id)) return null

  const run = {
    id:          `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    triggered_by: source,
    started_at:  new Date().toISOString(),
    finished_at: null,
    duration_ms: null,
    pass: null, fail: null, total: null,
    status: 'running',
    output: '',
  }

  const runs = loadResults(app.id)
  runs.unshift(run)
  saveResults(app.id, runs)
  running.add(app.id)

  const simFile = path.join(__dirname, 'simulations', app.sim)
  const env = { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' }
  for (const [key, fn] of Object.entries(app.env)) env[key] = fn()

  const child = spawn('node', [simFile], { env, stdio: ['ignore','pipe','pipe'] })
  const start = Date.now()
  let output = ''

  child.stdout.on('data', c => { output += c })
  child.stderr.on('data', c => { output += '[stderr] ' + c })

  child.on('close', code => {
    running.delete(app.id)
    const passMatch = output.match(/✅ Passed:\s*(\d+)/)
    const failMatch = output.match(/❌ Failed:\s*(\d+)/)
    const pass = passMatch ? parseInt(passMatch[1]) : null
    const fail = failMatch ? parseInt(failMatch[1]) : null

    run.finished_at = new Date().toISOString()
    run.duration_ms = Date.now() - start
    run.pass  = pass
    run.fail  = fail
    run.total = pass != null && fail != null ? pass + fail : null
    run.status = code === 0 && fail === 0 ? 'pass' : 'fail'
    run.output = output

    const fresh = loadResults(app.id)
    const idx = fresh.findIndex(r => r.id === run.id)
    if (idx !== -1) fresh[idx] = run; else fresh.unshift(run)
    saveResults(app.id, fresh)

    const icon = run.status === 'pass' ? '✅' : '❌'
    console.log(`[sim:${app.id}] ${icon} ${run.pass}/${run.total} — ${(run.duration_ms/1000).toFixed(1)}s`)
  })

  return run.id
}

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// ── API ────────────────────────────────────────────────────────────────────

// GET /api/apps — list all registered apps + latest run summary
app.get('/api/apps', (req, res) => {
  const data = APPS.map(a => {
    const runs = loadResults(a.id)
    const last = runs[0] ?? null
    return {
      id:      a.id,
      name:    a.name,
      desc:    a.desc,
      running: running.has(a.id),
      last: last ? {
        status:      last.status,
        pass:        last.pass,
        fail:        last.fail,
        total:       last.total,
        duration_ms: last.duration_ms,
        started_at:  last.started_at,
        finished_at: last.finished_at,
      } : null,
    }
  })
  res.json(data)
})

// POST /api/run/:appId — trigger a sim (used by Coolify webhook)
app.post('/api/run/:appId', (req, res) => {
  if (!checkSecret(req, res)) return
  const app = APPS.find(a => a.id === req.params.appId)
  if (!app) return res.status(404).json({ error: `Unknown app: ${req.params.appId}` })
  if (running.has(app.id)) return res.status(409).json({ error: 'Already running' })

  const source = req.query.source ?? req.headers['x-coolify-event'] ?? 'webhook'
  const runId  = runSim(app, source)
  res.status(202).json({ ok: true, app: app.id, run_id: runId })
})

// GET /api/results/:appId — full run history for one app
app.get('/api/results/:appId', (req, res) => {
  if (!checkSecret(req, res)) return
  const app = APPS.find(a => a.id === req.params.appId)
  if (!app) return res.status(404).json({ error: `Unknown app: ${req.params.appId}` })
  const limit = Math.min(parseInt(req.query.limit ?? '10'), MAX_RUNS)
  res.json({ running: running.has(app.id), runs: loadResults(app.id).slice(0, limit) })
})

// GET /api/results/:appId/:runId/output — full output for a single run
app.get('/api/results/:appId/:runId/output', (req, res) => {
  if (!checkSecret(req, res)) return
  const runs = loadResults(req.params.appId)
  const run  = runs.find(r => r.id === req.params.runId)
  if (!run) return res.status(404).json({ error: 'Run not found' })
  res.type('text/plain').send(run.output)
})

// ── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[sim-runner] Running on http://localhost:${PORT}`)
  console.log(`[sim-runner] Apps registered: ${APPS.map(a => a.id).join(', ')}`)
  if (!SECRET) console.warn('[sim-runner] WARNING: SIM_SECRET not set — endpoints are unprotected')
})
