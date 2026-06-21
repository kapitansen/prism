import { BadRequestException, Injectable } from '@nestjs/common'
import { MetricDefinition, MetricValue } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { QueryMetricValuesDto } from './dto/query-metric-values.dto'
import { RecordMetricValueDto } from './dto/record-metric-value.dto'

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDefinitions(userId: string) {
    const defs = await this.prisma.metricDefinition.findMany({
      where: { userId },
      orderBy: { key: 'asc' },
    })
    return defs.map((d) => this.toDefinition(d))
  }

  // Set the user's actively-tracked metrics (≤4): enable the given keys, disable
  // the rest. Capped so the chip row / prompt stays focused.
  async setEnabled(userId: string, keys: string[]) {
    if (keys.length > 4) {
      throw new BadRequestException('At most 4 metrics can be enabled')
    }
    await this.prisma.$transaction([
      this.prisma.metricDefinition.updateMany({
        where: { userId },
        data: { enabled: false },
      }),
      this.prisma.metricDefinition.updateMany({
        where: { userId, key: { in: keys } },
        data: { enabled: true },
      }),
    ])
    return this.listDefinitions(userId)
  }

  // Upsert: one manual value per metric per day (the unique key includes
  // source) — tapping a chip again just updates today's value.
  async recordValue(userId: string, dto: RecordMetricValueDto) {
    // Don't invent data: the metric must be one of the user's defined metrics.
    const def = await this.prisma.metricDefinition.findUnique({
      where: { userId_key: { userId, key: dto.metricKey } },
    })
    if (!def) {
      throw new BadRequestException(`Unknown metric: ${dto.metricKey}`)
    }
    // Range-check against the metric's scale when it has one.
    if (
      def.scaleMin !== null &&
      def.scaleMax !== null &&
      (dto.value < def.scaleMin || dto.value > def.scaleMax)
    ) {
      throw new BadRequestException(
        `Value out of range [${def.scaleMin}, ${def.scaleMax}]`,
      )
    }

    const occurredOn = new Date(dto.occurredOn)
    const value = await this.prisma.metricValue.upsert({
      where: {
        userId_metricKey_occurredOn_source: {
          userId,
          metricKey: dto.metricKey,
          occurredOn,
          source: 'manual',
        },
      },
      update: { value: dto.value },
      create: {
        userId,
        metricKey: dto.metricKey,
        occurredOn,
        source: 'manual',
        value: dto.value,
      },
    })
    return this.toValue(value)
  }

  async listValues(userId: string, q: QueryMetricValuesDto) {
    const values = await this.prisma.metricValue.findMany({
      where: {
        userId,
        ...(q.metricKey ? { metricKey: q.metricKey } : {}),
        ...(q.from || q.to
          ? {
              occurredOn: {
                gte: q.from ? new Date(q.from) : undefined,
                lte: q.to ? new Date(q.to) : undefined,
              },
            }
          : {}),
      },
      orderBy: { occurredOn: 'desc' },
    })
    return values.map((v) => this.toValue(v))
  }

  private toDefinition(d: MetricDefinition) {
    return {
      key: d.key,
      name: d.name,
      unit: d.unit,
      scaleMin: d.scaleMin,
      scaleMax: d.scaleMax,
      source: d.source,
      enabled: d.enabled,
    }
  }

  private toValue(v: MetricValue) {
    return {
      id: v.id,
      metricKey: v.metricKey,
      value: v.value.toNumber(), // Prisma Decimal → plain number for JSON
      occurredOn: v.occurredOn,
      source: v.source,
      entryId: v.entryId,
    }
  }
}
