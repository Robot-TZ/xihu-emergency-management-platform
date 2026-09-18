import { expect, test } from "@playwright/test";

test("guest data persists across refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "载入示例数据" }).click();
  await expect(page.getByText("示例已保存到本机浏览器。")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /事件管理/ }).click();
  await expect(page.getByText("暴雨内涝 · Ⅲ级")).toBeVisible();
});

test("workspace navigation has core modules", async ({ page }) => {
  await page.goto("/");
  for (const name of ["项目介绍", "SOP 流程", "事件管理", "指令任务", "风险普查", "操作日志"]) {
    await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  }
});

test("invalid saved data falls back safely", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("xihu-emergency-platform-v1", "not-json"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "西湖区应急管理综合平台" })).toBeVisible();
});

test("SOP page shows the response loop", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /SOP 流程/ }).click();
  await expect(page.getByRole("heading", { name: "应急处置 SOP" })).toBeVisible();
  await expect(page.getByText("未达到处置目标 → 退回核查、补充指令或重新调度")).toBeVisible();
});

test("task create, update and delete are persisted", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /指令任务/ }).click();
  await page.getByLabel("任务名称").fill("巡查测试任务");
  await page.getByLabel("接收对象").fill("测试工作组");
  await page.getByRole("button", { name: "保存任务" }).click();
  const row = page.getByRole("row").filter({ hasText: "巡查测试任务" });
  await expect(row).toContainText("待查阅");
  await row.getByRole("button", { name: "推进" }).click();
  await expect(row).toContainText("已读");
  await page.reload();
  await page.getByRole("button", { name: /指令任务/ }).click();
  await expect(page.getByRole("row").filter({ hasText: "巡查测试任务" })).toContainText("已读");
  await page.getByRole("row").filter({ hasText: "巡查测试任务" }).getByRole("button", { name: "删除" }).click();
  await expect(page.getByRole("row").filter({ hasText: "巡查测试任务" })).toHaveCount(0);
});
