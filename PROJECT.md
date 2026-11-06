# Running League — project status

Last reviewed: 6 November 2026

## Purpose

Provide fair private running leagues with transparent run scoring plus personalised race plans.

## Current state

A deployed beta exists with Supabase-backed accounts, profiles, activities, leagues and training plans. Manual runs, GPX/FIT import and league scoring are implemented.

Public launch is currently blocked by email-delivery readiness and external provider setup.

## What works

- Email/password accounts and recovery through Supabase Auth.
- Persistent profiles, activities, leagues and plans.
- Private league creation and invite-code joining.
- Weekly/season league tables.
- RunningScore calculation.
- Manual run entry.
- GPX and Garmin-compatible FIT imports.
- Race-plan generation and completion tracking.
- Profile/support/privacy/beta terms.
- Responsive UI.
- Security tests for score tampering, privacy and league isolation.

## Live / deployment status

Production beta: `https://running-league-alpha.vercel.app/`

The deployed environment is not yet ready for broad public signup.

## Current milestone

**Make real customer signup, confirmation, login and recovery reliable enough for public beta.**

## Key decisions

- RunningScore v1.0 is the current scoring model.
- Default leagues use up to three scoring runs per week and one scoring run per day.
- Garmin file import is a supported fallback even without direct Garmin API access.

## Current blockers / dependencies

- Configure a custom SMTP sender in Supabase.
- Verify signup, confirmation, login and recovery with two real accounts.
- Strava API app/provider activation remains unavailable until external setup/payment.
- Garmin direct API requires partner approval.

## Next actions

1. Configure production SMTP.
2. Test signup and email confirmation with two independent real accounts.
3. Test password recovery.
4. Verify league invite/join and score isolation with those accounts.
5. Decide whether Strava setup is required for this beta milestone or can remain deferred.

## Run Plans feature branch (not deployed)

An explicit new product request is being developed separately on `feature/run-plans` without changing league scoring. Private league members can post planned runs, view day/week/month calendars (week by default), invite others through an authenticated deep link, join/leave runs, and create weekly repeats covering four or eight weeks. Hosts can change or cancel individual occurrences. Planned runs are not completed activities and **do not change RunningScore, league points or training plans**.

**Deployment requirement:** Apply `supabase/migrations/20261106_run_plans.sql` to the existing Supabase project *before* deploying a build that exposes Run Plans. This is additive and does not reset production tables. Verify the migration with `supabase/tests/run-plans-security.sql`, then test group privacy and attendance with two real accounts. Demo-only mode stores its plans locally in the browser; it cannot coordinate across different devices.

Not included in v1: automated reminders, live WhatsApp sending, an independent non-league group system, open/public discovery, and indefinite weekly recurrence. WhatsApp sharing opens the user's WhatsApp composer; it does not send messages automatically. No claim is made that the feature is live or end-to-end tested.

## Deferred / out of scope for this milestone

- direct Garmin integration until approval;
- Strava activation unless explicitly prioritised;
- major scoring redesign;
- broad social/community expansion.

## Handoff notes

Do not add new product scope until account/email onboarding is proven. Preserve the existing scoring and privacy model.
