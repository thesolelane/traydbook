import { logError } from './errorLog.js'

async function pushToBob(path, body = {}, method = 'POST') {
  const endpoint = process.env.BOB_URL || process.env.BOB_AGENT_ENDPOINT
  const token = process.env.BOB_ADMIN_KEY || process.env.ADMIN_TO_BOB_TOKEN
  if (!endpoint || !token) return

  const url = `${endpoint.replace(/\/$/, '')}/bob${path}`

  try {
    const r = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    })

    if (!r.ok) {
      let detail = `Bob returned HTTP ${r.status}`
      try {
        const data = await r.json()
        if (data?.error) detail = data.error
        else if (data?.message) detail = data.message
      } catch (_) {}
      logError({
        context: 'bob',
        message: `Bob push failed: ${method} ${path} → ${r.status}`,
        detail,
        route: path,
        method,
        statusCode: r.status,
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logError({
      context: 'bob',
      message: `Bob unreachable: ${method} ${path} — ${msg}`,
      detail: `Endpoint: ${url}`,
      stack: e instanceof Error ? e.stack : undefined,
      route: path,
      method,
    })
  }
}

export { pushToBob }
