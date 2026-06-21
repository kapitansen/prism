import { describe, expect, it } from 'vitest'

import { mentioned } from './entity-match'

describe('mentioned', () => {
  it('matches an exact name', () => {
    expect(mentioned('сегодня видел Настя', ['Настя'])).toBe(true)
  })

  it('matches an inflected form (Настя → Настей/Насте)', () => {
    expect(mentioned('погулял с Настей', ['Настя'])).toBe(true)
    expect(mentioned('рассказал Насте новость', ['Настя'])).toBe(true)
  })

  it('matches via an alias', () => {
    expect(mentioned('встретил Сашу', ['Александра', 'Саша'])).toBe(true)
  })

  it('does not match an unrelated common word sharing the stem', () => {
    // "Настя" (stem "наст") must not trigger on "настроение".
    expect(mentioned('настроение хорошее', ['Настя'])).toBe(false)
  })

  it('does not match a stem in the middle of another word', () => {
    // "Лев" (stem "лев") must not trigger on "налево".
    expect(mentioned('повернул налево', ['Лев'])).toBe(false)
  })

  it('ignores names shorter than 3 chars', () => {
    expect(mentioned('Ян пришёл', ['Ян'])).toBe(false)
  })

  it('returns false when nobody is mentioned', () => {
    expect(mentioned('обычный спокойный день', ['Настя', 'Маша'])).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(mentioned('ВИДЕЛ НАСТЮ', ['настя'])).toBe(true)
  })
})
