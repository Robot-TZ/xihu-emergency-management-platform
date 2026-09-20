import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./config";
import { sharedCookieOptions } from "./cookie-options";

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function createClient() {
  const hostname = typeof window === "undefined" ? undefined : window.location.hostname;
  return createBrowserClient(supabaseUrl, supabasePublishableKey, {
    cookieOptions: sharedCookieOptions(hostname),
  });
}
