import { describe, expect, it } from 'vitest'

import { slugifyHandle, uniqueHandle } from './handle'

describe('slugifyHandle', () => {
  it('keeps hyphens and underscores (regression: dash was being stripped)', () => {
    expect(slugifyHandle('serg-a')).toBe('serg-a')
    expect(slugifyHandle('john_doe')).toBe('john_doe')
  })

  it('lowercases and transliterates Cyrillic', () => {
    expect(slugifyHandle('Иван')).toBe('ivan')
    expect(slugifyHandle('Аня')).toBe('anya')
  })

  it('drops spaces and other punctuation', () => {
    expect(slugifyHandle('Big Project!')).toBe('bigproject')
  })

  it('trims leading/trailing separators', () => {
    expect(slugifyHandle('-x-')).toBe('x')
    expect(slugifyHandle('__name__')).toBe('name')
  })

  it('caps length at 24', () => {
    expect(slugifyHandle('a'.repeat(50))).toHaveLength(24)
  })

  it('falls back to "entity" when nothing usable remains', () => {
    expect(slugifyHandle('!!!')).toBe('entity')
  })
})

describe('uniqueHandle', () => {
  it('returns the base when free', () => {
    expect(uniqueHandle('alex', new Set())).toBe('alex')
  })

  it('appends a numeric suffix on collision', () => {
    expect(uniqueHandle('alex', new Set(['alex']))).toBe('alex2')
    expect(uniqueHandle('alex', new Set(['alex', 'alex2']))).toBe('alex3')
  })
})
