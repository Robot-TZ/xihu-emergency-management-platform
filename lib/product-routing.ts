import type { ProductPage } from "./product-catalog";

export const PLATFORM_DOMAIN = "xihuresponse.top";

const subdomainByPage: Partial<Record<ProductPage, string>> = {
  typhoon: "typhoon",
  plans: "plan",
  command: "command",
  resources: "resource",
  inventory: "inventory",
  risks: "risk",
  city: "city",
  duty: "duty",
  data: "data",
  reviews: "review",
  logs: "admin",
  admin: "admin",
};

const pageBySubdomain = Object.fromEntries(
  Object.entries(subdomainByPage).map(([page, subdomain]) => [subdomain, page]),
) as Record<string, ProductPage>;

export function hostnameWithoutPort(host: string) {
  return host.toLowerCase().split(":")[0].replace(/\.$/, "");
}

export function isPlatformHostname(host: string) {
  const hostname = hostnameWithoutPort(host);
  return hostname === PLATFORM_DOMAIN || hostname.endsWith(`.${PLATFORM_DOMAIN}`);
}

export function pageForHostname(host: string, requestedView?: string | null): ProductPage {
  const hostname = hostnameWithoutPort(host);
  if (hostname === PLATFORM_DOMAIN || hostname === `www.${PLATFORM_DOMAIN}`) {
    return requestedView === "overview" ? "overview" : "portal";
  }
  if (hostname.endsWith(`.${PLATFORM_DOMAIN}`)) {
    const subdomain = hostname.slice(0, -(PLATFORM_DOMAIN.length + 1));
    if (subdomain === "admin" && requestedView === "logs") return "logs";
    return pageBySubdomain[subdomain] || "portal";
  }
  if (requestedView && isProductPage(requestedView)) return requestedView;
  return "portal";
}

export function urlForPage(page: ProductPage, currentHostname?: string, eventId?: string | null) {
  const hostname = currentHostname ? hostnameWithoutPort(currentHostname) : "";
  const eventQuery = eventId ? `event=${encodeURIComponent(eventId)}` : "";
  if (hostname && !isPlatformHostname(hostname)) return `/?view=${page}${eventQuery ? `&${eventQuery}` : ""}`;
  if (page === "overview") return `https://${PLATFORM_DOMAIN}/?view=overview${eventQuery ? `&${eventQuery}` : ""}`;
  if (page === "portal") return `https://${PLATFORM_DOMAIN}/${eventQuery ? `?${eventQuery}` : ""}`;
  const subdomain = subdomainByPage[page];
  const query = [page === "logs" ? "view=logs" : "", eventQuery].filter(Boolean).join("&");
  return `https://${subdomain}.${PLATFORM_DOMAIN}/${query ? `?${query}` : ""}`;
}

export function safeReturnUrl(value?: string | null) {
  if (!value) return `https://${PLATFORM_DOMAIN}/`;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && isPlatformHostname(url.hostname)) return url.toString();
  } catch {
    // Invalid or relative return URLs always fall back to the portal.
  }
  return `https://${PLATFORM_DOMAIN}/`;
}

export function isProductPage(value: string): value is ProductPage {
  return ["overview", "portal", "typhoon", "plans", "command", "resources", "inventory", "risks", "city", "duty", "data", "reviews", "logs", "admin"].includes(value);
}
