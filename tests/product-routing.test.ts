import { describe, expect, it } from "vitest";
import { pageForHostname, safeReturnUrl, urlForPage } from "@/lib/product-routing";

describe("product routing", () => {
  it("uses the apex as the portal and resolves module subdomains", () => {
    expect(pageForHostname("xihuresponse.top")).toBe("portal");
    expect(pageForHostname("plan.xihuresponse.top")).toBe("plans");
    expect(pageForHostname("admin.xihuresponse.top", "logs")).toBe("logs");
  });

  it("builds production and local module URLs", () => {
    expect(urlForPage("command", "xihuresponse.top")).toBe("https://command.xihuresponse.top/");
    expect(urlForPage("plans", "localhost")).toBe("/?view=plans");
  });

  it("rejects external post-login redirects", () => {
    expect(safeReturnUrl("https://plan.xihuresponse.top/work")).toBe("https://plan.xihuresponse.top/work");
    expect(safeReturnUrl("https://attacker.example/")).toBe("https://xihuresponse.top/");
    expect(safeReturnUrl("javascript:alert(1)")).toBe("https://xihuresponse.top/");
  });
});
