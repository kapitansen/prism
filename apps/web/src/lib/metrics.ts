import { api } from './api'

// Mirrors the backend metrics responses (see metrics.service.ts).
export interface MetricDefinition {
  key: string
  name: string
  unit: string | null
  scaleMin: number | null
  scaleMax: number | null
  source: string
  enabled: boolean
}

export interface MetricValue {
  id: string
  metricKey: string
  value: number
  occurredOn: string
  source: string
  entryId: string | null
}

export function fetchMetricDefinitions() {
  return api.get<MetricDefinition[]>('/metrics/definitions')
}

// Set the actively-tracked metric set (≤4). Returns the updated definitions.
export function setEnabledMetrics(keys: string[]) {
  return api.put<MetricDefinition[]>('/metrics/enabled', { keys })
}

export function fetchMetricValues(
  params: { from?: string; to?: string; metricKey?: string } = {},
) {
  const q = new URLSearchParams()
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  if (params.metricKey) q.set('metricKey', params.metricKey)
  const qs = q.toString()
  return api.get<MetricValue[]>(
    qs ? `/metrics/values?${qs}` : '/metrics/values',
  )
}

// PUT — recording is idempotent (one manual value per metric per day).
export function recordMetricValue(input: {
  metricKey: string
  value: number
  occurredOn: string
}) {
  return api.put<MetricValue>('/metrics/values', input)
}
