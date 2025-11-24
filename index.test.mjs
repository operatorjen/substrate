import test from 'node:test'
import assert from 'node:assert/strict'
import { Substrate } from './index.mjs'

function banner(msg) {
  const line = '='.repeat(msg.length)
  console.log(`\n${msg}\n${line}`)
}

test('SUBSTRATE: deterministic closed-loop test', async () => {
  banner('SUBSTRATE INTEGRATION TEST')
  const s = new Substrate({
    seed: 42,
    driftPerTick: 0,
    noiseLevel: 0,
    maxHistory: 4,
    fieldInit: 0
  })
  const p0 = s.perceive('a0')
  console.log('substrate: initial state', {
    agent: 'a0',
    t: p0.t,
    field: p0.field,
    lastSignal: p0.lastSignal,
    historyLength: p0.history.length
  })
  assert.equal(p0.t, 0)
  assert.equal(p0.field, 0)
  assert.equal(p0.lastSignal, null)
  assert.deepEqual(p0.history, [])

  const aSmall = { type: 'nudge', amount: 0.5 }
  s.apply(aSmall, 'a0')
  s.tick()
  const p1 = s.perceive('a0')
  const gSmall = s.measureLoopGain(p0, aSmall, p1)
  console.log('substrate: small nudge from a0', {
    action: aSmall,
    t: p1.t,
    field: p1.field,
    historyTail: p1.history.slice(-1),
    loopGain: gSmall
  })
  assert.equal(p1.t, 1)
  assert.equal(p1.field, 0.5)
  assert.deepEqual(p1.history.slice(-1), [{ nudge: 0.5 }])
  assert.ok(gSmall > 0, 'loop gain should be positive for effectful action')

  const p1_pre = s.perceive('a0')
  const aBig = { type: 'nudge', amount: 2.0 }
  s.apply(aBig, 'a0')
  s.tick()
  const p2 = s.perceive('a0')
  const gBig = s.measureLoopGain(p1_pre, aBig, p2)
  console.log('substrate: larger nudge from a0', {
    action: aBig,
    t: p2.t,
    field: p2.field,
    historyLength: p2.history.length,
    loopGainSmall: gSmall,
    loopGainBig: gBig
  })
  assert.equal(p2.t, 2)
  assert.equal(p2.field, 2.5)
  assert.equal(p2.history.length, 2)
  assert.ok(gBig > gSmall, 'bigger effect should yield higher loop gain')

  const p2_pre = s.perceive('a1')
  const aEmit = { type: 'emit', signal: 3 }
  s.apply(aEmit, 'a1')
  s.tick()
  const p3 = s.perceive('a1')
  const gEmit = s.measureLoopGain(p2_pre, aEmit, p3)
  console.log('substrate: emit signal from a1', {
    action: aEmit,
    t: p3.t,
    field: p3.field,
    lastSignal: p3.lastSignal,
    lastSignalFrom: p3.lastSignalFrom,
    loopGainEmit: gEmit
  })
  assert.equal(p3.field, 5.5)
  assert.equal(p3.lastSignal, 3)
  assert.equal(p3.lastSignalFrom, 'a1')
  assert.ok(gEmit > 0)

  s.apply({ type: 'emit', signal: 1 }, 'a0'); s.tick()
  s.apply({ type: 'emit', signal: 1 }, 'a0'); s.tick()
  s.apply({ type: 'emit', signal: 1 }, 'a0'); s.tick()
  const pN = s.perceive('a0')
  console.log('substrate: history window after repeated emits', {
    agent: 'a0',
    t: pN.t,
    field: pN.field,
    historyLength: pN.history.length,
    history: pN.history
  })
  assert.ok(pN.history.length <= 4, 'history should be capped by maxHistory')
})

test('SUBSTRATE: loopGain is ~0 for no-op actions', () => {
  banner('SUBSTRATE NOOP CONTROL TEST')
  const s = new Substrate({ driftPerTick: 0, noiseLevel: 0 })
  const p0 = s.perceive('a0')
  console.log('substrate noop: state before noop', {
    agent: 'a0',
    t: p0.t,
    field: p0.field
  })
  const noop = { type: 'noop' }
  s.apply(noop, 'a0')
  s.tick()
  const p1 = s.perceive('a0')
  const g = s.measureLoopGain(p0, noop, p1)
  console.log('substrate noop: state after noop', {
    agent: 'a0',
    t: p1.t,
    field: p1.field,
    loopGain: g
  })
  assert.equal(g, 0)
})
