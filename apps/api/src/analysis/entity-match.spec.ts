import { describe, expect, it } from 'vitest'

import { mentioned } from './entity-match'

describe('mentioned', () => {
  it('matches an exact name', () => {
    expect(mentioned('saw Alex today', ['Alex'])).toBe(true)
  })

  it('matches a longer related form (Alex → Alexa)', () => {
    expect(mentioned('met Alexa at the gym', ['Alex'])).toBe(true)
  })

  it('matches via an alias', () => {
    expect(mentioned('called Sam in the evening', ['Samuel', 'Sam'])).toBe(true)
  })

  it('does not match a longer unrelated word sharing the stem', () => {
    // "Sam" (stem "sam") must not trigger on "samurai".
    expect(mentioned('booked a samurai class', ['Sam'])).toBe(false)
  })

  it('does not match a stem in the middle of another word', () => {
    // "Ana" (stem "ana") must not trigger on "banana".
    expect(mentioned('ate a banana', ['Ana'])).toBe(false)
  })

  it('ignores names shorter than 3 chars', () => {
    expect(mentioned('Jo arrived', ['Jo'])).toBe(false)
  })

  it('returns false when nobody is mentioned', () => {
    expect(mentioned('an ordinary quiet day', ['Alex', 'Sam'])).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(mentioned('SAW ALEX', ['alex'])).toBe(true)
  })
})
