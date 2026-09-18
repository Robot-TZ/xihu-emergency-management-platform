import { describe, expect, it } from "vitest";
import { demoEvent, demoRisks, demoTasks } from "@/lib/demo-data";

describe("demo data", () => {
  it("keeps the event and tasks linked", () => {
    expect(demoTasks).toHaveLength(3);
    expect(demoTasks.every((task) => task.event_id === demoEvent.id)).toBe(true);
  });
  it("covers add, change and delete risk differences", () => {
    expect(new Set(demoRisks.map((risk) => risk.change_type))).toEqual(new Set(["新增", "变更", "删减"]));
  });
});
