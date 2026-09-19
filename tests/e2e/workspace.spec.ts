import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("guest product data persists across refresh", async ({ page }) => {
  await page.getByRole("button", { name: "初始化产品数据" }).click();
  await expect(page.getByText("示例数据已保存到本机。")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /指挥调度/ }).click();
  await expect(page.getByText("短时强降雨导致道路积水约30厘米")).toBeVisible();
});

test("workspace exposes the tender-aligned product modules", async ({ page }) => {
  for (const name of ["综合门户", "台汛卫士", "预案中心", "指挥调度", "应急资源", "物资库存", "风险普查", "城市安全", "应急值班", "数据管理", "灾后复盘"]) {
    await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  }
});

test("command tasks can be created, advanced and deleted", async ({ page }) => {
  await page.getByRole("button", { name: /指挥调度/ }).click();
  await page.getByLabel("任务", { exact: true }).fill("巡查测试任务");
  await page.getByLabel("接收对象").fill("测试工作组");
  await page.getByRole("button", { name: "下达指令" }).click();
  let row = page.getByRole("row").filter({ hasText: "巡查测试任务" });
  await expect(row).toContainText("待查阅");
  await row.getByRole("button", { name: "推进" }).click();
  await expect(row).toContainText("已读");
  await page.reload();
  await page.getByRole("button", { name: /指挥调度/ }).click();
  row = page.getByRole("row").filter({ hasText: "巡查测试任务" });
  await expect(row).toContainText("已读");
  await row.getByRole("button", { name: "删除" }).click();
  await expect(row).toHaveCount(0);
});

test("monitoring demo is explicitly labeled and converts an alert", async ({ page }) => {
  await page.getByRole("button", { name: /台汛卫士/ }).click();
  await expect(page.getByText("外部实时数据为模拟")).toBeVisible();
  const card = page.locator(".monitor-card").filter({ hasText: "转塘积水点" });
  await card.getByRole("button", { name: "转入事件研判" }).click();
  await expect(page.getByRole("heading", { name: "预案中心", exact: true })).toBeVisible();
});
