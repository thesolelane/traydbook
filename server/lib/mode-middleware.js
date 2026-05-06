import { isSafeMode, quarantineRequest } from './safe-mode.js'

export function modeAwareMiddleware(req, res, next) {
  if (req.path === '/healthz' || req.path === '/api/admin-health') {
    return next()
  }

  if (isSafeMode()) {
    if (req.method === 'GET' && req.path.startsWith('/api/admin/monitor')) {
      return next()
    }
    const id = quarantineRequest(req, 'SAFE_MODE_ACTIVE')
    return res.status(503).json({
      error: 'SAFE_MODE_ACTIVE',
      message: 'Admin panel in safe mode — request quarantined for security review',
      quarantineId: id,
      adminContact: 'security@traydbook.com',
    })
  }

  next()
}
