import { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'

import { EncryptionService } from './encryption.service'

// 32 bytes (64 hex chars) — a throwaway key for tests, not a secret.
const TEST_KEY = '0123456789abcdef'.repeat(4)

// Build the service directly (no Nest DI): we just feed it a fake config whose
// getOrThrow returns our test key.
function makeService(key: string = TEST_KEY): EncryptionService {
  const config = { getOrThrow: () => key } as unknown as ConfigService
  return new EncryptionService(config)
}

describe('EncryptionService', () => {
  it('decrypts back to the original plaintext', () => {
    const svc = makeService()
    const blob = svc.encrypt('Поругался с Васей')
    expect(svc.decrypt(blob)).toBe('Поругался с Васей')
  })

  it('produces different ciphertext each time (random IV)', () => {
    const svc = makeService()
    expect(svc.encrypt('same text')).not.toBe(svc.encrypt('same text'))
  })

  it('throws when the ciphertext was tampered with', () => {
    const svc = makeService()
    const blob = svc.encrypt('secret')
    const tampered = blob.slice(0, -4) + 'AAAA'
    expect(() => svc.decrypt(tampered)).toThrow()
  })

  it('rejects a key of the wrong length', () => {
    expect(() => makeService('tooshort')).toThrow(/32 bytes/)
  })

  it('throws on a malformed blob', () => {
    const svc = makeService()
    expect(() => svc.decrypt('not-a-valid-blob')).toThrow(/Malformed/)
  })
})
