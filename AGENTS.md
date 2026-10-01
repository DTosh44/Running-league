# Running League — repository instructions

## Read first

Before significant work, read `AGENTS.md`, `PROJECT.md`, `README.md`, then inspect the relevant Supabase/API/UI code.

## Product boundary

Running League is a private running-league and personalised race-plan beta. The current milestone is reliable public-beta account onboarding, not feature expansion.

## Security and production data

- Never expose Supabase service-role or Strava secrets in client variables.
- Preserve RLS and server-side score integrity.
- Do not weaken league/privacy isolation to simplify UI behaviour.
- Treat production Supabase data as stateful; do not reset or reseed live data casually.
- Do not claim Strava or Garmin direct integrations are live until their external setup and end-to-end tests are complete.

## Scoring

The current scoring system is RunningScore v1.0. Any change to scoring rules is a product decision and must be recorded in `PROJECT.md` before implementation because it can change league outcomes.

## Engineering

Run relevant lint/tests/build/API type checks for material changes. Preserve FIT/GPX import and manual-run paths even while provider integrations are unavailable.

## Documentation is part of done

Update `PROJECT.md` when launch readiness, auth/email state, provider readiness, scoring rules, deployment state or the current milestone changes.

## Handoff

Read `PROJECT.md` first and update it last.
