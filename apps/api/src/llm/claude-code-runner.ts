import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'

import { Injectable, Logger } from '@nestjs/common'

import type { LlmRunner } from './llm-runner.port'

// The claude --output-format json envelope (only the fields we read).
interface ClaudeEnvelope {
  is_error?: boolean
  subtype?: string
  result?: string
}

// Runs the analysis prompt through the local Claude Code CLI in headless mode
// (`claude -p --output-format json`), feeding the prompt on stdin. Uses the Max
// subscription, no API key. The prompt is self-contained, so no tools are needed
// (agentic retrieval comes later); we run from a temp cwd so the CLI never reads
// this repo's files or config.
@Injectable()
export class ClaudeCodeRunner implements LlmRunner {
  private readonly logger = new Logger(ClaudeCodeRunner.name)
  private readonly bin = process.env.CLAUDE_BIN ?? 'claude'
  private readonly model = process.env.CLAUDE_MODEL // optional; CLI default if unset
  private readonly timeoutMs = Number(process.env.CLAUDE_TIMEOUT_MS ?? 180_000)

  async run(prompt: string): Promise<string> {
    const args = ['-p', '--output-format', 'json']
    if (this.model) args.push('--model', this.model)

    const stdout = await this.exec(args, prompt)
    let envelope: ClaudeEnvelope
    try {
      envelope = JSON.parse(stdout) as ClaudeEnvelope
    } catch {
      throw new Error('claude returned non-JSON envelope')
    }
    if (
      envelope.is_error ||
      envelope.subtype !== 'success' ||
      typeof envelope.result !== 'string'
    ) {
      throw new Error(`claude run failed: ${stdout.slice(0, 300)}`)
    }
    return stripCodeFences(envelope.result)
  }

  // Spawn the CLI, write the prompt to stdin, collect stdout. Rejects on a
  // non-zero exit, spawn error, or timeout.
  private exec(args: string[], stdin: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.bin, args, { cwd: tmpdir() })
      let out = ''
      let err = ''
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`claude timed out after ${this.timeoutMs}ms`))
      }, this.timeoutMs)

      child.stdout.on('data', (d: Buffer) => (out += d.toString()))
      child.stderr.on('data', (d: Buffer) => (err += d.toString()))
      child.on('error', (e) => {
        clearTimeout(timer)
        reject(e)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve(out)
        } else {
          this.logger.error(`claude exited ${code}: ${err.slice(0, 300)}`)
          reject(new Error(`claude exited with code ${code}`))
        }
      })

      child.stdin.write(stdin)
      child.stdin.end()
    })
  }
}

// LLMs sometimes wrap JSON in ```json fences despite instructions; strip them.
function stripCodeFences(s: string): string {
  const t = s.trim()
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return m ? m[1].trim() : t
}
