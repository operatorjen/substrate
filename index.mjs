const DEFAULT_CONFIG = {
  seed: 1,
  driftPerTick: 0,
  noiseLevel: 0,
  maxHistory: 16,
  fieldInit: 0,
  signalToDelta: null
}

const EPS = 1e-9

function mulberry32(seed) {
  let a = seed >>> 0
  return function rand() {
    a |= 0
    a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x }

function actionMagnitude(action) {
  if (!action || typeof action !== 'object') return 1
  if (typeof action.amount === 'number') return Math.abs(action.amount)
  if (typeof action.delta === 'number') return Math.abs(action.delta)
  return 1
}

export class Substrate {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.t = 0
    this.field = this.config.fieldInit
    this.history = []
    this.lastActionByAgent = new Map()
    this._rand = mulberry32(this.config.seed)
  }

  perceive(agentId = null) {
    const last = this.history[this.history.length - 1] || null
    return {
      agentId,
      t: this.t,
      field: this.field,
      lastSignal: last ? last.signal : null,
      lastSignalFrom: last ? last.agentId : null,
      history: this.history.map(h => h.signal)
    }
  }

  apply(action, agentId = null) {
    if (!action || typeof action !== 'object') action = { type: 'noop' }
    const { type } = action
    this.lastActionByAgent.set(agentId, action)
    if (type === 'emit') {
      const signal = action.signal ?? null
      const delta = typeof action.delta === 'number' ? action.delta : typeof this.config.signalToDelta === 'function' ? this.config.signalToDelta(signal) : (typeof signal === 'number' ? signal : 0)
      this.field += delta
      this._pushHistory({ agentId, signal, delta, t: this.t })
      return
    }
    if (type === 'nudge') {
      const amount = typeof action.amount === 'number' ? action.amount : 0
      this.field += amount
      this._pushHistory({ agentId, signal: { nudge: amount }, delta: amount, t: this.t })
      return
    }
    this._pushHistory({ agentId, signal: { noop: true }, delta: 0, t: this.t })
  }

  tick() {
    const drift = this.config.driftPerTick
    const noise = (this._rand() * 2 - 1) * this.config.noiseLevel
    this.field += drift + noise
    this.t += 1
  }

  measureLoopGain(prevPercept, action, nextPercept) {
    if (!prevPercept || !nextPercept) return 0
    const prevField = typeof prevPercept.field === 'number' ? prevPercept.field : 0
    const nextField = typeof nextPercept.field === 'number' ? nextPercept.field : 0
    const rawEffect = Math.abs(nextField - prevField)
    const mag = actionMagnitude(action)
    const ratio = rawEffect / (mag + EPS)
    return clamp01(Math.tanh(ratio))
  }

  reset() {
    this.t = 0
    this.field = this.config.fieldInit
    this.history = []
    this.lastActionByAgent.clear()
    this._rand = mulberry32(this.config.seed)
  }

  _pushHistory(entry) {
    this.history.push(entry)
    if (this.history.length > this.config.maxHistory) this.history.shift()
  }
}

export default Substrate