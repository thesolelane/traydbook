import { useState, useRef } from 'react'
import { Send, Terminal, CheckCircle, AlertTriangle, Loader } from 'lucide-react'
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

export default function AiCommandSection({ authHeaders }: SectionProps) {
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<CommandResult | null>(null)
  const [executed, setExecuted] = useState<any>(null)
  const [err, setErr] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const EXAMPLES = [
    'Search for users named John',
    'Show me the last 10 security events',
    'Adjust credits for user abc-123 by +50',
    'Show pending moderation queue',
  ]

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

  const confidence = result?.confidence || 0
  const confColor = confidence >= 0.8 ? '#52c97a' : confidence >= 0.5 ? '#e0b852' : '#e05252'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Terminal size={16} color="var(--color-brand)" />
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Natural language admin commands — powered by BOB (Ollama) or OpenAI
        </span>
      </div>

      {/* Example pills */}
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

      {/* Input */}
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

      {/* Result */}
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

          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{result.explanation}</div>

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
            style={{ margin: 0, fontSize: 11, color: 'var(--color-text)', fontFamily: 'monospace' }}
          >
            {JSON.stringify(executed, null, 2)}
          </pre>
        </div>
      )}

      {/* History */}
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
  )
}
