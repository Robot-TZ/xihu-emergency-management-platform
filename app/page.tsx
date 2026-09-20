import { EmergencyApp } from "@/components/emergency-app";
import { LoginPage } from "@/components/login-page";
import { hostnameWithoutPort, pageForHostname, safeReturnUrl, PLATFORM_DOMAIN } from "@/lib/product-routing";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const view = typeof params.view === "string" ? params.view : undefined;
  const initialEventId = typeof params.event === "string" ? params.event : undefined;
  const initialPage = pageForHostname(host, view);
  const localDemo = ["localhost", "127.0.0.1"].some((name) => host.startsWith(name)) && params.demo === "1";
  if (localDemo) return <EmergencyApp initialPage={initialPage} initialEventId={initialEventId} allowGuestDemo />;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const authenticated = Boolean(data?.claims?.sub);
  const hostname = hostnameWithoutPort(host);
  const onRoot = hostname === PLATFORM_DOMAIN || hostname === `www.${PLATFORM_DOMAIN}` || hostname === "localhost" || hostname === "127.0.0.1";
  if (!authenticated && !onRoot) {
    const protocol = host.includes("localhost") ? "http" : "https";
    const target = `${protocol}://${host}/`;
    redirect(`https://${PLATFORM_DOMAIN}/?next=${encodeURIComponent(target)}`);
  }
  if (!authenticated) {
    const requestedNext = typeof params.next === "string" ? safeReturnUrl(params.next) : undefined;
    return <LoginPage next={requestedNext} />;
  }
  return <EmergencyApp initialPage={initialPage} initialEventId={initialEventId} />;
}
