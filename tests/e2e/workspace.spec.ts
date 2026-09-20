import { expect, test, type Page } from "@playwright/test";

async function gotoModule(page: Page, name: RegExp) {
  await page.getByRole("button", { name: "切换导航菜单" }).click();
  await page.getByRole("button", { name }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/?demo=1&view=overview");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("guest product data persists across refresh", async ({ page }) => {
  await page.getByRole("button", { name: "初始化产品数据" }).click();
  await expect(page.getByText("示例数据已保存到本机。")).toBeVisible();
  await page.reload();
  await gotoModule(page, /指挥调度/);
  await expect(page.getByText("短时强降雨导致道路积水约30厘米")).toBeVisible();
});

test("workspace exposes the tender-aligned product modules via the drawer", async ({ page }) => {
  await page.getByRole("button", { name: "切换导航菜单" }).click();
  for (const name of ["综合门户", "台汛卫士", "预案中心", "指挥调度", "应急资源", "物资库存", "风险普查", "城市安全", "应急值班", "数据管理", "灾后复盘"]) {
    await expect(page.locator("aside").getByRole("button", { name: new RegExp(name) })).toBeVisible();
  }
});

test("command tasks can be created, advanced and deleted", async ({ page }) => {
  await gotoModule(page, /指挥调度/);
  await page.getByText("手工下达指令").click();
  await page.getByLabel("任务", { exact: true }).fill("巡查测试任务");
  await page.getByLabel("接收人").selectOption("");
  await page.getByLabel("接收组织").selectOption("");
  await page.getByRole("button", { name: "下达指令" }).click();
  let row = page.getByRole("row").filter({ hasText: "巡查测试任务" });
  await expect(row).toContainText("待查阅");
  await row.getByRole("button", { name: "标记已读" }).click();
  await expect(row).toContainText("已读");
  await page.reload();
  await gotoModule(page, /指挥调度/);
  row = page.getByRole("row").filter({ hasText: "巡查测试任务" });
  await expect(row).toContainText("已读");
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "删除" }).click();
  await expect(row).toHaveCount(0);
});

test("monitoring command center deduplicates and converts an alert", async ({ page }) => {
  await page.getByRole("button", { name: "初始化产品数据" }).click();
  await gotoModule(page, /台汛卫士/);
  await expect(page.getByText("业务监测为模拟 · 公共天气仅供参考")).toBeVisible();
  await expect(page.getByText("设备在线率")).toBeVisible();
  const ingest = page.getByRole("heading", { name: "模拟适配器采集" }).locator("..");
  await ingest.getByLabel("设备").selectOption("asset-depth");
  await ingest.getByLabel("指标编码").fill("water_depth");
  await ingest.getByLabel("监测值").fill("32");
  await ingest.getByLabel("单位").fill("cm");
  await ingest.getByRole("button", { name: "写入监测值并执行规则" }).click();
  await expect(page.getByText("阈值已触发，重复告警已合并。")).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "转塘积水点" }).filter({ hasText: "累计 3 次" });
  await row.getByRole("button", { name: "认领" }).click();
  await row.getByRole("button", { name: "复核" }).click();
  await row.getByRole("button", { name: "转事件" }).click();
  await expect(page.getByRole("heading", { name: "预案中心", exact: true })).toBeVisible();
});

test("professional plan center explains scoring and starts versioned task templates", async ({ page }) => {
  await page.getByRole("button", { name: "初始化产品数据" }).click();
  await gotoModule(page, /预案中心/);
  await expect(page.getByText("事件类型匹配：+50")).toBeVisible();
  await expect(page.getByText("启动后将生成 3 条责任任务").first()).toBeVisible();
  await page.getByRole("button", { name: "人工确认并启动" }).first().click();
  await expect(page.getByText("已启动《西湖区暴雨内涝应急处置预案》V1，并按模板生成 3 条指令。")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "排涝作业" }).filter({ hasText: "属地应急队" })).toBeVisible();
});

test("resource center recommends dispatch candidates with explainable evidence", async ({ page }) => {
  await page.getByRole("button", { name: "初始化产品数据" }).click();
  await gotoModule(page, /应急资源/);
  await expect(page.getByRole("heading", { name: "应急资源", exact: true })).toBeVisible();
  await expect(page.getByText("转塘街道应急队").first()).toBeVisible();
  await expect(page.getByText(/能力命中：/).first()).toBeVisible();
});

test("inventory inbound document posts and changes the balance", async ({ page }) => {
  await page.getByRole("button", { name: "初始化产品数据" }).click();
  await gotoModule(page, /物资库存/);
  const form = page.getByRole("heading", { name: "新建库存业务单" }).locator("..");
  await form.locator('select[name="toWarehouseId"]').selectOption("wh-district");
  await form.locator('select[name="itemId"]').selectOption("item-pump");
  await form.locator('input[name="quantity"]').fill("2");
  await form.getByRole("button", { name: "创建草稿" }).click();
  await page.getByRole("button", { name: "提交审核" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "审核并记账" }).click();
  await expect(page.getByText("单据已审核，库存余额已原子更新。")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "移动排涝泵" }).filter({ hasText: "10 台" })).toBeVisible();
});

test("risk confirmation creates an idempotent simulated writeback result", async ({ page }) => {
  await page.getByRole("button", { name: "初始化产品数据" }).click();
  await gotoModule(page, /风险普查/);
  const row = page.getByRole("row").filter({ hasText: "转塘演示安置点A" });
  await expect(row.getByText("隐患等级")).toBeVisible();
  await row.getByRole("button", { name: "确认并回写" }).click();
  await expect(page.getByText("已确认并通过模拟适配器完成回写。")).toBeVisible();
  await expect(row.getByText("IRS_SIM · succeeded")).toBeVisible();
});
