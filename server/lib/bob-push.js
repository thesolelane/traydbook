async function pushToBob(path, body = {}, method = 'POST') {
  // Support both naming conventions:
  // BOB_URL / BOB_ADMIN_KEY  — Bob's own handoff spec
  // BOB_AGENT_ENDPOINT / ADMIN_TO_BOB_TOKEN — legacy TraydBook names
  const endpoint = process.env.BOB_URL || process.env.BOB_AGENT_ENDPOINT
  const token = process.env.BOB_ADMIN_KEY || process.env.ADMIN_TO_BOB_TOKEN
  if (!endpoint || !token) return

  try {
    await fetch(`${endpoint.replace(/\/$/, '')}/bob${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // Non-fatal — DB is source of truth
  }
}

export { pushToBob }
