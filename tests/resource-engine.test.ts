import { describe, expect, it } from "vitest";
import { demoEvent } from "@/lib/demo-data";
import { demoInventoryBalances, demoInventoryItems, demoResources, demoWarehouses } from "@/lib/operations-demo";
import { applyInventoryDeltas, inventoryAlerts, recommendResources } from "@/lib/resource-engine";

describe("resource and inventory operations", () => {
  it("recommends available resources using area and capability evidence", () => {
    const ranked = recommendResources(demoEvent, demoResources);
    expect(ranked[0].resource.code).toBe("XH-TEAM-001");
    expect(ranked[0].score).toBe(100);
    expect(ranked[0].reasons.join(" ")).toContain("能力命中");
  });

  it("applies inventory deltas without mutating the original snapshot", () => {
    const next = applyInventoryDeltas(demoInventoryBalances, [{ warehouse_id: "wh-district", item_id: "item-pump", quantity_delta: -2 }], "later");
    expect(next.find((item) => item.id === "bal-1")?.quantity).toBe(6);
    expect(demoInventoryBalances.find((item) => item.id === "bal-1")?.quantity).toBe(8);
  });

  it("rejects a document that would create negative inventory", () => {
    expect(() => applyInventoryDeltas(demoInventoryBalances, [{ warehouse_id: "wh-district", item_id: "item-pump", quantity_delta: -20 }], "later")).toThrow("库存不足");
  });

  it("raises lower-limit warnings from configured item thresholds", () => {
    const alerts = inventoryAlerts(demoInventoryBalances, demoInventoryItems, demoWarehouses);
    expect(alerts.some((alert) => alert.item.sku === "XH-WZ-002" && alert.warehouse.code === "XH-WH-002")).toBe(true);
  });
});
