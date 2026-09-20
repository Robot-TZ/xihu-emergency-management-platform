import type { MonitoringAlert, MonitoringAsset, MonitoringReading, MonitoringRule } from "./types";

export type TriggerResult = { level: MonitoringAlert["level"]; threshold: number } | null;

export function evaluateMonitoringRule(rule: MonitoringRule, value: number): TriggerResult {
  if (!rule.enabled) return null;
  const warning = rule.operator === "gte" ? value >= rule.warning_threshold : value <= rule.warning_threshold;
  if (!warning) return null;
  const critical = rule.operator === "gte" ? value >= rule.critical_threshold : value <= rule.critical_threshold;
  return { level: critical ? "critical" : "warning", threshold: critical ? rule.critical_threshold : rule.warning_threshold };
}

export function alertFingerprint(assetId: string, metricCode: string, ruleId: string) {
  return `${assetId}:${metricCode}:${ruleId}`;
}

export function monitoringMetrics(assets: MonitoringAsset[], readings: MonitoringReading[], alerts: MonitoringAlert[]) {
  const online = assets.filter((asset) => asset.status === "online").length;
  const activeAlerts = alerts.filter((alert) => alert.status !== "closed");
  const resolved = alerts.filter((alert) => alert.closed_at);
  const averageResponseMinutes = resolved.length
    ? Math.round(resolved.reduce((sum, alert) => sum + (new Date(alert.closed_at!).getTime() - new Date(alert.first_triggered_at).getTime()) / 60000, 0) / resolved.length)
    : 0;
  return {
    onlineRate: assets.length ? Math.round((online / assets.length) * 100) : 0,
    activeAlerts: activeAlerts.length,
    criticalAlerts: activeAlerts.filter((alert) => alert.level === "critical").length,
    readingCount: readings.length,
    averageResponseMinutes,
  };
}

export function latestReadingByAsset(readings: MonitoringReading[]) {
  const latest = new Map<string, MonitoringReading>();
  for (const reading of readings) {
    const current = latest.get(reading.asset_id);
    if (!current || new Date(reading.measured_at) > new Date(current.measured_at)) latest.set(reading.asset_id, reading);
  }
  return latest;
}
