// Port for talking to an LLM. One method: a prompt in, raw text out (expected
// to be JSON per the extraction contract — the caller validates it). Adapters:
// FakeRunner (now), ClaudeCodeRunner / ApiRunner (later). Swapping the engine
// never touches the pipeline.
export interface LlmRunner {
  run(prompt: string): Promise<string>
}

// DI token — interfaces don't exist at runtime, so Nest injects by this symbol.
export const LLM_RUNNER = Symbol('LLM_RUNNER')
