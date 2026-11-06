-- Run Plans v1: private scheduled runs inside existing RunningLeague leagues.
-- Apply to an existing project once through the Supabase SQL editor.
-- This migration does not change any existing scoring or activity tables.

create table if not exists public.run_plans (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 100),
  starts_at timestamptz not null,
  meeting_point text not null check (char_length(trim(meeting_point)) between 2 and 200),
  distance_km numeric(6,2) check (distance_km > 0 and distance_km <= 200),
  pace_seconds_per_km integer check (pace_seconds_per_km between 150 and 1200),
  notes text not null default '' check (char_length(notes) <= 1000),
  series_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists run_plans_league_time on public.run_plans(league_id, starts_at);

create table if not exists public.run_plan_attendees (
  plan_id uuid not null references public.run_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create index if not exists run_plan_attendees_user on public.run_plan_attendees(user_id);

alter table public.run_plans enable row level security;
alter table public.run_plan_attendees enable row level security;

drop policy if exists "League members view planned runs" on public.run_plans;
create policy "League members view planned runs"
  on public.run_plans for select to authenticated using (
    exists (
      select 1 from public.league_members membership
      where membership.league_id = run_plans.league_id
        and membership.user_id = (select auth.uid())
    )
  );

drop policy if exists "League members create their planned runs" on public.run_plans;
create policy "League members create their planned runs"
  on public.run_plans for insert to authenticated with check (
    created_by = (select auth.uid())
    and starts_at > now()
    and exists (
      select 1 from public.league_members membership
      where membership.league_id = run_plans.league_id
        and membership.user_id = (select auth.uid())
    )
  );

drop policy if exists "Hosts edit their planned runs" on public.run_plans;
create policy "Hosts edit their planned runs"
  on public.run_plans for update to authenticated
  using (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.league_members membership
      where membership.league_id = run_plans.league_id
        and membership.user_id = (select auth.uid())
    )
  )
  with check (
    created_by = (select auth.uid())
    and starts_at > now()
    and exists (
      select 1 from public.league_members membership
      where membership.league_id = run_plans.league_id
        and membership.user_id = (select auth.uid())
    )
  );

drop policy if exists "Hosts cancel their planned runs" on public.run_plans;
create policy "Hosts cancel their planned runs"
  on public.run_plans for delete to authenticated using (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.league_members membership
      where membership.league_id = run_plans.league_id
        and membership.user_id = (select auth.uid())
    )
  );

drop policy if exists "Members view planned run attendees" on public.run_plan_attendees;
create policy "Members view planned run attendees"
  on public.run_plan_attendees for select to authenticated using (
    exists (
      select 1 from public.run_plans plan
      join public.league_members membership on membership.league_id = plan.league_id
      where plan.id = run_plan_attendees.plan_id
        and membership.user_id = (select auth.uid())
    )
  );

drop policy if exists "Members join planned runs" on public.run_plan_attendees;
create policy "Members join planned runs"
  on public.run_plan_attendees for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.run_plans plan
      join public.league_members membership on membership.league_id = plan.league_id
      where plan.id = run_plan_attendees.plan_id
        and plan.starts_at > now()
        and membership.user_id = (select auth.uid())
    )
  );

drop policy if exists "Members leave planned runs" on public.run_plan_attendees;
create policy "Members leave planned runs"
  on public.run_plan_attendees for delete to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.run_plans plan
      join public.league_members membership on membership.league_id = plan.league_id
      where plan.id = run_plan_attendees.plan_id
        and membership.user_id = (select auth.uid())
    )
  );

-- Prevent edits that reassign a planned run (and its attendees) to another group.
create or replace function public.keep_run_plan_identity()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.league_id is distinct from old.league_id
     or new.created_by is distinct from old.created_by
     or new.series_id is distinct from old.series_id then
    raise exception 'A planned run cannot be moved to another group or organiser.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists keep_run_plan_identity on public.run_plans;
create trigger keep_run_plan_identity
  before update on public.run_plans for each row
  execute function public.keep_run_plan_identity();

-- Hosts are automatically shown as attending; no extra client write is needed.
create or replace function public.auto_join_run_plan_host()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.run_plan_attendees(plan_id, user_id)
  values (new.id, new.created_by);
  return new;
end;
$$;

drop trigger if exists auto_join_run_plan_host on public.run_plans;
create trigger auto_join_run_plan_host
  after insert on public.run_plans for each row
  execute function public.auto_join_run_plan_host();

create or replace function public.keep_run_plan_host_attending()
returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from public.run_plans plan
    where plan.id = old.plan_id and plan.created_by = old.user_id
  ) then
    raise exception 'The organiser cannot leave their own run. Cancel the run instead.';
  end if;
  return old;
end;
$$;

drop trigger if exists keep_run_plan_host_attending on public.run_plan_attendees;
create trigger keep_run_plan_host_attending
  before delete on public.run_plan_attendees for each row
  execute function public.keep_run_plan_host_attending();

-- Profiles remain private under their existing RLS policies. This function
-- reveals only the names of hosts and attendees within a league the caller
-- belongs to. Non-members cannot enumerate plans, meeting points or names.
create or replace function public.list_run_plans(
  league_id_input uuid,
  range_start timestamptz,
  range_end timestamptz
)
returns jsonb
language plpgsql
stable security definer set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.league_members membership
    where membership.league_id = league_id_input
      and membership.user_id = auth.uid()
  ) then
    raise exception 'You are not a member of this league.';
  end if;

  if range_start is null or range_end is null
     or range_end <= range_start
     or range_end - range_start > interval '65 days' then
    raise exception 'Choose a valid calendar range of up to 65 days.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', plan.id,
      'leagueId', plan.league_id,
      'createdBy', plan.created_by,
      'hostName', host.name,
      'title', plan.title,
      'startsAt', plan.starts_at,
      'meetingPoint', plan.meeting_point,
      'distanceKm', plan.distance_km,
      'paceSecondsPerKm', plan.pace_seconds_per_km,
      'notes', plan.notes,
      'seriesId', plan.series_id,
      'attendees', (
        select coalesce(jsonb_agg(
          jsonb_build_object('userId', attendee.user_id, 'name', person.name)
          order by person.name
        ), '[]'::jsonb)
        from public.run_plan_attendees attendee
        join public.profiles person on person.id = attendee.user_id
        where attendee.plan_id = plan.id
      )
    ) order by plan.starts_at, plan.id), '[]'::jsonb)
    into result
    from public.run_plans plan
    join public.profiles host on host.id = plan.created_by
    where plan.league_id = league_id_input
      and plan.starts_at >= range_start and plan.starts_at < range_end;

  return result;
end;
$$;

revoke all on public.run_plans, public.run_plan_attendees from anon;
grant select, insert, update, delete on public.run_plans, public.run_plan_attendees to authenticated;
revoke execute on function public.list_run_plans(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.list_run_plans(uuid,timestamptz,timestamptz) to authenticated;
revoke execute on function public.keep_run_plan_identity(), public.auto_join_run_plan_host(),
  public.keep_run_plan_host_attending() from public, anon, authenticated;
