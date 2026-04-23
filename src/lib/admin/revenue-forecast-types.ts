export type RevenueForecastPeriod = {
  days: 7 | 14 | 30
  confirmedRevenue: number
  pipelineRevenue: number
  quoteCount: number
}

export type RevenueForecastPayload = {
  forecasts: RevenueForecastPeriod[]
  conversionRate: number
}
