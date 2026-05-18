async function pushToBob(path, body = {}, method = 'POST') {
  const endpoint = process.env.BOB_AGENT_ENDPOINT
  const token = process.env.ADMIN_TO_BOB_TOKEN
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
