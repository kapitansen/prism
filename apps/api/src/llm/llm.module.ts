import { Global, Module } from '@nestjs/common'

import { FakeRunner } from './fake-runner'
import { LLM_RUNNER } from './llm-runner.port'

// Global so any module can inject the LLM_RUNNER token. For now it resolves to
// the FakeRunner singleton (also exported by class so tests can enqueue on it).
@Global()
@Module({
  providers: [FakeRunner, { provide: LLM_RUNNER, useExisting: FakeRunner }],
  exports: [LLM_RUNNER, FakeRunner],
})
export class LlmModule {}
