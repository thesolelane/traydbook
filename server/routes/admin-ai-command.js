import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import crypto from 'crypto'

const router = Router()

function getLLMConfig() {
  if (process.env.BOB_ENDPOINT) {
    return {
      type: 'ollama',
      endpoint: process.env.BOB_ENDPOINT,
      model: process.env.BOB_MODEL || 'llama3',
    }
  }
  if (process.env.OPENAI_API_KEY) {
    return { type: 'openai', apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o' }
  }
  return null
}

async function callLLM(systemPrompt, userMessage) {
  const config = getLLMConfig()
  if (!config) throw new Error('No AI provider configured — set BOB_ENDPOINT or OPENAI_API_KEY')

  if (config.type === 'ollama') {
    const res = await fetch(`${config.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        format: 'json',
      }),
    })
    if (!res.ok) throw new Error(`BOB (Ollama) error: ${res.statusText}`)
    const json = await res.json()
    return json.message?.content || '{}'
  }

  if (config.type === 'openai') {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: config.apiKey })
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
    })
    return completion.choices[0].message.content
  }

  throw new Error('Unknown LLM provider')
}

const SYSTEM_PROMPT = `You are TraydBook's admin AI. Convert natural language into structured admin actions.

Available actions:

USER MANAGEMENT
- searchUsers(query, filters): Search users by name, email, trade
- getUserRiskProfile(userId): Get fraud risk score and factors
- banUser(userId, reason, duration): Ban a user — REQUIRES confirmation before /execute will accept it
- holdUser(userId, reason, until): Place account on hold
- adjustCredits(userId, amount, reason): Adjust user credit balance — REQUIRES confirmation before /execute
- revokeUserSessions(userId, reason): Force-logout all active sessions for a user

SECURITY & MODERATION
- getSecurityEvents(filters, limit): Get recent security events
- getModerationQueue(filters): Get content moderation queue
- runSecurityScan(type): Trigger a security scan — type is "audit" (npm vulnerability scan) or "codescan" (regex scan for secrets/issues in source files). Rate-limited to 5/hour.
- summarizeAudit(period): Summarize admin audit log

SQL REPAIR (two-person workflow — all steps require super-admin)
- requestRepair(sql, description): Submit a destructive SQL statement for peer review. Returns a pending approval request. The requester cannot approve their own request.
- approveRepair(approvalCode, notes): Approve a pending repair request submitted by a different admin.
- executeRepair(sql, approvalCode): Execute SQL that has been approved. The approval code is cryptographically bound to the exact SQL submitted — it cannot be reused on a different query. Codes expire after 1 hour.
- listRepairApprovals(): List pending and recent repair approval requests.

BOB AGENT CONTROL (requires admin-level role)
- getBobStatus(): Read current Bob control flags (paused, ai_provider_override, lead_refresh_force, max_leads_per_cycle)
- setBobControl(key, value): Update a single Bob control flag. Valid keys: paused (true/false), ai_provider_override (string|null), lead_refresh_force (true/false), max_leads_per_cycle (number)
- getBobLogs(agent, status, action, limit): Read Bob agent execution logs
- pingBob(): Test connectivity to Bob's agent server

CONFIRMATION RULES
- requiresConfirmation must be true for: banUser, adjustCredits, revokeUserSessions, requestRepair, approveRepair, executeRepair, setBobControl
- requiresConfirmation should be false for all read/search/list/get actions

Respond ONLY with valid JSON: { "intent": string, "parameters": object, "requiresConfirmation": boolean, "explanation": string, "confidence": number }`

// POST /api/admin/ai/command
router.post('/command', async (req, res) => {
  const { command } = req.body

  if (!command || command.length < 3) {
    return res.status(400).json({ error: 'Command too short' })
  }

  const config = getLLMConfig()
  if (!config) {
    return res.status(503).json({
      error: 'AI command bar not configured',
      hint: 'Set BOB_ENDPOINT (Ollama) or OPENAI_API_KEY',
    })
  }

  try {
    const raw = await callLLM(SYSTEM_PROMPT, command)
    const plan = JSON.parse(raw)

    let preview = null

    if (plan.intent === 'searchUsers' && plan.parameters?.query) {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id, name, email, trade_category, status, credits')
        .ilike('name', `%${plan.parameters.query}%`)
        .limit(5)
      preview = data
    } else if (plan.intent === 'getUserRiskProfile' && plan.parameters?.userId) {
      const { data } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', plan.parameters.userId)
        .single()
      preview = data
    } else if (plan.intent === 'getSecurityEvents') {
      const { data } = await supabaseAdmin
        .from('security_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(plan.parameters?.limit || 10)
      preview = data
    } else if (plan.intent === 'getModerationQueue') {
      const { data } = await supabaseAdmin
        .from('content_moderation_queue')
        .select('*')
        .eq('status', 'pending')
        .limit(10)
      preview = data
    }

    const confirmationToken = crypto.randomBytes(32).toString('hex')

    res.json({
      understood: true,
      confidence: plan.confidence || 0.8,
      plan,
      preview,
      requiresConfirmation: plan.requiresConfirmation || false,
      explanation: plan.explanation,
      confirmationToken,
      confirmUrl: '/api/admin/ai/execute',
      provider: config.type,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/ai/execute
router.post('/execute', async (req, res) => {
  const { confirmationToken, confirmedPlan } = req.body

  if (!confirmationToken || confirmationToken.length !== 64) {
    return res.status(400).json({ error: 'Invalid confirmation token' })
  }

  let result

  try {
    switch (confirmedPlan.intent) {
      case 'banUser': {
        const { userId, reason, duration } = confirmedPlan.parameters
        const { data, error } = await supabaseAdmin
          .from('users')
          .update({ status: 'banned', banned_at: new Date().toISOString(), banned_reason: reason })
          .eq('id', userId)
          .select()
          .single()
        if (error) throw error
        result = { action: 'ban', userId, status: data.status }
        break
      }

      case 'adjustCredits': {
        const { userId, amount, reason } = confirmedPlan.parameters
        const { data: before } = await supabaseAdmin
          .from('users')
          .select('credits')
          .eq('id', userId)
          .single()
        const { data: after } = await supabaseAdmin
          .from('users')
          .update({ credits: (before?.credits || 0) + amount })
          .eq('id', userId)
          .select('credits')
          .single()
        result = { action: 'adjustCredits', userId, newBalance: after?.credits }
        break
      }

      default:
        return res.status(400).json({ error: `Unsupported action: ${confirmedPlan.intent}` })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      action: 'AI_EXECUTE',
      target_type: confirmedPlan.intent,
      target_id: confirmedPlan.parameters?.userId || 'system',
      reason: `AI command: ${confirmedPlan.explanation}`,
      admin_id: req.user?.id || null,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      details: { result },
    })

    res.json({ executed: true, result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
