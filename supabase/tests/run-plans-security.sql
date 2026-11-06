-- Run Plans security integration test. Requires 20261106_run_plans.sql.
-- All fixtures are discarded at the end.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
('33333333-3333-4333-8333-333333333333','runplans-a@runningleague.test','{"full_name":"Run Plan Host"}'),
('44444444-4444-4444-8444-444444444444','runplans-b@runningleague.test','{"full_name":"Run Plan Guest"}');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
select public.create_league('Run Plans test','Private test group',10,3);

insert into public.run_plans (league_id, created_by, title, starts_at, meeting_point, distance_km)
select id,'33333333-3333-4333-8333-333333333333','Sunday miles',now() + interval '7 days','Private test meeting point',8
from public.my_leagues() limit 1;

do $$
begin
  assert (select count(*) from public.run_plans) = 1, 'Host must be able to create a plan';
  assert (select count(*) from public.run_plan_attendees) = 1, 'Host must join automatically';
  assert jsonb_array_length(public.list_run_plans((select id from public.my_leagues() limit 1), now(), now() + interval '30 days')) = 1,
    'Host must be able to view their private plan';
end
$$;

delete from public.run_plan_attendees
where user_id = '33333333-3333-4333-8333-333333333333';
do $
begin
  assert (select count(*) from public.run_plan_attendees) = 1,
    'Host must not leave their own plan';
end
$;

reset role;
select set_config('running_league.runplans_league',
  (select id::text from public.leagues where name = 'Run Plans test' limit 1),true);
select set_config('running_league.runplans_code',
  (select code from public.leagues where name = 'Run Plans test' limit 1),true);
select set_config('running_league.runplans_id',
  (select id::text from public.run_plans where title = 'Sunday miles' limit 1),true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
do $$
begin
  assert (select count(*) from public.run_plans) = 0, 'Nonmember must not see planned runs';
  assert (select count(*) from public.run_plan_attendees) = 0, 'Nonmember must not see attendance';
  begin
    perform public.list_run_plans(current_setting('running_league.runplans_league')::uuid, now(), now() + interval '30 days');
    raise exception 'Nonmember unexpectedly read Run Plans';
  exception when raise_exception then
    if sqlerrm <> 'You are not a member of this league.' then raise; end if;
  end;

  begin
    insert into public.run_plan_attendees(plan_id,user_id)
    values (current_setting('running_league.runplans_id')::uuid, '44444444-4444-4444-8444-444444444444');
    raise exception 'Nonmember unexpectedly joined a run';
  exception when insufficient_privilege then null;
  end;
end
$$;

select public.join_league(current_setting('running_league.runplans_code'));

do $$
begin
  assert jsonb_array_length(public.list_run_plans(current_setting('running_league.runplans_league')::uuid,
    now(), now() + interval '30 days')) = 1, 'Members must see shared plans';

  begin
    insert into public.run_plan_attendees(plan_id,user_id)
    values (current_setting('running_league.runplans_id')::uuid, '33333333-3333-4333-8333-333333333333');
    raise exception 'Another user could be impersonated';
  exception when insufficient_privilege then null;
  end;
end
$$;

insert into public.run_plan_attendees(plan_id,user_id)
values (current_setting('running_league.runplans_id')::uuid, '44444444-4444-4444-8444-444444444444');

do $$
begin
  assert (select count(*) from public.run_plan_attendees) = 2, 'Guest must be able to join';
end
$$;

delete from public.run_plans where id = current_setting('running_league.runplans_id')::uuid;
do $$
begin
  assert (select count(*) from public.run_plans) = 1, 'Guest must not delete the host run';
end
$$;

rollback;
select 'PASS: Run Plans visibility, RSVP ownership and deletion protection' as result;
