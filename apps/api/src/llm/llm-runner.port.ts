// Usage/timing metadata a runner may report (for logging/debugging).
export interface LlmUsage {
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  durationMs?: number
}

// One LLM call: text out (expected to be JSON per the extraction contract — the
// caller validates it), plus optional usage. Adapters: FakeRunner (now),
// ClaudeCodeRunner / ApiRunner (later). Swapping the engine never touches the
// pipeline.
export interface LlmResult {
  text: string
  usage?: LlmUsage
}

export interface LlmRunner {
  run(prompt: string): Promise<LlmResult>
}

// DI token — interfaces don't exist at runtime, so Nest injects by this symbol.
export const LLM_RUNNER = Symbol('LLM_RUNNER')
