import { describe, it, expect } from 'vitest'
import { parseSendLogParams } from './send-log-query-params.js'

describe('parseSendLogParams — filter separation', () => {
  it('no params → both filter objects are empty', () => {
    const { logFilters, statsFilters, pagination } = parseSendLogParams({})
    expect(logFilters).toEqual({})
    expect(statsFilters).toEqual({})
    expect(pagination).toEqual({ limit: 100, offset: 0 })
  })

  it('delivery_status only goes into logFilters, not statsFilters', () => {
    const { logFilters, statsFilters } = parseSendLogParams({ delivery_status: 'bounced' })
    expect(logFilters.delivery_status).toBe('bounced')
    expect(statsFilters).not.toHaveProperty('delivery_status')
  })

  it('date range goes into BOTH logFilters and statsFilters', () => {
    const params = {
      sent_after: '2026-07-28T00:00:00.000Z',
      sent_before: '2026-08-04T12:00:00.000Z',
    }
    const { logFilters, statsFilters } = parseSendLogParams(params)
    expect(logFilters.sent_after).toBe(params.sent_after)
    expect(logFilters.sent_before).toBe(params.sent_before)
    expect(statsFilters.sent_after).toBe(params.sent_after)
    expect(statsFilters.sent_before).toBe(params.sent_before)
  })

  it('date range + delivery_status: statsFilters still lacks delivery_status', () => {
    // This is the core scenario: Last 7 days + bounced status filter
    const params = {
      sent_after: '2026-07-28T00:00:00.000Z',
      sent_before: '2026-08-04T12:00:00.000Z',
      delivery_status: 'bounced',
    }
    const { logFilters, statsFilters } = parseSendLogParams(params)

    // Log list is scoped to both
    expect(logFilters.delivery_status).toBe('bounced')
    expect(logFilters.sent_after).toBe(params.sent_after)
    expect(logFilters.sent_before).toBe(params.sent_before)

    // Stats bar is scoped to date only, not status
    expect(statsFilters).not.toHaveProperty('delivery_status')
    expect(statsFilters.sent_after).toBe(params.sent_after)
    expect(statsFilters.sent_before).toBe(params.sent_before)
  })

  it('prospect_id and template_id go into both filter objects', () => {
    const params = { prospect_id: 'pid-1', template_id: 'tid-2', delivery_status: 'opened' }
    const { logFilters, statsFilters } = parseSendLogParams(params)
    expect(logFilters.prospect_id).toBe('pid-1')
    expect(statsFilters.prospect_id).toBe('pid-1')
    expect(logFilters.template_id).toBe('tid-2')
    expect(statsFilters.template_id).toBe('tid-2')
  })

  it('pagination defaults to limit=100, offset=0', () => {
    const { pagination } = parseSendLogParams({})
    expect(pagination.limit).toBe(100)
    expect(pagination.offset).toBe(0)
  })

  it('custom pagination is parsed as integers', () => {
    const { pagination } = parseSendLogParams({ limit: '25', offset: '50' })
    expect(pagination.limit).toBe(25)
    expect(pagination.offset).toBe(50)
  })

  // Edge cases

  it('empty sent_after is not included in filters', () => {
    const { logFilters, statsFilters } = parseSendLogParams({ sent_after: '' })
    expect(logFilters).not.toHaveProperty('sent_after')
    expect(statsFilters).not.toHaveProperty('sent_after')
  })

  it('empty delivery_status is not included in logFilters', () => {
    const { logFilters } = parseSendLogParams({ delivery_status: '' })
    expect(logFilters).not.toHaveProperty('delivery_status')
  })

  it('future sent_before is forwarded unchanged (DB returns no rows, not an error)', () => {
    const future = '2099-01-01T00:00:00.000Z'
    const { logFilters, statsFilters } = parseSendLogParams({ sent_before: future })
    expect(logFilters.sent_before).toBe(future)
    expect(statsFilters.sent_before).toBe(future)
  })

  it('reversed range (after > before) is forwarded unchanged — callers guard against this', () => {
    // The API layer doesn't validate range order; the UI (buildCustomRange) raises a warning.
    const params = {
      sent_after: '2026-08-04T00:00:00.000Z',
      sent_before: '2026-07-01T00:00:00.000Z',
    }
    const { logFilters, statsFilters } = parseSendLogParams(params)
    expect(logFilters.sent_after).toBe(params.sent_after)
    expect(statsFilters.sent_before).toBe(params.sent_before)
  })
})
