import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { type ParseResponse, parseResponseSchema } from '@prism/shared'

import { EncryptionService } from '../crypto/encryption.service'
import { LLM_RUNNER, type LlmRunner } from '../llm/llm-runner.port'
import { PrismaService } from '../prisma/prisma.service'
import { ParseDayDto } from './dto/parse-day.dto'
import { buildParsePrompt } from './prompt'

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    @Inject(LLM_RUNNER) private readonly llm: LlmRunner,
  ) {}

  // One interactive parse round: build context → ask the LLM → validate against
  // the contract. Returns clarify questions or the complete extraction. Nothing
  // is committed here (the user reviews/edits, then commits separately).
  async parse(
    userId: string,
    id: string,
    dto: ParseDayDto,
  ): Promise<ParseResponse> {
    const entry = await this.prisma.entry.findFirst({ where: { id, userId } })
    if (!entry) {
      throw new NotFoundException('Entry not found')
    }

    const values = await this.prisma.metricValue.findMany({
      where: { userId, occurredOn: entry.occurredOn, source: 'manual' },
    })

    const prompt = buildParsePrompt({
      body: this.encryption.decrypt(entry.bodyEnc),
      chips: values.map((v) => ({
        key: v.metricKey,
        value: v.value.toNumber(),
      })),
      answers: dto.answers ?? [],
    })

    return this.validate(await this.llm.run(prompt))
  }

  // The LLM returns raw text; trust nothing — it must parse as JSON and satisfy
  // the contract, else it's an upstream failure. (Retries land here with the
  // real runner; FakeRunner is always valid.)
  private validate(raw: string): ParseResponse {
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      throw new BadGatewayException('LLM returned invalid JSON')
    }
    const result = parseResponseSchema.safeParse(json)
    if (!result.success) {
      throw new BadGatewayException('LLM output failed contract validation')
    }
    return result.data
  }
}
