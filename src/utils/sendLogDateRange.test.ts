import { describe, it, expect } from 'vitest'
import { dateRangeFromPreset, buildCustomRange } from './sendLogDateRange'

// Fixed reference point so tests are deterministic
const NOW = new Date('2026-08-04T12:00:00.000Z')

describe('dateRangeFromPreset', () => {
  it('returns null for empty preset (all-time)', () => {
    expect(dateRangeFromPreset('', NOW)).toBeNull()
  })

  it('returns null for "custom" preset', () => {
    expect(dateRangeFromPreset('custom', NOW)).toBeNull()
  })

  it('returns null for an unrecognised preset', () => {
    expect(dateRangeFromPreset('999d', NOW)).toBeNull()
  })

  it('7d: sentBefore equals now and sentAfter is 7 days earlier', () => {
    const result = dateRangeFromPreset('7d', NOW)
    expect(result).not.toBeNull()
    expect(new Date(result!.sentBefore).toISOString()).toBe(NOW.toISOString())
    const daysDiff =
      (new Date(result!.sentBefore).getTime() - new Date(result!.sentAfter).getTime()) /
      (1000 * 60 * 60 * 24)
    expect(daysDiff).toBeCloseTo(7, 5)
  })

  it('30d: span is 30 days', () => {
    const result = dateRangeFromPreset('30d', NOW)
    expect(result).not.toBeNull()
    const daysDiff =
      (new Date(result!.sentBefore).getTime() - new Date(result!.sentAfter).getTime()) /
      (1000 * 60 * 60 * 24)
    expect(daysDiff).toBeCloseTo(30, 5)
  })

  it('90d: span is 90 days', () => {
    const result = dateRangeFromPreset('90d', NOW)
    expect(result).not.toBeNull()
    const daysDiff =
      (new Date(result!.sentBefore).getTime() - new Date(result!.sentAfter).getTime()) /
      (1000 * 60 * 60 * 24)
    expect(daysDiff).toBeCloseTo(90, 5)
  })

  it('sentBefore is never in the future relative to now', () => {
    const result = dateRangeFromPreset('7d', NOW)
    expect(new Date(result!.sentBefore).getTime()).toBeLessThanOrEqual(Date.now() + 5000)
  })
})

describe('buildCustomRange', () => {
  it('returns null when both inputs are empty', () => {
    expect(buildCustomRange('', '')).toBeNull()
  })

  it('open-ended start: only "from" provided', () => {
    const result = buildCustomRange('2026-07-01', '')
    expect(result).not.toBeNull()
    expect(result!.range.sentAfter).toBe(new Date('2026-07-01').toISOString())
    expect(result!.range.sentBefore).toBe('')
    expect(result!.reversed).toBe(false)
  })

  it('open-ended end: only "to" provided', () => {
    const result = buildCustomRange('', '2026-07-31')
    expect(result).not.toBeNull()
    expect(result!.range.sentAfter).toBe('')
    expect(result!.range.sentBefore).toBe(new Date('2026-07-31T23:59:59').toISOString())
    expect(result!.reversed).toBe(false)
  })

  it('valid range: from before to', () => {
    const result = buildCustomRange('2026-07-01', '2026-07-31')
    expect(result).not.toBeNull()
    expect(result!.reversed).toBe(false)
    expect(new Date(result!.range.sentAfter) < new Date(result!.range.sentBefore)).toBe(true)
  })

  it('reversed range: from after to → reversed flag is true', () => {
    const result = buildCustomRange('2026-07-31', '2026-07-01')
    expect(result).not.toBeNull()
    expect(result!.reversed).toBe(true)
  })

  it('same day: from equals to → not reversed (includes the whole day)', () => {
    const result = buildCustomRange('2026-07-15', '2026-07-15')
    expect(result).not.toBeNull()
    // sentBefore is end-of-day, so still >= sentAfter
    expect(result!.reversed).toBe(false)
  })

  it('"to" date is extended to end-of-day (T23:59:59)', () => {
    const result = buildCustomRange('2026-07-01', '2026-07-31')
    expect(result!.range.sentBefore).toBe(new Date('2026-07-31T23:59:59').toISOString())
  })

  it('future "to" date is accepted (API will just return no rows past the last send)', () => {
    const result = buildCustomRange('2026-07-01', '2030-01-01')
    expect(result).not.toBeNull()
    expect(result!.reversed).toBe(false)
  })
})
