import { Global, Module } from '@nestjs/common'

import { EncryptionService } from './encryption.service'

// @Global: EncryptionService is injectable everywhere (entries, entities, ...)
// without re-importing — it's a cross-cutting concern.
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class CryptoModule {}
