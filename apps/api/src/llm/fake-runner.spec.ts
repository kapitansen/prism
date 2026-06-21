import { parseResponseSchema } from '@prism/shared'
import { describe, expect, it } from 'vitest'

import { FakeRunner } from './fake-runner'

describe('FakeRunner', () => {
  it('default output is a valid "complete" ParseResponse', async () => {
    const raw = await new FakeRunner().run('any prompt')
    const parsed = parseResponseSchema.safeParse(JSON.parse(raw))
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.status).toBe('complete')
  })

  it('returns enqueued responses in order', async () => {
    const runner = new FakeRunner()
    runner.enqueue({
      status: 'needs_clarification',
      clarifyQuestions: [{ question: 'как спал?' }],
    })
    const parsed = parseResponseSchema.parse(JSON.parse(await runner.run('p')))
    expect(parsed.status).toBe('needs_clarification')
    // queue drained → back to default complete
    const next = parseResponseSchema.parse(JSON.parse(await runner.run('p')))
    expect(next.status).toBe('complete')
  })
})
