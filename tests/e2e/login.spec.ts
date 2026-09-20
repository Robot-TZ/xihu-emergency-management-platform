import { expect, test } from "@playwright/test";

test("unauthenticated root shows the standalone login instead of the workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "登录西湖应急平台" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "一个入口，协同处置全流程" })).toBeVisible();
  await expect(page.getByRole("button", { name: /指挥调度/ })).toHaveCount(0);
});

test("local demo portal opens a module and can return to the portal", async ({ page }) => {
  await page.goto("/?demo=1&view=portal");
  const card = page.locator(".app-card").filter({ hasText: "预案中心" });
  await card.getByRole("button", { name: "进入" }).click();
  await expect(page.getByRole("heading", { name: "预案中心", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回综合门户" }).click();
  await expect(page.getByRole("heading", { name: "综合门户", exact: true })).toBeVisible();
});
