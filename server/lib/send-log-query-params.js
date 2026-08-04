/**
 * Pure helper — splits the raw send-log query-string params into two sets:
 *
 *   logFilters   — applied to the paginated log list (includes delivery_status)
 *   statsFilters — applied to the aggregate stats query (excludes delivery_status
 *                  so totals reflect all statuses within the date window)
 *
 * Keeping this logic separate from Express / Supabase makes it unit-testable
 * without any network or DB dependencies.
 *
 * @param {object} query - req.query (or equivalent plain object)
 * @returns {{ logFilters: object, statsFilters: object, pagination: object }}
 */
export function parseSendLogParams(query) {
  const {
    prospect_id,
    template_id,
    delivery_status,
    sent_after,
    sent_before,
    limit = '100',
    offset = '0',
  } = query

  // Shared date + identity filters (applied to both queries)
  const shared = {}
  if (prospect_id) shared.prospect_id = prospect_id
  if (template_id) shared.template_id = template_id
  if (sent_after) shared.sent_after = sent_after
  if (sent_before) shared.sent_before = sent_before

  // Log query also filters by status
  const logFilters = { ...shared }
  if (delivery_status) logFilters.delivery_status = delivery_status

  // Stats query intentionally excludes delivery_status
  const statsFilters = { ...shared }

  const pagination = {
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  }

  return { logFilters, statsFilters, pagination }
}
