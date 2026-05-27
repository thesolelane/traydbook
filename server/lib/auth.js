import { supabaseAdmin, supabaseAnon } from './clients.js'

export const STAFF_ROLES = ['admin', 'admin_2', 'hired_dev', 'moderator']
export const PLATFORM_ROLES = [
  'contractor', 'project_owner', 'agent', 'homeowner', 'investor', 'brokerage',
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
