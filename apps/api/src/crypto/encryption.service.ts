import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const ALGORITHM = 'aes-256-gcm'
const KEY_VERSION = 'v1' // bumped on key rotation; lets us decrypt old blobs
const IV_LENGTH = 12 // bytes — recommended nonce size for GCM

// The single crypto choke point. Other modules call encrypt/decrypt and never
// touch keys or algorithms. The key lives only in env, never in DB/backups.
@Injectable()
export class EncryptionService {
  private readonly key: Buffer

  constructor(config: ConfigService) {
    this.key = Buffer.from(config.getOrThrow<string>('ENCRYPTION_KEY'), 'hex')
    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
    }
  }

  // Output: "v1:<iv>:<authTag>:<ciphertext>" (each part base64). A fresh random
  // IV per call means the same plaintext encrypts to different blobs.
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])
    const authTag = cipher.getAuthTag()
    return [
      KEY_VERSION,
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':')
  }

  decrypt(blob: string): string {
    const parts = blob.split(':')
    if (parts.length !== 4) {
      throw new Error('Malformed ciphertext: expected v1:iv:tag:data')
    }
    const [version, ivB64, tagB64, dataB64] = parts
    if (version !== KEY_VERSION) {
      throw new Error(`Unsupported key version: ${version}`)
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivB64, 'base64'),
    )
    // The auth tag proves the ciphertext wasn't tampered with — final() throws
    // if it doesn't match.
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ])
    return plaintext.toString('utf8')
  }
}
