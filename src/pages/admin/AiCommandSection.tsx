import { useState, useRef, useEffect } from 'react'
import { Send, Terminal, CheckCircle, AlertTriangle, Loader, Bot, BookOpen } from 'lucide-react'
import { SectionProps } from './shared'

interface CommandPlan {
  intent: string
  parameters: Record<string, any>
  requiresConfirmation: boolean
  explanation: string
  confidence: number
}

interface CommandResult {
  understood: boolean
  confidence: number
  plan: CommandPlan
  preview: any[] | null
  requiresConfirmation: boolean
  explanation: string
  confirmationToken: string
  provider: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatSource {
  id: string
  title: string
  content?: string
}

type Tab = 'command' | 'chat'

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  padding: '8px 18px',
  border: 'none',
  borderBottom: active ? '2px solid var(--color-brand)' : '2px solid transparent',
  background: 'none',
  color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
  fontWeight: active ? 700 : 500,
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'color 0.15s',
})

export default function AiCommandSection({ authHeaders }: SectionProps) {
  const [tab, setTab] = useState<Tab>('command')

  // ── Command tab state ─────────────────────────────────────────────────────
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<CommandResult | null>(null)
  const [executed, setExecuted] = useState<any>(null)
  const [err, setErr] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Ask Bob tab state ─────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatErr, setChatErr] = useState('')
  const [lastSources, setLastSources] = useState<ChatSource[]>([])
  const [lastMeta, setLastMeta] = useState<{ provider?: string; model?: string } | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const EXAMPLES = [
    'Search for users named John',
    'Show me the last 10 security events',
    'Adjust credits for user abc-123 by +50',
    'Show pending moderation queue',
  ]

  // ── Command tab logic ─────────────────────────────────────────────────────
  async function runCommand() {
    if (!command.trim() || command.length < 3) return
    setLoading(true)
    setErr('')
    setResult(null)
    setExecuted(null)
    try {
      const res = await fetch('/api/admin/ai/command', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed')
      setResult(data)
      setHistory(h => [command, ...h.slice(0, 9)])
      setCommand('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function executeConfirmed() {
    if (!result) return
    setExecuting(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/ai/execute', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationToken: result.confirmationToken,
          confirmedPlan: result.plan,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Execution failed')
      setExecuted(data.result)
      setResult(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Execution failed')
    } finally {
      setExecuting(false)
    }
  }

  // ── Ask Bob logic ─────────────────────────────────────────────────────────
  async function sendChat() {
    const text = chatInput.trim()
    if (!text || chatLoading) return

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setChatInput('')
    setChatLoading(true)
    setChatErr('')
    setLastSources([])
    setLastMeta(null)

    try {
      const res = await fetch('/api/admin/bob/chat', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      setMessages(m => [...m, { role: 'assistant', content: data.reply ?? '(no reply)' }])
      setLastSources(data.sources ?? [])
      setLastMeta({ provider: data.provider, model: data.model })
    } catch (e) {
      setChatErr(e instanceof Error ? e.message : 'Failed to reach Bob')
      setMessages(m => m.slice(0, -1))
      setChatInput(text)
    } finally {
      setChatLoading(false)
    }
  }

  const confidence = result?.confidence || 0
  const confColor = confidence >= 0.8 ? '#52c97a' : confidence >= 0.5 ? '#e0b852' : '#e05252'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Tab bar */}
      <div
        style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 20 }}
      >
        <button style={TAB_STYLE(tab === 'command')} onClick={() => setTab('command')}>
          <Terminal size={14} /> AI Command
        </button>
        <button style={TAB_STYLE(tab === 'chat')} onClick={() => setTab('chat')}>
          <Bot size={14} /> Ask Bob
        </button>
      </div>

      {/* ── COMMAND TAB ─────────────────────────────────────────────────── */}
      {tab === 'command' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Terminal size={16} color="var(--color-brand)" />
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Natural language admin commands — powered by BOB (Ollama) or OpenAI
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => {
                  setCommand(ex)
                  inputRef.current?.focus()
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                {ex}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void runCommand()
                }
              }}
              rows={2}
              placeholder="Type a command... (Enter to send)"
              style={{
                flex: 1,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                color: 'var(--color-text)',
                padding: '10px 14px',
                fontSize: 13,
                resize: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            />
            <button
              onClick={() => void runCommand()}
              disabled={loading || command.length < 3}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-brand)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading || command.length < 3 ? 0.6 : 1,
              }}
            >
              {loading ? <Loader size={14} /> : <Send size={14} />}
              {loading ? 'Thinking...' : 'Run'}
            </button>
          </div>

          {err && (
            <div
              style={{
                padding: 12,
                background: '#2a1515',
                border: '1px solid #e05252',
                borderRadius: 8,
                color: '#e05252',
                fontSize: 13,
              }}
            >
              {err}
            </div>
          )}

          {result && (
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                  {result.plan?.intent}
                </span>
                <span style={{ fontSize: 11, color: confColor, fontWeight: 700 }}>
                  {Math.round(confidence * 100)}% confident
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    background: 'var(--color-bg)',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  via {result.provider}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {result.explanation}
              </div>
              {result.plan?.parameters && Object.keys(result.plan.parameters).length > 0 && (
                <div style={{ background: 'var(--color-bg)', borderRadius: 6, padding: 10 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-muted)',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Parameters
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: 'var(--color-text)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {JSON.stringify(result.plan.parameters, null, 2)}
                  </pre>
                </div>
              )}
              {result.preview && result.preview.length > 0 && (
                <div style={{ background: 'var(--color-bg)', borderRadius: 6, padding: 10 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-muted)',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Preview ({result.preview.length})
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: 'var(--color-text)',
                      fontFamily: 'monospace',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {JSON.stringify(result.preview, null, 2)}
                  </pre>
                </div>
              )}
              {result.requiresConfirmation ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <AlertTriangle size={14} color="#e0b852" />
                  <span style={{ fontSize: 12, color: '#e0b852', flex: 1 }}>
                    This action requires confirmation before executing
                  </span>
                  <button
                    onClick={() => setResult(null)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 6,
                      border: '1px solid var(--color-border)',
                      background: 'none',
                      color: 'var(--color-text-muted)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeConfirmed}
                    disabled={executing}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'var(--color-brand)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {executing ? <Loader size={12} /> : <CheckCircle size={12} />}
                    {executing ? 'Executing...' : 'Confirm & Execute'}
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#52c97a' }}>
                  ✓ Read-only — no confirmation needed
                </div>
              )}
            </div>
          )}

          {executed && (
            <div
              style={{
                padding: 14,
                background: '#1a3a25',
                border: '1px solid #52c97a',
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#52c97a', marginBottom: 8 }}>
                ✓ Executed
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: 'var(--color-text)',
                  fontFamily: 'monospace',
                }}
              >
                {JSON.stringify(executed, null, 2)}
              </pre>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Recent Commands
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setCommand(h)}
                    style={{
                      textAlign: 'left',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ASK BOB TAB ─────────────────────────────────────────────────── */}
      {tab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={16} color="var(--color-brand)" />
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Plain-text chat with Bob — construction knowledge, code questions, anything
            </span>
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([])
                  setLastSources([])
                  setLastMeta(null)
                  setChatErr('')
                }}
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  background: 'none',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#666',
                  padding: '3px 8px',
                  cursor: 'pointer',
                }}
              >
                Clear chat
              </button>
            )}
          </div>

          {/* Message thread */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 120,
              maxHeight: 520,
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {messages.length === 0 && !chatLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#555', fontSize: 13 }}>
                <Bot
                  size={28}
                  style={{ marginBottom: 8, opacity: 0.3, display: 'block', margin: '0 auto 10px' }}
                />
                Ask Bob anything — construction code, TraydBook context, general questions
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: m.role === 'user' ? 'var(--color-brand)' : '#333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {m.role === 'user' ? 'You' : <Bot size={14} />}
                </div>
                <div
                  style={{
                    maxWidth: '78%',
                    background: m.role === 'user' ? 'rgba(232,93,4,0.12)' : 'var(--color-surface)',
                    border: `1px solid ${m.role === 'user' ? 'rgba(232,93,4,0.25)' : 'var(--color-border)'}`,
                    borderRadius: m.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    padding: '10px 14px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: 'var(--color-text)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Bot size={14} color="#fff" />
                </div>
                <div
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px 12px 12px 12px',
                    padding: '10px 14px',
                  }}
                >
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#555',
                          display: 'inline-block',
                          animation: `pulse 1.2s ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Sources */}
          {lastSources.length > 0 && (
            <div
              style={{
                background: '#0d0d0d',
                border: '1px solid #222',
                borderRadius: 8,
                padding: '10px 14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 8,
                  fontSize: 11,
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                <BookOpen size={12} /> Sources used
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {lastSources.map((s, i) => (
                  <div key={s.id ?? i} style={{ fontSize: 12, color: '#888' }}>
                    <span style={{ color: '#555', marginRight: 6 }}>[{i + 1}]</span>
                    {s.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          {lastMeta && (
            <div style={{ fontSize: 11, color: '#444', textAlign: 'right' }}>
              {lastMeta.model && <span style={{ marginRight: 8 }}>{lastMeta.model}</span>}
              {lastMeta.provider && <span>via {lastMeta.provider}</span>}
            </div>
          )}

          {chatErr && (
            <div
              style={{
                padding: '10px 14px',
                background: '#2a1515',
                border: '1px solid #e05252',
                borderRadius: 8,
                color: '#e05252',
                fontSize: 13,
              }}
            >
              {chatErr}
            </div>
          )}

          {/* Input */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendChat()
                }
              }}
              rows={2}
              placeholder="Ask Bob anything… (Enter to send, Shift+Enter for new line)"
              disabled={chatLoading}
              style={{
                flex: 1,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                color: 'var(--color-text)',
                padding: '10px 14px',
                fontSize: 13,
                resize: 'none',
                fontFamily: 'var(--font-sans)',
                opacity: chatLoading ? 0.6 : 1,
              }}
            />
            <button
              onClick={() => void sendChat()}
              disabled={chatLoading || !chatInput.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-brand)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                opacity: chatLoading || !chatInput.trim() ? 0.6 : 1,
              }}
            >
              {chatLoading ? <Loader size={14} /> : <Send size={14} />}
              {chatLoading ? 'Thinking…' : 'Send'}
            </button>
          </div>

          <div style={{ fontSize: 11, color: '#444' }}>
            Rate limited to 30 messages/minute. Full conversation history is sent on each turn.
          </div>
        </div>
      )}
    </div>
  )
}
