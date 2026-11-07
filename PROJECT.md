# Running League — project status

Last reviewed: 7 November 2026

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

## Friends-only screenshot pilot (proposed change, pending deployment)

- New Strava screenshot importer on branch feature/strava-screenshot-import; **not yet deployed or verified on real screenshots**.
- Free browser-based Tesseract.js OCR, with confirmation of distance, elevation, date and **elapsed** time before saving; screenshot image is not retained.
- No paid Strava credentials, backend OCR usage, database schema change or RunningScore v1.0 changes needed.
- Screenshots are recorded using the existing Manual database source plus a screenshot-prefixed external ID. The frontend displays the screenshot origin; exact duplicate submissions get a uniqueness check. This is not a fraud-proof verification system.
- Review and test on actual UK Strava screenshot layouts, iPhone/Android browsers, and two separate real league accounts before release.
- SMTP/email onboarding remains a separate launch blocker. This feature does not make the app ready for friends to sign up by itself.

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
