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

// Optional per-call context. `mcp` lets the runner expose an MCP server to the
// model so it can pull data (e.g. entity profiles) mid-run, scoped by the token.
export interface LlmRunOptions {
  mcp?: { url: string; token: string; tools: string[] }
}

export interface LlmRunner {
  run(prompt: string, opts?: LlmRunOptions): Promise<LlmResult>
}

// DI token — interfaces don't exist at runtime, so Nest injects by this symbol.
export const LLM_RUNNER = Symbol('LLM_RUNNER')
