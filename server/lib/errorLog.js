import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_FILE = path.join(__dirname, '../../.local/error_log.jsonl')
const MAX_MEMORY = 500

const memoryLog = []

function ensureLogDir() {
  const dir = path.dirname(LOG_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// Infer which system caused the error so the UI can group and filter by origin.
// Priority order matters — Supabase and Stripe checks run before the generic
// network check so a Supabase fetch failure isn't mis-labelled as "network".
function detectSource({ context, message = '', detail = '', stack = '', statusCode }) {
  const text = `${message} ${detail} ${stack}`.toLowerCase()

  // Supabase / PostgREST — PGRST codes, RLS, JWT, Postgres class codes
  if (
    /pgrst\d+/.test(text) ||
    text.includes('supabase') ||
    text.includes('postgrest') ||
    text.includes('row-level security') ||
    text.includes('jwt expired') ||
    text.includes('invalid jwt') ||
    text.includes('violates row') ||
    /\b(23[0-9]{3}|42[0-9]{3}|53[0-9]{3})\b/.test(text)
  ) return 'supabase'

  // Stripe — explicit context or stripe error markers
  if (context === 'stripe' || text.includes('stripe') || text.includes('stripeerror')) return 'stripe'

  // Network / external service — fetch, DNS, socket failures
  if (
    text.includes('fetch failed') ||
    text.includes('failed to fetch') ||
    text.includes('econnrefused') ||
    text.includes('enotfound') ||
    text.includes('econnreset') ||
    text.includes('etimedout') ||
    text.includes('socket hang up') ||
    text.includes('network error') ||
    text.includes('network timeout')
  ) return 'network'

  // Client errors (4xx) — bad input, auth, not found — not a system fault
  if (statusCode && statusCode >= 400 && statusCode < 500) return 'client'

  // Default: Node / Express server
  return 'server'
}

export function logError({ context, message, detail, stack, userId, route, method, statusCode }) {
  const source = detectSource({ context, message, detail, stack, statusCode })
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    context: context ?? 'server',
    source,
    message: message ?? 'Unknown error',
    detail: detail ?? null,
    stack: stack ?? null,
    userId: userId ?? null,
    route: route ?? null,
    method: method ?? null,
    statusCode: statusCode ?? null,
  }

  memoryLog.unshift(entry)
  if (memoryLog.length > MAX_MEMORY) memoryLog.pop()

  try {
    ensureLogDir()
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8')
  } catch (_) {}

  return entry
}

export function getErrorLog({ limit = 100, offset = 0, context, source } = {}) {
  let items = memoryLog
  if (context) items = items.filter(e => e.context === context)
  if (source) items = items.filter(e => e.source === source)
  return {
    total: items.length,
    items: items.slice(offset, offset + limit),
  }
}

export function clearErrorLog() {
  memoryLog.length = 0
  try {
    ensureLogDir()
    fs.writeFileSync(LOG_FILE, '', 'utf8')
  } catch (_) {}
}

export function loadLogFromDisk() {
  try {
    ensureLogDir()
    if (!fs.existsSync(LOG_FILE)) return
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean)
    const entries = lines
      .map(l => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
    // Back-fill source for legacy entries that predate this field
    entries.forEach(e => {
      if (!e.source) {
        e.source = detectSource({
          context: e.context,
          message: e.message,
          detail: e.detail,
          stack: e.stack,
          statusCode: e.statusCode,
        })
      }
    })
    entries.reverse().forEach(e => {
      if (memoryLog.length < MAX_MEMORY) memoryLog.push(e)
    })
  } catch (_) {}
}
