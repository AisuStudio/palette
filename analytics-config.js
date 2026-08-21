/*
  Shared endpoint config for the palette analytics tracker and dashboard.

  TODO: fill these two in from your Supabase project (Settings → API).
  The anon key belongs in public source — it is not a secret. What protects the
  data is row-level security: anon may INSERT events and nothing else, and only
  an authenticated session may read them. See analytics/schema.sql.
*/
window.PALETTE_ANALYTICS = {
  url: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR-ANON-KEY',
  table: 'palette_events',
};
