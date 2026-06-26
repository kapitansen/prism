import { describe, expect, it } from 'vitest'

import { handleMentioned, mentioned } from './entity-match'

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

  it('does not match a longer common word sharing a short name stem', () => {
    // Regression: "Mark" (stem "mar") must not trigger on "marble" — the
    // Russian case was "Маша" wrongly matching "машине" (the car).
    expect(mentioned('a shiny marble', ['Mark'])).toBe(false)
    // ...but a short inflection still matches.
    expect(mentioned('with Marky', ['Mark'])).toBe(true)
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

describe('handleMentioned', () => {
  it('matches an exact @handle reference', () => {
    expect(handleMentioned('texted @mark today', 'mark')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(handleMentioned('saw @MARK', 'mark')).toBe(true)
  })

  it('respects a word boundary (no match inside a longer token)', () => {
    expect(handleMentioned('joined @market_team', 'mark')).toBe(false)
  })

  it('is false when the handle is absent or null', () => {
    expect(handleMentioned('a quiet day', 'mark')).toBe(false)
    expect(handleMentioned('@mark here', null)).toBe(false)
  })
})
