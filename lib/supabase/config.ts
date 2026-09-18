// Supabase publishable keys are designed for browser use. RLS remains the
// security boundary; never place a secret/service-role key in this file.
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://stccnbdredcxdjjfyuxf.supabase.co";
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_lNVb9DG4mF2D7guXkbt_rQ_97kwprvW";
