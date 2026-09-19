import { describe, expect, it } from "vitest";
import { demoEvent, demoRisks, demoTasks } from "@/lib/demo-data";
import { demoOperationalRecords, productPages, tenderCoverage } from "@/lib/product-catalog";

describe("demo data", () => {
  it("keeps the event and tasks linked", () => {
    expect(demoTasks).toHaveLength(3);
    expect(demoTasks.every((task) => task.event_id === demoEvent.id)).toBe(true);
  });
  it("covers add, change and delete risk differences", () => {
    expect(new Set(demoRisks.map((risk) => risk.change_type))).toEqual(new Set(["新增", "变更", "删减"]));
  });
  it("exposes every tender product area", () => {
    expect(tenderCoverage).toHaveLength(5);
    expect(productPages.map((page) => page.key)).toEqual(expect.arrayContaining(["portal", "typhoon", "plans", "command", "resources", "inventory", "risks", "city", "duty", "data", "reviews"]));
    expect(new Set(demoOperationalRecords.map((record) => record.source_mode))).toEqual(new Set(["real", "simulated", "external"]));
  });
});
