-- RunningLeague verified screenshot leagues.
-- REVIEW THIS SQL AND APPLY TO A NON-PRODUCTION PROJECT FIRST.
-- Apply to production only after reviewing the security tests and authorising the change.
-- Does not change RunningScore v1.0 or existing leagues' eligibility rules.

begin;

alter table public.leagues add column if not exists require_verified_runs boolean not null default false;

create table if not exists public.activity_evidence (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete restrict,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  screenshot_paths text[] not null check (cardinality(screenshot_paths) between 1 and 2),
  client_flags text[] not null default '{}',
  detected_elapsed_seconds integer check (detected_elapsed_seconds > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '' check (length(review_note) <= 400),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(activity_id, league_id)
);

create index if not exists evidence_league_status on public.activity_evidence(league_id, status, created_at desc);
create index if not exists evidence_activity on public.activity_evidence(activity_id);
create index if not exists evidence_user on public.activity_evidence(user_id);

alter table public.activity_evidence enable row level security;
revoke all on table public.activity_evidence from public, anon, authenticated;
grant select on public.activity_evidence to authenticated;

drop policy if exists "Runners and their league organiser can read evidence metadata" on public.activity_evidence;
create policy "Runners and their league organiser can read evidence metadata"
on public.activity_evidence for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.leagues l
    where l.id = activity_evidence.league_id and l.created_by = (select auth.uid())
  )
);
-- All changes to evidence are made through restricted SECURITY DEFINER RPCs.
-- No client UPDATE/INSERT/DELETE permission or RLS policies exist.

-- Private files: allow uploads only under the authenticated runner's own UUID.
-- Files may be read by the uploader or the organiser of the exact associated league.
-- Once submitted, files cannot be overwritten or deleted by the runner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('run-evidence', 'run-evidence', false, 6291456, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 6291456,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "Runner uploads private evidence" on storage.objects;
create policy "Runner uploads private evidence" on storage.objects for insert to authenticated
with check (
  bucket_id = 'run-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and cardinality(storage.foldername(name)) = 2
  and storage.filename(name) ~ '^(overview|details)\.(jpg|png|webp)$'
);

drop policy if exists "Only the runner and league organiser read evidence files" on storage.objects;
create policy "Only the runner and league organiser read evidence files"
on storage.objects for select to authenticated
using (
  bucket_id = 'run-evidence'
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1 from public.activity_evidence ev
      join public.leagues l on l.id = ev.league_id
      where name = any(ev.screenshot_paths) and l.created_by = (select auth.uid())
    )
  )
);

drop policy if exists "Runner may clean up unsubmitted evidence" on storage.objects;
create policy "Runner may clean up unsubmitted evidence" on storage.objects for delete to authenticated
using (
  bucket_id = 'run-evidence'
  and owner_id = (select auth.uid())::text
  and not exists (
    select 1 from public.activity_evidence ev where name = any(ev.screenshot_paths)
  )
);

-- In evidence-required leagues, only moderator-approved submissions earn points.
-- All existing leagues retain current scoring eligibility (default FALSE).
create or replace function public.league_table(league_id_input uuid)
returns table (user_id uuid, name text, initials text, weekly_points bigint, season_points bigint, runs bigint)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.league_members lm where lm.league_id = league_id_input and lm.user_id = auth.uid()
  ) then
    raise exception 'You are not a member of this league.';
  end if;
  return query
  with config as (
    select *, date_trunc('week', created_at at time zone 'Europe/London') as season_start
    from public.leagues where id = league_id_input
  ), daily_ranked as (
    select a.*, date_trunc('week', a.occurred_at at time zone 'Europe/London') as week_start,
      row_number() over (partition by a.user_id, (a.occurred_at at time zone 'Europe/London')::date order by a.points desc, a.id) as daily_rank
    from public.activities a
    join public.league_members membership on membership.user_id = a.user_id and membership.league_id = league_id_input
    cross join config
    where not a.training and a.occurred_at <= now()
      and a.occurred_at at time zone 'Europe/London' >= config.season_start
      and a.occurred_at at time zone 'Europe/London' < config.season_start + make_interval(weeks => config.season_weeks)
      and (
        not config.require_verified_runs
        or exists (
          select 1 from public.activity_evidence ev
          where ev.activity_id = a.id and ev.league_id = league_id_input and ev.status = 'approved'
        )
      )
  ), weekly_ranked as (
    select daily_ranked.*, row_number() over (partition by daily_ranked.user_id, week_start order by points desc, id) as weekly_rank
    from daily_ranked where daily_rank = 1
  ), weekly_totals as (
    select w.user_id, week_start, sum(w.points)::bigint as points, count(*) as run_count
    from weekly_ranked w cross join config where weekly_rank <= config.runs_per_week
    group by w.user_id, week_start
  ), ranked_weeks as (
    select weekly_totals.*, row_number() over (partition by weekly_totals.user_id order by points desc, week_start) as week_rank
    from weekly_totals
  )
  select p.id, p.name, p.initials,
    coalesce(sum(w.points) filter (where w.week_start = date_trunc('week', now() at time zone 'Europe/London')), 0)::bigint,
    coalesce(sum(w.points) filter (where w.week_rank <= greatest(1, config.season_weeks - 2)), 0)::bigint,
    coalesce(sum(w.run_count) filter (where w.week_start = date_trunc('week', now() at time zone 'Europe/London')), 0)::bigint
  from public.league_members lm
  join public.profiles p on p.id = lm.user_id
  cross join config
  left join ranked_weeks w on w.user_id = p.id
  where lm.league_id = league_id_input
  group by p.id, p.name, p.initials
  order by 4 desc, 5 desc, p.name;
end;
$$;

-- Return the verified-league mode in the existing league listing.
drop function if exists public.my_leagues();
create function public.my_leagues()
returns table (
  id uuid, name text, code text, description text, season_weeks integer,
  runs_per_week integer, member_count bigint, role text, created_at timestamptz,
  require_verified_runs boolean
)
language sql security definer set search_path = public
as $$
  select l.id, l.name, l.code, l.description, l.season_weeks, l.runs_per_week,
    (select count(*) from public.league_members all_members where all_members.league_id = l.id),
    mine.role, l.created_at, l.require_verified_runs
  from public.league_members mine
  join public.leagues l on l.id = mine.league_id
  where mine.user_id = auth.uid()
  order by l.created_at desc;
$$;

-- Verified league rules cannot be silently disabled after creation.
create or replace function public.prevent_verified_league_downgrade()
returns trigger language plpgsql security definer set search_path = public as $
begin
  if old.require_verified_runs and not new.require_verified_runs then
    raise exception 'A verified league cannot remove its evidence requirement.';
  end if;
  return new;
end;
$;
drop trigger if exists prevent_verified_league_downgrade on public.leagues;
create trigger prevent_verified_league_downgrade
before update on public.leagues for each row
execute function public.prevent_verified_league_downgrade();

-- An opt-in creation path; old create_league(...) keeps existing semantics.
create or replace function public.create_verified_league(
  league_name text, league_description text, season_weeks_input integer, runs_per_week_input integer
)
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare created jsonb;
begin
  created := public.create_league(league_name, league_description, season_weeks_input, runs_per_week_input);
  update public.leagues
  set require_verified_runs = true
  where id = (created->>'id')::uuid and created_by = auth.uid();
  return created || jsonb_build_object('require_verified_runs', true);
end;
$$;

-- One transaction records the original run and immutable evidence references.
-- The client first uploads 1-2 files to the private bucket. This procedure
-- verifies that both exist, belong to the runner, and haven't been submitted.
create or replace function public.submit_evidenced_run(
  league_id_input uuid,
  run_name_input text,
  occurred_at_input timestamptz,
  distance_km_input numeric,
  elevation_m_input integer,
  elapsed_seconds_input integer,
  training_input boolean,
  screenshot_paths_input text[],
  client_flags_input text[] default '{}',
  detected_elapsed_seconds_input integer default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_activity_id uuid;
  expected_count integer;
  new_flags text[] := coalesce(client_flags_input, '{}'::text[]);
begin
  if auth.uid() is null then raise exception 'Please sign in to submit evidence.'; end if;
  if not exists (select 1 from public.league_members where league_id = league_id_input and user_id = auth.uid()) then
    raise exception 'Join the selected league before submitting a run.';
  end if;
  if cardinality(screenshot_paths_input) not between 1 and 2 or
     cardinality(screenshot_paths_input) <> (select count(distinct x) from unnest(screenshot_paths_input) x) then
    raise exception 'Upload one or two distinct screenshots.';
  end if;
  if not (length(trim(coalesce(run_name_input,''))) between 1 and 120) or
     distance_km_input is null or distance_km_input < 0.1 or distance_km_input > 500 or
     elevation_m_input is null or elevation_m_input < 0 or elevation_m_input > 20000 or
     elapsed_seconds_input is null or elapsed_seconds_input < 1 or elapsed_seconds_input > 604800 or
     occurred_at_input is null or occurred_at_input > now() + interval '5 minutes' then
     raise exception 'Check the run values and date before submitting.';
  end if;
  if cardinality(new_flags) > 10 or exists (select 1 from unnest(new_flags) x where length(x) > 90) then
    raise exception 'Too many review notes.';
  end if;

  expected_count := cardinality(screenshot_paths_input);
  if (select count(*) from storage.objects o
      where o.bucket_id = 'run-evidence'
      and o.name = any(screenshot_paths_input)
      and o.owner_id = auth.uid()::text
      and (storage.foldername(o.name))[1] = auth.uid()::text
     ) <> expected_count then
    raise exception 'The original screenshots must be uploaded by you before submission.';
  end if;
  if exists (
    select 1 from public.activity_evidence ev
    where ev.screenshot_paths && screenshot_paths_input
  ) then raise exception 'One of these screenshots has already been submitted.'; end if;

  if detected_elapsed_seconds_input is null then
    new_flags := array_append(new_flags, 'Elapsed time not recognised automatically');
  elsif abs(detected_elapsed_seconds_input - elapsed_seconds_input) > 3 then
    new_flags := array_append(new_flags, 'Submitted elapsed time differs from OCR');
  end if;

  if exists (
    select 1 from public.activities a
    where a.user_id = auth.uid()
      and abs(extract(epoch from (a.occurred_at - occurred_at_input))) < 600
      and abs(a.distance_km - distance_km_input) < 0.05
  ) then
    new_flags := array_append(new_flags, 'Possible duplicate run near the same time');
  end if;

  insert into public.activities (
    user_id, name, occurred_at, location, source, distance_km, elevation_m, elapsed_seconds, training,
    provider_external_id, points, score
  )
  values (
    auth.uid(), trim(run_name_input), occurred_at_input, 'Strava screenshot', 'Manual',
    distance_km_input, elevation_m_input, elapsed_seconds_input, coalesce(training_input,false),
    'screenshot:' || occurred_at_input::text || ':' || distance_km_input::text || ':' || elapsed_seconds_input::text,
    1, '{}'::jsonb
  )
  returning id into new_activity_id;
  -- The existing enforce_activity_score trigger supplies the authoritative score.

  insert into public.activity_evidence (
    activity_id, league_id, user_id, screenshot_paths, client_flags, detected_elapsed_seconds
  )
  values (
    new_activity_id, league_id_input, auth.uid(), screenshot_paths_input, new_flags,
    detected_elapsed_seconds_input
  );

  return new_activity_id;
end;
$$;

-- Only the creator/owner of the exact league may see or moderate its queue.
create or replace function public.league_evidence_queue(league_id_input uuid)
returns table (
  id uuid, activity_id uuid, runner_id uuid, runner_name text, run_name text,
  occurred_at timestamptz, distance_km numeric, elevation_m integer,
  elapsed_seconds integer, status text, client_flags text[], screenshot_paths text[],
  review_note text, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.leagues where leagues.id = league_id_input and created_by = auth.uid()
  ) then raise exception 'Only this league organiser can review evidence.'; end if;

  return query
  select ev.id, a.id, a.user_id, p.name, a.name, a.occurred_at,
         a.distance_km, a.elevation_m, a.elapsed_seconds, ev.status,
         ev.client_flags, ev.screenshot_paths, ev.review_note, ev.created_at
  from public.activity_evidence ev
  join public.activities a on a.id = ev.activity_id
  join public.profiles p on p.id = ev.user_id
  where ev.league_id = league_id_input
  order by case ev.status when 'pending' then 0 when 'rejected' then 1 else 2 end, ev.created_at desc
  limit 200;
end;
$$;

create or replace function public.review_run_evidence(
  evidence_id_input uuid, decision_input text, note_input text default ''
)
returns void language plpgsql security definer set search_path = public as $$
declare target_league uuid;
begin
  if decision_input is null or decision_input not in ('approved', 'rejected') then
    raise exception 'The decision must be approved or rejected.';
  end if;
  if length(coalesce(note_input,'')) > 400 then raise exception 'Review note too long.'; end if;
  select ev.league_id into target_league
  from public.activity_evidence ev where ev.id = evidence_id_input for update;
  if target_league is null or not exists (
    select 1 from public.leagues l where l.id = target_league and l.created_by = auth.uid()
  ) then raise exception 'You cannot moderate this run.'; end if;

  update public.activity_evidence set
    status = decision_input, review_note = coalesce(note_input,''),
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = evidence_id_input;
end;
$$;

-- A previously approved activity cannot be edited to inflate points.
create or replace function public.prevent_evidenced_run_edits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated'
    and exists (select 1 from public.activity_evidence ev where ev.activity_id = old.id)
  then raise exception 'An evidenced run is locked. Ask the league organiser to review a correction.'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists prevent_evidenced_run_edits on public.activities;
create trigger prevent_evidenced_run_edits
before update or delete on public.activities for each row
execute function public.prevent_evidenced_run_edits();

revoke execute on function public.league_table(uuid), public.my_leagues(),
  public.create_verified_league(text,text,integer,integer),
  public.submit_evidenced_run(uuid,text,timestamptz,numeric,integer,integer,boolean,text[],text[],integer),
  public.league_evidence_queue(uuid), public.review_run_evidence(uuid,text,text),
  public.prevent_evidenced_run_edits(), public.prevent_verified_league_downgrade()
from public, anon;
revoke execute on function public.prevent_evidenced_run_edits(), public.prevent_verified_league_downgrade() from authenticated;
grant execute on function public.league_table(uuid), public.my_leagues(),
  public.create_verified_league(text,text,integer,integer),
  public.submit_evidenced_run(uuid,text,timestamptz,numeric,integer,integer,boolean,text[],text[],integer),
  public.league_evidence_queue(uuid), public.review_run_evidence(uuid,text,text)
to authenticated;

commit;
