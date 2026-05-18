import { Router } from 'express'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { requireAuth, requireSuperAdmin } from '../lib/auth.js'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const SNAPSHOT_FILE = path.join(ROOT, '.security-snapshot.json')

const router = Router()

// ── Dependency Audit ──────────────────────────────────────────────────────────

router.get('/audit', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { stdout } = await execAsync('npm audit --json 2>/dev/null || true', { cwd: ROOT })
    const report = JSON.parse(stdout || '{}')
    res.json({ ok: true, report })
  } catch (err) {
    try {
      const report = JSON.parse(err.stdout ?? '{}')
      res.json({ ok: true, report })
    } catch {
      res.status(500).json({ error: 'Failed to run audit', detail: String(err.message) })
    }
  }
})

// ── Code Pattern Scanner ──────────────────────────────────────────────────────

const SCAN_DIRS = ['src', 'server', 'admin-app/src', 'admin-server.js']
const SCAN_EXTS = new Set(['.js', '.ts', '.tsx', '.jsx'])

const PATTERNS = [
  {
    id: 'hardcoded_stripe',
    label: 'Hardcoded Stripe secret key',
    severity: 'critical',
    re: /sk_live_[a-zA-Z0-9]{20,}/g,
  },
  {
    id: 'hardcoded_jwt',
    label: 'Hardcoded JWT / Bearer token',
    severity: 'critical',
    re: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g,
  },
  {
    id: 'hardcoded_password',
    label: 'Hardcoded password string',
    severity: 'high',
    re: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{6,}['"]/gi,
  },
  {
    id: 'eval_usage',
    label: 'eval() call (code injection risk)',
    severity: 'high',
    re: /\beval\s*\(/g,
  },
  {
    id: 'new_function',
    label: 'new Function() (eval-equivalent)',
    severity: 'high',
    re: /new\s+Function\s*\(/g,
  },
  {
    id: 'exec_user_input',
    label: 'exec/spawn with possible user input',
    severity: 'high',
    re: /(?:exec|execSync|spawn)\s*\(\s*(?:req\.|res\.|body\.|params\.|query\.)/g,
  },
  {
    id: 'sql_string_concat',
    label: 'String-interpolated SQL query',
    severity: 'high',
    re: /(?:SELECT|INSERT|UPDATE|DELETE)[^'"]*\$\{/gi,
  },
  {
    id: 'dangerously_html',
    label: 'dangerouslySetInnerHTML (XSS risk)',
    severity: 'medium',
    re: /dangerouslySetInnerHTML/g,
  },
  {
    id: 'console_secret',
    label: 'Logging possible secret value',
    severity: 'medium',
    re: /console\.(?:log|warn|error)\s*\([^)]*(?:password|secret|token|api_?key|private)[^)]*\)/gi,
  },
  {
    id: 'todo_security',
    label: 'Security TODO / FIXME',
    severity: 'low',
    re: /(?:TODO|FIXME|HACK|XXX)[^\n]*(?:security|auth|password|secret|vuln|bypass)/gi,
  },
  {
    id: 'debug_mode',
    label: 'Hardcoded debug/dev flag',
    severity: 'low',
    re: /(?:DEBUG|DEV_MODE)\s*=\s*true/g,
  },
]

function walkDir(target) {
  const results = []
  if (!fs.existsSync(target)) return results
  let stat
  try { stat = fs.statSync(target) } catch { return results }
  if (stat.isFile()) {
    if (SCAN_EXTS.has(path.extname(target))) results.push(target)
    return results
  }
  let entries
  try { entries = fs.readdirSync(target) } catch { return results }
  for (const entry of entries) {
    if (['node_modules', '.git', 'admin-dist', 'dist'].includes(entry)) continue
    const full = path.join(target, entry)
    let s
    try { s = fs.statSync(full) } catch { continue }
    if (s.isDirectory()) {
      results.push(...walkDir(full))
    } else if (SCAN_EXTS.has(path.extname(full))) {
      results.push(full)
    }
  }
  return results
}

function scanFile(filePath, relPath) {
  const findings = []
  let content
  try { content = fs.readFileSync(filePath, 'utf8') } catch { return findings }
  const lines = content.split('\n')
  for (const pat of PATTERNS) {
    pat.re.lastIndex = 0
    let match
    while ((match = pat.re.exec(content)) !== null) {
      const before = content.slice(0, match.index)
      const lineNo = (before.match(/\n/g) ?? []).length + 1
      const snippet = (lines[lineNo - 1] ?? '').trim().slice(0, 120)
      findings.push({
        patternId: pat.id,
        label: pat.label,
        severity: pat.severity,
        file: relPath,
        line: lineNo,
        snippet,
      })
    }
  }
  return findings
}

router.get('/codescan', requireAuth, requireSuperAdmin, async (req, res) => {
  const allFindings = []
  let filesScanned = 0
  for (const d of SCAN_DIRS) {
    const abs = path.join(ROOT, d)
    const files = walkDir(abs)
    for (const f of files) {
      allFindings.push(...scanFile(f, path.relative(ROOT, f)))
      filesScanned++
    }
  }
  res.json({ ok: true, filesScanned, findings: allFindings, scannedAt: new Date().toISOString() })
})

// ── File Integrity Snapshot ───────────────────────────────────────────────────

function hashFile(filePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
  } catch {
    return null
  }
}

function buildSnapshot() {
  const hashes = {}
  for (const d of SCAN_DIRS) {
    const abs = path.join(ROOT, d)
    for (const f of walkDir(abs)) {
      const rel = path.relative(ROOT, f)
      const h = hashFile(f)
      if (h) hashes[rel] = h
    }
  }
  return hashes
}

router.post('/snapshot', requireAuth, requireSuperAdmin, async (req, res) => {
  const { label } = req.body ?? {}
  const hashes = buildSnapshot()
  const record = {
    label: label?.trim() || `Snapshot ${new Date().toISOString()}`,
    createdAt: new Date().toISOString(),
    createdBy: req.user.id,
    fileCount: Object.keys(hashes).length,
    hashes,
  }
  try {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(record, null, 2), 'utf8')
    res.json({ ok: true, label: record.label, fileCount: record.fileCount, createdAt: record.createdAt })
  } catch (err) {
    res.status(500).json({ error: 'Failed to write snapshot', detail: String(err.message) })
  }
})

router.get('/snapshot', requireAuth, requireSuperAdmin, async (req, res) => {
  if (!fs.existsSync(SNAPSHOT_FILE)) {
    return res.json({ baseline: null, comparison: null })
  }
  let baseline
  try {
    baseline = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'))
  } catch {
    return res.json({ baseline: null, comparison: null })
  }
  const current = buildSnapshot()
  const added = []
  const removed = []
  const modified = []
  let unchanged = 0
  for (const [file, hash] of Object.entries(current)) {
    if (!(file in baseline.hashes)) {
      added.push(file)
    } else if (baseline.hashes[file] !== hash) {
      modified.push(file)
    } else {
      unchanged++
    }
  }
  for (const file of Object.keys(baseline.hashes)) {
    if (!(file in current)) removed.push(file)
  }
  res.json({
    baseline: {
      label: baseline.label,
      createdAt: baseline.createdAt,
      fileCount: baseline.fileCount,
    },
    comparison: { added, removed, modified, unchanged },
    clean: added.length === 0 && removed.length === 0 && modified.length === 0,
  })
})

export default router
