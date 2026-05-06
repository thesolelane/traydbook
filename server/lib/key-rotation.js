import { createHmac, randomUUID } from 'crypto'

const KEY_VALIDITY_MS = 10 * 60 * 1000
const OVERLAP_MS = 30 * 1000

class KeyManager {
  constructor() {
    this.state = null
    this.initialized = false
    this.rotationInterval = null
  }

  async initialize() {
    if (this.initialized) return
    await this.rotateKey()
    this.rotationInterval = setInterval(() => this.rotateKey(), KEY_VALIDITY_MS)
    this.initialized = true
    console.log('[admin] 🔑 Key rotation initialized')
  }

  async rotateKey() {
    const rotationId = randomUUID()
    const newKey = this._generateKey(rotationId)
    const oldState = this.state

    this.state = {
      current: newKey,
      previous: oldState?.current || null,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + KEY_VALIDITY_MS),
      rotationId,
    }

    if (oldState?.current) {
      setTimeout(() => this._burnKey(oldState.current), OVERLAP_MS)
    }

    console.log(`[admin] 🔑 Key rotated: ${rotationId.slice(0, 8)}...`)
    return this.state
  }

  _generateKey(rotationId) {
    const masterSecret = process.env.KEY_MASTER_SECRET
    if (!masterSecret) throw new Error('KEY_MASTER_SECRET not set')
    const hmac = createHmac('sha256', masterSecret)
    hmac.update(rotationId)
    hmac.update(Date.now().toString())
    return 'trayd_' + hmac.digest('base64url').slice(0, 64)
  }

  _burnKey(oldKey) {
    console.log(`[admin] 🔥 Key burned`)
  }

  getCurrentKey() {
    if (!this.state || Date.now() > this.state.expiresAt.getTime()) {
      throw new Error('KEY_EXPIRED')
    }
    return this.state.current
  }

  getState() {
    if (!this.state) throw new Error('Key manager not initialized')
    return this.state
  }

  isInitialized() {
    return this.initialized
  }

  destroy() {
    if (this.rotationInterval) clearInterval(this.rotationInterval)
    this.state = null
    this.initialized = false
  }
}

export const keyManager = new KeyManager()
