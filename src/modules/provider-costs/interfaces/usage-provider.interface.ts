export interface ProviderUsageData {
  provider: string;
  periodStart: Date;
  periodEnd: Date;
  rawMetrics: Record<string, number>;
  computedCostUsd: number;
}

export interface UsageProvider {
  readonly providerName: string;
  fetchUsage(from: Date, to: Date): Promise<ProviderUsageData>;
}
