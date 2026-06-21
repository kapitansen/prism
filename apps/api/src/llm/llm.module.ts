import { Global, Module } from '@nestjs/common'

import { ClaudeCodeRunner } from './claude-code-runner'
import { FakeRunner } from './fake-runner'
import { LLM_RUNNER, type LlmRunner } from './llm-runner.port'

// Global so any module can inject the LLM_RUNNER token. The active engine is
// chosen at runtime: FakeRunner under tests (deterministic, no CLI), otherwise
// ClaudeCodeRunner. Override explicitly with LLM_RUNNER=fake|claude-code.
// FakeRunner is also exported by class so tests can enqueue responses on it.
@Global()
@Module({
  providers: [
    FakeRunner,
    ClaudeCodeRunner,
    {
      provide: LLM_RUNNER,
      useFactory: (fake: FakeRunner, claude: ClaudeCodeRunner): LlmRunner => {
        const kind =
          process.env.LLM_RUNNER ??
          (process.env.NODE_ENV === 'test' ? 'fake' : 'claude-code')
        return kind === 'fake' ? fake : claude
      },
      inject: [FakeRunner, ClaudeCodeRunner],
    },
  ],
  exports: [LLM_RUNNER, FakeRunner],
})
export class LlmModule {}
