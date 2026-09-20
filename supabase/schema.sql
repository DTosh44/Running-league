-- RunningLeague public beta schema. Run once in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  initials text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  code text not null unique,
  description text not null default '',
  season_weeks integer not null default 10 check (season_weeks between 1 and 52),
  runs_per_week integer not null default 3 check (runs_per_week between 1 and 7),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  occurred_at timestamptz not null,
  location text not null default '',
  source text not null check (source in ('Manual', 'GPX upload', 'FIT upload', 'Strava', 'Garmin')),
  distance_km numeric(8,3) not null check (distance_km > 0 and distance_km <= 500),
  elevation_m integer not null default 0 check (elevation_m >= 0),
  elapsed_seconds integer not null check (elapsed_seconds > 0),
  training boolean not null default false,
  provider_external_id text,
  score jsonb not null,
  points integer not null check (points between 1 and 25),
  created_at timestamptz not null default now(),
  unique (user_id, provider_external_id)
);

create table if not exists public.training_plans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan jsonb,
  completed_sessions text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  weekly_email boolean not null default true,
  league_notifications boolean not null default true,
  public_profile boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_connections (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  external_user_id text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.oauth_states (
  state text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null check (char_length(email) between 5 and 254),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Runner');
  insert into public.profiles (id, name, initials)
  values (
    new.id,
    display_name,
    coalesce(new.raw_user_meta_data->>'initials', upper(left(display_name, 2)))
  );
  insert into public.preferences (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.create_league(
  league_name text,
  league_description text,
  season_weeks_input integer,
  runs_per_week_input integer
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  created public.leagues;
  invite_code text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  loop
    invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    exit when not exists (select 1 from public.leagues where code = invite_code);
  end loop;
  insert into public.leagues (name, code, description, season_weeks, runs_per_week, created_by)
  values (trim(league_name), invite_code, trim(coalesce(league_description, '')), season_weeks_input, runs_per_week_input, auth.uid())
  returning * into created;
  insert into public.league_members (league_id, user_id, role) values (created.id, auth.uid(), 'owner');
  return to_jsonb(created) || jsonb_build_object('member_count', 1);
end;
$$;

create or replace function public.join_league(join_code text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select id into target_id from public.leagues where code = upper(trim(join_code));
  if target_id is null then raise exception 'No league was found for that invite code.'; end if;
  insert into public.league_members (league_id, user_id, role)
  values (target_id, auth.uid(), 'member') on conflict do nothing;
end;
$$;

create or replace function public.my_leagues()
returns table (id uuid, name text, code text, description text, season_weeks integer, runs_per_week integer, member_count bigint, role text, created_at timestamptz)
language sql
security definer set search_path = public
as $$
  select l.id, l.name, l.code, l.description, l.season_weeks, l.runs_per_week,
    (select count(*) from public.league_members all_members where all_members.league_id = l.id) as member_count,
    mine.role, l.created_at
  from public.league_members mine
  join public.leagues l on l.id = mine.league_id
  where mine.user_id = auth.uid()
  order by l.created_at desc;
$$;

create or replace function public.league_table(league_id_input uuid)
returns table (user_id uuid, name text, initials text, weekly_points bigint, season_points bigint, runs bigint)
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.league_members where league_id = league_id_input and league_members.user_id = auth.uid()) then
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

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.activities enable row level security;
alter table public.training_plans enable row level security;
alter table public.preferences enable row level security;
alter table public.provider_connections enable row level security;
alter table public.oauth_states enable row level security;
alter table public.support_requests enable row level security;

drop policy if exists "Authenticated users can view runner profiles" on public.profiles;
create policy "Authenticated users can view runner profiles" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Members can view leagues" on public.leagues;
create policy "Members can view leagues" on public.leagues for select to authenticated using (exists (select 1 from public.league_members where league_id = leagues.id and user_id = auth.uid()));
drop policy if exists "Owners can update leagues" on public.leagues;
create policy "Owners can update leagues" on public.leagues for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "Authenticated users can view memberships" on public.league_members;
drop policy if exists "Users can view their memberships" on public.league_members;
create policy "Users can view their memberships" on public.league_members for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can view relevant activities" on public.activities;
create policy "Users can view relevant activities" on public.activities for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users can add their activities" on public.activities;
create policy "Users can add their activities" on public.activities for insert to authenticated with check (user_id = auth.uid() and source in ('Manual', 'GPX upload', 'FIT upload'));
drop policy if exists "Users can update their activities" on public.activities;
create policy "Users can update their activities" on public.activities for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their activities" on public.activities;
create policy "Users can delete their activities" on public.activities for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Users manage their training plan" on public.training_plans;
create policy "Users manage their training plan" on public.training_plans for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users manage their preferences" on public.preferences;
create policy "Users manage their preferences" on public.preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Anyone can submit support requests" on public.support_requests;
create policy "Anyone can submit support requests" on public.support_requests for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());

grant execute on function public.create_league(text, text, integer, integer) to authenticated;
grant execute on function public.join_league(text) to authenticated;
grant execute on function public.my_leagues() to authenticated;
grant execute on function public.league_table(uuid) to authenticated;

-- All scores are derived by the database; clients cannot submit arbitrary points.
create or replace function public.score_activity()
returns trigger language plpgsql set search_path = public as $$
declare effort double precision; speed double precision; performance double precision; pts integer; band text;
begin
  if new.occurred_at > now() + interval '5 minutes' then raise exception 'Runs cannot be dated in the future.'; end if;
  if new.elevation_m > 20000 or new.elapsed_seconds > 604800 then raise exception 'Activity values are outside the supported range.'; end if;
  if auth.role() = 'authenticated' and new.source in ('Strava', 'Garmin') then
    raise exception 'Provider activities can only be written by the sync service.';
  end if;
  effort := new.distance_km + new.elevation_m / 100.0;
  speed := effort * 1000 / new.elapsed_seconds;
  performance := 100 * speed / (5000.0 / 1221) * power(effort / 5, 0.06);
  pts := greatest(1, least(25, floor((performance - 60) / 2 + 0.5)::integer));
  band := case when pts <= 5 then 'Gentle' when pts <= 10 then 'Easy' when pts <= 15 then 'Solid' when pts <= 20 then 'Strong' when pts <= 24 then 'Outstanding' else 'Peak performance' end;
  new.points := pts;
  new.score := jsonb_build_object('points', pts, 'band', band, 'performanceIndex', performance, 'effortDistanceKm', effort,
    'normalizedPaceSecondsPerKm', 1000 / speed, 'intervalUplift', 0, 'version', 'RunningScore v1.0');
  return new;
end; $$;
drop trigger if exists enforce_activity_score on public.activities;
create trigger enforce_activity_score before insert or update on public.activities for each row execute function public.score_activity();

create or replace function public.sync_profile_metadata()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set name = coalesce(new.raw_user_meta_data->>'full_name', name),
    initials = coalesce(new.raw_user_meta_data->>'initials', initials) where id = new.id;
  return new;
end; $$;
drop trigger if exists sync_profile_metadata on auth.users;
create trigger sync_profile_metadata after update of raw_user_meta_data on auth.users for each row execute function public.sync_profile_metadata();

revoke all on public.provider_connections, public.oauth_states from anon, authenticated;
revoke execute on function public.create_league(text,text,integer,integer), public.join_league(text), public.my_leagues(), public.league_table(uuid) from public, anon;
revoke execute on function public.handle_new_user(), public.sync_profile_metadata(), public.score_activity() from public, anon, authenticated;
create index if not exists activities_user_date on public.activities(user_id, occurred_at);
create index if not exists league_members_user on public.league_members(user_id);
