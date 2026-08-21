-- palette analytics — run once in the Supabase SQL editor.
--
-- The security model: the anon key is public (it ships in analytics-config.js),
-- so it must be able to do exactly one thing — append an event. Reading is
-- reserved for an authenticated session, which is what protects the dashboard.
-- There is no UPDATE or DELETE policy, so neither role can rewrite history.

create table if not exists public.palette_events (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),

  -- random per page view, held only in the visitor's memory. It ties a view to
  -- its own leave and carousel events and cannot identify anyone across visits.
  session     text        not null,

  kind        text        not null check (kind in ('view', 'leave', 'carousel')),

  -- view: referrer hostname, or 'direct'. Hostname only — never the full URL.
  channel     text,
  viewport    text                 check (viewport in ('narrow', 'wide')),

  -- carousel: which project row, and which slide the click landed on
  project     text,
  slide       smallint             check (slide >= 0 and slide < 20),

  -- leave: milliseconds the page was actually visible
  dwell_ms    integer              check (dwell_ms >= 0 and dwell_ms < 86400000)
);

create index if not exists palette_events_created_at_idx
  on public.palette_events (created_at desc);

alter table public.palette_events enable row level security;

-- Visitors may append, and only append.
drop policy if exists "anon may append events" on public.palette_events;
create policy "anon may append events"
  on public.palette_events for insert
  to anon
  with check (
    kind in ('view', 'leave', 'carousel')
    and length(session) between 8 and 64
    and (channel is null or length(channel) <= 120)
    and (project is null or length(project) <= 60)
  );

-- Only a signed-in session may read. Create your dashboard user under
-- Authentication → Users, and keep sign-ups disabled so nobody else can make one.
drop policy if exists "authenticated may read events" on public.palette_events;
create policy "authenticated may read events"
  on public.palette_events for select
  to authenticated
  using (true);

-- Retention: events older than a year serve no purpose here. Schedule this with
-- pg_cron if the extension is enabled, or run it by hand now and then.
--   select cron.schedule('palette-analytics-prune', '0 4 * * 0',
--     $$delete from public.palette_events where created_at < now() - interval '1 year'$$);
