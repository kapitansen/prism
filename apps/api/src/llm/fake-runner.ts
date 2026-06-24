import { Injectable } from '@nestjs/common'
import type { ParseResponse } from '@prism/shared'

import { LlmResult, LlmRunner } from './llm-runner.port'

// Deterministic stand-in for a real LLM: lets us build and test the whole
// pipeline without cost/flakiness. Tests enqueue canned responses; otherwise it
// returns a trivial "complete" parse.
@Injectable()
export class FakeRunner implements LlmRunner {
  private readonly queue: ParseResponse[] = []

  enqueue(...responses: ParseResponse[]) {
    this.queue.push(...responses)
  }

  // opts (e.g. MCP) are ignored — the fake has no real model to use tools.
  run(_prompt: string): Promise<LlmResult> {
    const next = this.queue.shift() ?? this.defaultComplete()
    return Promise.resolve({ text: JSON.stringify(next) })
  }

  private defaultComplete(): ParseResponse {
    return {
      status: 'complete',
      summary: 'Day analysis (FakeRunner stub).',
      metrics: [],
      entities: [],
      intents: [],
      cbtFlags: [],
    }
  }
}
