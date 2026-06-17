export interface RealtimeEvent {
  table: string
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  record: Record<string, unknown> | null
  old_record: Record<string, unknown> | null
}

type Handler = (event: RealtimeEvent) => void

class AdminWebSocket {
  private ws: WebSocket | null = null
  private handlers = new Set<Handler>()
  private token: string | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false

  connect(token: string) {
    this.token = token
    this.intentionalClose = false
    this._open()
  }

  private _open() {
    if (!this.token) return
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/ws?token=${encodeURIComponent(this.token)}`

    const ws = new WebSocket(url)

    ws.onopen = () => {
      console.log('[adminWs] connected')
    }

    ws.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as RealtimeEvent
        this.handlers.forEach(h => h(event))
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      this.ws = null
      if (!this.intentionalClose) {
        this.reconnectTimer = setTimeout(() => this._open(), 4000)
      }
    }

    ws.onerror = () => {
      ws.close()
    }

    this.ws = ws
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  disconnect() {
    this.intentionalClose = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }
}

export const adminWs = new AdminWebSocket()
