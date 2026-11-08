# Running League — project status

Last reviewed: 8 November 2026

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

## Friends-only verified-screenshot league pilot (PR #3 — DRAFT, NOT LIVE)

- Introduces one- or two-image Strava proof with browser-local OCR, cross-screen discrepancies, possible duplicate flags and manual confirmation of **elapsed time**. Original screenshots are uploaded to a **private Supabase Storage bucket**, unlike the earlier importer that did not retain screenshots.
- Runners choose a league. Submitted screenshots and captured metrics go into a **pending** review queue. The organiser can see only evidence belonging to the exact league they created, through 3-minute signed image URLs, and can approve/reject with notes. Screenshot URLs are not public.
- New leagues default to selecting **Require verified run evidence**. In these leagues, server-side league_table includes only activities with approved evidence for that league, regardless of how someone entered the activity. Existing leagues default to unchanged rules. A verified league cannot downgrade verification, and evidenced activity metrics are locked from edits.
- RunningScore v1.0 **has not changed**. Individual run scores are still calculated; strict league ranking treats pending, rejected and unverified runs as ineligible.
- All new features are committed in feature/verified-screenshot-leagues and draft PR #3; tests/lint/build/API typecheck succeeded on the branch. **No private evidence migration has been applied to production**. The Supabase connector denied permission to modify the live project, so this PR must NOT be merged yet.
- Retained images contain potentially sensitive routes/location and take Storage space. Free only within plan quotas. Screenshot evidence remains human-verifiable but is **not cheat-proof**. No direct Strava/Garmin API or paid AI integration is active.

### Release blockers

1. Review and apply supabase/verified-screenshot-leagues.sql in a non-production environment, test activity evidence and Storage RLS for owner, member, other league creator and nonmember.
2. Run supabase/tests/verified-evidence-security.sql and real bucket upload / signed-link / delete tests.
3. Gain authorised access and apply database changes to the live Supabase project before merging PR #3; verify rollback/recovery plan.
4. Test two real accounts end-to-end and finish production SMTP email confirmation/recovery setup.
5. Test original Strava screenshots from different phones and layouts, along with actual organiser approval/rejection and live league-table eligibility.
6. Only then merge and verify Vercel production deployment.

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

## Deferred / out of scope for this milestone

- direct Garmin integration until approval;
- Strava activation unless explicitly prioritised;
- major scoring redesign;
- broad social/community expansion.

## Handoff notes

Do not add new product scope until account/email onboarding is proven. Preserve the existing scoring and privacy model.
