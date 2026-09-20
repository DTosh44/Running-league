-- Transactional integration test: fixtures are always rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('11111111-1111-4111-8111-111111111111','runner-a@runningleague.test','{"full_name":"Test Runner A"}'),
('22222222-2222-4222-8222-222222222222','runner-b@runningleague.test','{"full_name":"Test Runner B"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select public.create_league('Integration test','Disposable transaction',10,3);
insert into public.activities(user_id,name,occurred_at,source,distance_km,elevation_m,elapsed_seconds,score,points)
values ('11111111-1111-4111-8111-111111111111','Benchmark',now()-interval '1 minute','Manual',5,0,1221,'{"forged":true}',25);
do $$ begin
  assert (select points from public.activities limit 1) = 20, 'Server must override forged points';
  assert (select count(*) from public.profiles) = 1, 'Only own profile visible';
  assert (select weekly_points from public.league_table((select id from public.my_leagues() limit 1))) = 20, 'League score must match';
end $$;
reset role;
select set_config('running_league.test_code',(select code from public.leagues where name='Integration test' limit 1),true);
select set_config('running_league.test_id',(select id::text from public.leagues where name='Integration test' limit 1),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
  assert (select count(*) from public.activities) = 0, 'Other runners activities must remain private';
  assert (select count(*) from public.my_leagues()) = 0, 'Nonmembers cannot discover leagues';
  begin
    perform public.league_table(current_setting('running_league.test_id')::uuid);
    raise exception 'Nonmember accessed league table';
  exception when raise_exception then
    if sqlerrm <> 'You are not a member of this league.' then raise; end if;
  end;
  begin
    insert into public.activities(user_id,name,occurred_at,source,distance_km,elevation_m,elapsed_seconds,score,points)
    values ('11111111-1111-4111-8111-111111111111','Spoofed',now(),'Manual',5,0,1221,'{}',25);
    raise exception 'Cross-user insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
select public.join_league(current_setting('running_league.test_code'));
do $$ begin
  assert (select count(*) from public.league_table(current_setting('running_league.test_id')::uuid)) = 2, 'Shared league must show both members';
  assert (select count(*) from public.activities) = 0, 'Joining must not expose private activity details';
  assert (select member_count from public.my_leagues() limit 1) = 2, 'Member count must update';
end $$;
rollback;
select 'PASS: server scoring, private data, league permissions and joining' as result;
