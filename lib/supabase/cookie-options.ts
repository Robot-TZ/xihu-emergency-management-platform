import { isPlatformHostname, PLATFORM_DOMAIN } from "../product-routing";

export function sharedCookieOptions(hostname?: string) {
  const base = { name: "xihu-platform-auth", path: "/", sameSite: "lax" as const };
  if (!hostname || !isPlatformHostname(hostname)) return base;
  return {
    ...base,
    domain: `.${PLATFORM_DOMAIN}`,
    secure: true,
  };
}
