import { describe, expect, it } from "vitest";
import { alertFingerprint, evaluateMonitoringRule, latestReadingByAsset, monitoringMetrics } from "@/lib/monitoring-engine";
import { demoMonitoringAlerts, demoMonitoringAssets, demoMonitoringReadings, demoMonitoringRules } from "@/lib/monitoring-demo";

describe("monitoring engine", () => {
  it("distinguishes warning and critical thresholds", () => {
    const rule = demoMonitoringRules.find((item) => item.id === "rule-depth")!;
    expect(evaluateMonitoringRule(rule, 19)).toBeNull();
    expect(evaluateMonitoringRule(rule, 22)?.level).toBe("warning");
    expect(evaluateMonitoringRule(rule, 31)?.level).toBe("critical");
  });

  it("supports low-value alarms", () => {
    const rule = demoMonitoringRules.find((item) => item.id === "rule-fire")!;
    expect(evaluateMonitoringRule(rule, 0.4)).toBeNull();
    expect(evaluateMonitoringRule(rule, 0.3)?.level).toBe("warning");
    expect(evaluateMonitoringRule(rule, 0.2)?.level).toBe("critical");
  });

  it("uses a stable deduplication fingerprint", () => {
    expect(alertFingerprint("a", "rain", "r")).toBe("a:rain:r");
  });

  it("calculates online and alert indicators", () => {
    const metrics = monitoringMetrics(demoMonitoringAssets, demoMonitoringReadings, demoMonitoringAlerts);
    expect(metrics.onlineRate).toBe(67);
    expect(metrics.activeAlerts).toBe(3);
    expect(latestReadingByAsset(demoMonitoringReadings).get("asset-depth")?.value).toBe(30);
  });
});
