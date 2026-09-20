import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "./config";
import { sharedCookieOptions } from "./cookie-options";

export async function createClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  return createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookieOptions: sharedCookieOptions(headerStore.get("x-forwarded-host") || headerStore.get("host") || undefined),
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies; proxy.ts refreshes sessions.
          }
        },
      },
    },
  );
}
