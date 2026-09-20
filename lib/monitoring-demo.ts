import type { MonitoringAlert, MonitoringAlertAction, MonitoringAsset, MonitoringReading, MonitoringRule } from "./types";

const stamp = "2026-09-20T09:00:00+08:00";
const times = ["05:00", "06:00", "07:00", "08:00", "09:00"];

export const demoMonitoringAssets: MonitoringAsset[] = [
  { id: "asset-rain", code: "TF-R-001", name: "三墩雨量站", domain: "typhoon", asset_type: "rain_station", area: "三墩镇", address: "三墩镇演示点位", longitude: 120.079, latitude: 30.324, source_code: "FLOOD_SIM", source_mode: "simulated", status: "online", last_seen_at: stamp, created_at: stamp },
  { id: "asset-water", code: "TF-W-001", name: "留下水位站", domain: "typhoon", asset_type: "water_station", area: "留下街道", address: "留下街道演示点位", longitude: 120.055, latitude: 30.246, source_code: "FLOOD_SIM", source_mode: "simulated", status: "online", last_seen_at: stamp, created_at: stamp },
  { id: "asset-depth", code: "TF-D-001", name: "转塘积水点", domain: "typhoon", asset_type: "depth_sensor", area: "转塘街道", address: "转塘街道演示点位", longitude: 120.09, latitude: 30.16, source_code: "IOT_SIM", source_mode: "simulated", status: "online", last_seen_at: stamp, created_at: stamp },
  { id: "asset-gas", code: "CS-G-001", name: "地下空间气体探测器A", domain: "city", asset_type: "gas_sensor", area: "西湖街道", address: "地下空间演示点位", longitude: 120.129, latitude: 30.251, source_code: "CITY_SIM", source_mode: "simulated", status: "online", last_seen_at: stamp, created_at: stamp },
  { id: "asset-bridge", code: "CS-B-001", name: "桥梁倾角监测器A", domain: "city", asset_type: "bridge_sensor", area: "北山街道", address: "桥梁演示点位", longitude: 120.143, latitude: 30.273, source_code: "CITY_SIM", source_mode: "simulated", status: "maintenance", last_seen_at: "2026-09-20T07:10:00+08:00", created_at: stamp },
  { id: "asset-fire", code: "CS-F-001", name: "高层消防水压表A", domain: "city", asset_type: "fire_sensor", area: "古荡街道", address: "高层建筑演示点位", longitude: 120.112, latitude: 30.278, source_code: "CITY_SIM", source_mode: "simulated", status: "offline", last_seen_at: "2026-09-20T03:00:00+08:00", created_at: stamp },
];

function series(asset_id: string, metric_code: string, unit: string, values: number[]): MonitoringReading[] {
  return values.map((value, index) => ({ id: `${asset_id}-${index}`, asset_id, metric_code, value, unit, measured_at: `2026-09-20T${times[index]}:00+08:00`, source_mode: "simulated", raw_payload: { adapter: "demo" }, created_at: stamp }));
}

export const demoMonitoringReadings: MonitoringReading[] = [
  ...series("asset-rain", "rainfall_hour", "mm/h", [3, 5, 9, 11, 12]),
  ...series("asset-water", "water_level", "m", [3.8, 3.9, 4, 4.1, 4.2]),
  ...series("asset-depth", "water_depth", "cm", [8, 12, 17, 24, 30]),
  ...series("asset-gas", "gas_ppm", "ppm", [15, 18, 22, 36, 43]),
  ...series("asset-bridge", "inclination", "°", [0.1, 0.1, 0.12, 0.14, 0.15]),
  ...series("asset-fire", "water_pressure", "MPa", [0.42, 0.41, 0.39, 0.31, 0.28]),
];

export const demoMonitoringRules: MonitoringRule[] = [
  { id: "rule-rain", name: "小时雨量阈值", domain: "typhoon", asset_type: "rain_station", metric_code: "rainfall_hour", operator: "gte", warning_threshold: 20, critical_threshold: 30, silence_minutes: 30, enabled: true, created_at: stamp },
  { id: "rule-water", name: "河道水位阈值", domain: "typhoon", asset_type: "water_station", metric_code: "water_level", operator: "gte", warning_threshold: 4.3, critical_threshold: 4.5, silence_minutes: 30, enabled: true, created_at: stamp },
  { id: "rule-depth", name: "积水深度阈值", domain: "typhoon", asset_type: "depth_sensor", metric_code: "water_depth", operator: "gte", warning_threshold: 20, critical_threshold: 30, silence_minutes: 20, enabled: true, created_at: stamp },
  { id: "rule-gas", name: "可燃气体阈值", domain: "city", asset_type: "gas_sensor", metric_code: "gas_ppm", operator: "gte", warning_threshold: 30, critical_threshold: 40, silence_minutes: 15, enabled: true, created_at: stamp },
  { id: "rule-fire", name: "消防水压下限", domain: "city", asset_type: "fire_sensor", metric_code: "water_pressure", operator: "lte", warning_threshold: 0.35, critical_threshold: 0.25, silence_minutes: 30, enabled: true, created_at: stamp },
];

export const demoMonitoringAlerts: MonitoringAlert[] = [
  { id: "alert-depth", asset_id: "asset-depth", rule_id: "rule-depth", fingerprint: "asset-depth:water_depth:rule-depth", metric_code: "water_depth", measured_value: 30, threshold_value: 30, level: "critical", status: "open", occurrence_count: 2, first_triggered_at: "2026-09-20T08:00:00+08:00", last_triggered_at: stamp, created_at: stamp },
  { id: "alert-gas", asset_id: "asset-gas", rule_id: "rule-gas", fingerprint: "asset-gas:gas_ppm:rule-gas", metric_code: "gas_ppm", measured_value: 43, threshold_value: 40, level: "critical", status: "claimed", occurrence_count: 2, first_triggered_at: "2026-09-20T08:00:00+08:00", last_triggered_at: stamp, claimed_at: stamp, created_at: stamp },
  { id: "alert-fire", asset_id: "asset-fire", rule_id: "rule-fire", fingerprint: "asset-fire:water_pressure:rule-fire", metric_code: "water_pressure", measured_value: 0.28, threshold_value: 0.35, level: "warning", status: "verified", occurrence_count: 1, first_triggered_at: stamp, last_triggered_at: stamp, verified_at: stamp, created_at: stamp },
];

export const demoMonitoringActions: MonitoringAlertAction[] = [
  { id: "action-depth", alert_id: "alert-depth", action: "deduplicated", note: "同一设备、指标和规则的重复告警已合并，累计2次。", created_at: stamp },
  { id: "action-gas", alert_id: "alert-gas", action: "claimed", note: "指挥中心已认领。", created_at: stamp },
  { id: "action-fire", alert_id: "alert-fire", action: "verified", note: "已完成设备与现场复核。", created_at: stamp },
];
