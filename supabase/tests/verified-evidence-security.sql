-- Run after verified-screenshot-leagues.sql in a non-production project.
-- All fixtures and role changes are rolled back.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
('91111111-1111-4111-8111-111111111111','proof-owner@runningleague.test','{"full_name":"Proof Owner"}'),
('92222222-2222-4222-8222-222222222222','proof-runner@runningleague.test','{"full_name":"Proof Runner"}'),
('93333333-3333-4333-8333-333333333333','proof-stranger@runningleague.test','{"full_name":"Stranger"}');

-- The owner creates a verified league and the runner joins it.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select public.create_verified_league('Private proof test','Rolled back',10,3);
reset role;
select set_config('test.proof_league',(select id::text from public.leagues where name='Private proof test'),true);
select set_config('test.proof_code',(select code from public.leagues where name='Private proof test'),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"92222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
select public.join_league(current_setting('test.proof_code'));
-- A plain manual run must not score in the verified league.
insert into public.activities(user_id,name,occurred_at,source,distance_km,elevation_m,elapsed_seconds,score,points)
values ('92222222-2222-4222-8222-222222222222','Unproved run',now(),'Manual',5,0,1300,'{}',25);
do $$ begin
 assert (select require_verified_runs from public.my_leagues() limit 1), 'New verified league flag missing';
 assert (select weekly_points from public.league_table(current_setting('test.proof_league')::uuid) where user_id=auth.uid()) = 0,
   'A plain Manual run must never score in a verified league';
end $$;

-- Admin setup of a reference evidence record, without writing real Storage metadata.
reset role;
insert into public.activities(user_id,name,occurred_at,source,distance_km,elevation_m,elapsed_seconds,score,points)
values ('92222222-2222-4222-8222-222222222222','Screenshot test run',now(),'Manual',5,0,1200,'{}',25);
insert into public.activity_evidence(activity_id,league_id,user_id,screenshot_paths,client_flags)
values (
 (select id from public.activities where name='Screenshot test run'),
 current_setting('test.proof_league')::uuid,
 '92222222-2222-4222-8222-222222222222',
 array['92222222-2222-4222-8222-222222222222/dummy/overview.png'],
 array['Manual checking required']
);
select set_config('test.proof_id',(select id::text from public.activity_evidence limit 1),true);
do $$ begin
 assert (select public = false from storage.buckets where id='run-evidence'), 'Bucket must stay private';
 assert (select status from public.activity_evidence limit 1) = 'pending', 'Evidence must default to pending';
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"92222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
 assert (select count(*) from public.activity_evidence) = 1, 'Runner must view their evidence metadata';
 assert (select weekly_points from public.league_table(current_setting('test.proof_league')::uuid) where user_id=auth.uid()) = 0,
   'Pending evidence must not count';
 begin
   update public.activity_evidence set status='approved';
   raise exception 'Runner unexpectedly updated evidence status';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.review_run_evidence(current_setting('test.proof_id')::uuid,'approved','');
   raise exception 'Runner unexpectedly moderated their own proof';
 exception when raise_exception then
   if sqlerrm <> 'You cannot moderate this run.' then raise; end if;
 end;
 begin
   update public.activities set elapsed_seconds=900 where name='Screenshot test run';
   raise exception 'Runner altered an evidenced run';
 exception when raise_exception then
   if sqlerrm not like 'An evidenced run is locked%' then raise; end if;
 end;
end $$;

-- Unrelated users cannot see proof metadata, photos, or moderator queue.
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"93333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
select public.create_verified_league('Unrelated proof group','Separate organiser',10,3);
do $ begin
 assert (select count(*) from public.activity_evidence) = 0, 'Proof metadata leaked to a stranger';
 begin
   perform public.league_evidence_queue(current_setting('test.proof_league')::uuid);
   raise exception 'Stranger accessed review queue';
 exception when raise_exception then
   if sqlerrm <> 'Only this league organiser can review evidence.' then raise; end if;
 end;
end $$;

-- The exact league creator can approve, after which only the proved activity scores.
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
 assert (select count(*) from public.league_evidence_queue(current_setting('test.proof_league')::uuid)) = 1, 'Owner cannot review queue';
 assert (select count(*) from public.activity_evidence) = 1, 'Owner cannot see evidence metadata';
end $$;
select public.review_run_evidence(current_setting('test.proof_id')::uuid,'approved','Elapsed time visible');
do $$ begin
 assert (select status from public.activity_evidence limit 1) = 'approved', 'Review did not save';
 assert (select weekly_points from public.league_table(current_setting('test.proof_league')::uuid)
         where user_id='92222222-2222-4222-8222-222222222222') > 0, 'Approved proof not counted';
end $$;
select public.review_run_evidence(current_setting('test.proof_id')::uuid,'rejected','Elapsed time not visible');
do $$ begin
 assert (select weekly_points from public.league_table(current_setting('test.proof_league')::uuid)
         where user_id='92222222-2222-4222-8222-222222222222') = 0, 'Rejected proof counted';
end $$;
rollback;
select 'PASS: verified league gate, owner-only approval, immutable proof, and per-runner privacy' as result;
