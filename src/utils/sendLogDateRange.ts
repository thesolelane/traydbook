/**
 * Pure helper — converts a date-preset string into ISO timestamps.
 * Lives here (not inside ProspectsSection.tsx) so it can be unit-tested
 * independently of React.
 */
export interface DateRange {
  sentAfter: string
  sentBefore: string
}

/**
 * Returns the ISO date range for a preset, or null for '' / 'custom'.
 * The "before" bound is the current moment so future dates are never included.
 */
export function dateRangeFromPreset(
  preset: string,
  now: Date = new Date(),
): DateRange | null {
  if (preset === 'custom' || preset === '') return null
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : null
  if (!days) return null
  const after = new Date(now)
  after.setDate(after.getDate() - days)
  return { sentAfter: after.toISOString(), sentBefore: now.toISOString() }
}

/**
 * Builds a DateRange for the "custom" preset given raw date-input values.
 * Returns null when both inputs are empty.
 * Normalises the "to" date to end-of-day so the whole day is included.
 *
 * Edge cases handled:
 *  - Only one side provided — the other is left empty (open-ended range)
 *  - reversed from/to — detected and returned as { reversed: true }
 */
export interface CustomRangeResult {
  range: DateRange
  reversed: boolean
}

export function buildCustomRange(from: string, to: string): CustomRangeResult | null {
  if (!from && !to) return null
  const sentAfter = from ? new Date(from).toISOString() : ''
  const sentBefore = to ? new Date(to + 'T23:59:59').toISOString() : ''

  // Detect a reversed range (from is strictly after to)
  const reversed =
    Boolean(sentAfter) &&
    Boolean(sentBefore) &&
    new Date(sentAfter) > new Date(sentBefore)

  return { range: { sentAfter, sentBefore }, reversed }
}
