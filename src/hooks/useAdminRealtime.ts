import { useEffect, useRef } from 'react'
import { adminWs } from '../lib/adminWs'

/**
 * Calls `callback` whenever a Supabase Realtime change arrives for any of the
 * specified tables.  The callback is debounced by 600ms so that burst inserts
 * (e.g. a CSV import) trigger only one re-fetch instead of thousands.
 *
 * Usage:
 *   useAdminRealtime(['security_events'], load)
 */
export function useAdminRealtime(tables: string[], callback: () => void) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  const tablesKey = tables.join(',')

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = adminWs.subscribe(event => {
      if (!tables.includes(event.table)) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        cbRef.current()
      }, 600)
    })

    return () => {
      unsubscribe()
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey])
}
