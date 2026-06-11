import { createHash } from 'crypto'
import { supabaseAdmin, supabaseAnon } from './clients.js'

export const STAFF_ROLES = ['admin', 'admin_2', 'hired_dev', 'moderator']
export const PLATFORM_ROLES = [
  'contractor',
  'project_owner',
  'agent',
  'homeowner',
  'investor',
  'brokerage',
]
export const ALL_INVITE_ROLES = [...STAFF_ROLES, ...PLATFORM_ROLES]

/**
 * Numeric rank used to enforce invite hierarchy.
 * A caller may only invite roles with a strictly lower rank than their own,
 * EXCEPT admin who may also invite other admins.
 */
export const ROLE_RANK = {
  admin: 5,
  admin_2: 4,
  hired_dev: 3,
  moderator: 2,
  contractor: 1,
  project_owner: 1,
  agent: 1,
  homeowner: 1,
  investor: 1,
  brokerage: 1,
}

/**
 * Returns the roles that `callerRole` is permitted to invite.
 */
export function getAllowedInviteRoles(callerRole) {
  if (callerRole === 'admin') return ALL_INVITE_ROLES
  const myRank = ROLE_RANK[callerRole] ?? 0
  return ALL_INVITE_ROLES.filter(r => (ROLE_RANK[r] ?? 0) < myRank)
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data, error } = await supabaseAnon.auth.getUser(token)
  if (error || !data?.user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = data.user
  next()
}

export async function requireSuperAdmin(req, res, next) {
  const { data: u } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', req.user.id)
    .single()
  if (u?.account_type !== 'admin') return res.status(403).json({ error: 'Super admin only' })
  req.adminUser = u
  next()
}

/**
 * Allows any staff member (admin, admin_2, hired_dev, moderator).
 * Attaches req.adminUser with account_type for downstream use.
 */
export async function requireAnyStaff(req, res, next) {
  const { data: u } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', req.user.id)
    .single()
  if (!STAFF_ROLES.includes(u?.account_type))
    return res.status(403).json({ error: 'Staff access required' })
  req.adminUser = u
  next()
}

export async function requireAdminLevel(req, res, next) {
  const { data: u } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', req.user.id)
    .single()
  if (!['admin', 'admin_2'].includes(u?.account_type))
    return res.status(403).json({ error: 'Admin access required' })
  req.adminUser = u
  next()
}

/**
 * Returns true if the given user ID belongs to the protected super admin.
 * Protected email is read from PROTECTED_SUPER_ADMIN_EMAIL env var — never hardcoded.
 */
export async function isProtectedAdmin(userId) {
  const protectedEmail = process.env.PROTECTED_SUPER_ADMIN_EMAIL
  if (!protectedEmail) return false
  const { data } = await supabaseAdmin.from('users').select('email').eq('id', userId).single()
  return data?.email?.toLowerCase() === protectedEmail.toLowerCase()
}

/**
 * Middleware factory — validates X-Service-Key (Bob's machine-to-machine auth).
 * Checks the key hash against service_api_keys and enforces required scopes.
 * Usage: router.get('/route', await requireServiceKey(['outreach:read']), handler)
 */
export async function requireServiceKey(scopes = []) {
  return async (req, res, next) => {
    const raw = (req.headers['x-service-key'] || req.headers['x-api-key'] || '').trim()
    if (!raw) return res.status(401).json({ error: 'Missing X-Service-Key header' })

    const hash = createHash('sha256').update(raw).digest('hex')
    const { data: key, error } = await supabaseAdmin
      .from('service_api_keys')
      .select('id, scopes, revoked_at, expires_at')
      .eq('key_hash', hash)
      .maybeSingle()

    if (error || !key) return res.status(401).json({ error: 'Invalid service key' })
    if (key.revoked_at) return res.status(401).json({ error: 'Service key revoked' })
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Service key expired' })
    }
    for (const scope of scopes) {
      if (!key.scopes.includes(scope) && !key.scopes.includes('*')) {
        return res.status(403).json({ error: `Missing scope: ${scope}` })
      }
    }
    supabaseAdmin
      .from('service_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', key.id)
      .then(() => {})
    req.serviceKey = key
    next()
  }
}

/**
 * Combined middleware — accepts EITHER a valid service key OR a staff JWT.
 * Use for endpoints Bob calls autonomously that admins also access via UI.
 * scopes: required service key scopes (ignored when JWT path is used).
 */
export function requireServiceKeyOrStaff(scopes = []) {
  return async (req, res, next) => {
    const hasServiceKey = !!(req.headers['x-service-key'] || req.headers['x-api-key'])
    if (hasServiceKey) {
      const mw = await requireServiceKey(scopes)
      return mw(req, res, next)
    }
    // Fall through to JWT + staff check
    const authHeader = req.headers.authorization ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const { data, error } = await supabaseAnon.auth.getUser(token)
    if (error || !data?.user) return res.status(401).json({ error: 'Unauthorized' })
    req.user = data.user
    const { data: u } = await supabaseAdmin
      .from('users')
      .select('account_type')
      .eq('id', req.user.id)
      .single()
    if (!STAFF_ROLES.includes(u?.account_type))
      return res.status(403).json({ error: 'Staff access required' })
    req.adminUser = u
    next()
  }
}

/**
 * Middleware — hard-blocks any request that carries a service API key (X-Api-Key).
 * Apply to secrets, vault, and error-log routes so Bob can NEVER reach them,
 * even if a scope bug or misconfiguration occurs elsewhere.
 */
export function blockServiceKeys(req, res, next) {
  if (req.headers['x-api-key']) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Service API keys are not permitted to access this endpoint.',
    })
  }
  next()
}

/**
 * Middleware — rejects any action targeting the protected super admin.
 * Attach AFTER a route already knows req.params.id is the target user.
 */
export async function blockProtectedAdmin(req, res, next) {
  const targetId = req.params.id ?? req.body?.userId ?? req.body?.user_id
  if (!targetId) return next()
  const protected_ = await isProtectedAdmin(targetId)
  if (protected_) {
    console.warn(`[admin] Blocked attempt to modify protected super admin by ${req.user?.id}`)
    return res.status(403).json({
      error: 'PROTECTED_ADMIN',
      message:
        'This account is the protected super admin and cannot be modified through the panel.',
    })
  }
  next()
}
