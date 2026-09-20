# RunningLeague

A responsive free-beta running product for fair private leagues, transparent activity scoring and personalised race plans.

## Deployment status — 20 September 2026

Production: https://running-league-alpha.vercel.app/

The Supabase project `ekwoofmnisflegyfhosn` is provisioned in the Better Here organisation (EU/Ireland). Schema, row-level access, server scoring and Vercel production configuration are installed.

**Public launch is blocked on email delivery and provider activation.** Configure a custom SMTP sender in Supabase before inviting customers: the default sender only emails project-team addresses. Email confirmation remains enabled. Then verify signup, confirmation, login and recovery end to end with two real test accounts.

Strava code is present but inactive. The connected account's API settings require a paid subscription before app creation. No subscription was purchased, no Strava API app created, and no Garmin partner application submitted. The profile page reports unavailable connections accurately.

## Implemented beta journeys

- Secure email/password accounts, email confirmation and password recovery through Supabase Auth
- Persistent profiles, activities, leagues and training plans with row-level database security
- Create private leagues, share an invite code and join a league
- Live weekly and season league tables
- Enter a run manually and calculate its RunningScore immediately
- Import GPX and Garmin-compatible FIT activity files in the browser
- Strava OAuth and on-demand import code, awaiting credentials and end-to-end verification (up to 100 recent activities per sync)
- Generate a 4–24 week race plan and mark individual sessions complete
- Profile editing, support form, privacy policy and beta terms
- Responsive desktop, tablet and mobile layouts

Garmin's direct API requires partner approval. Garmin users can use the working FIT-file import without a direct Garmin connection.

## Cloud setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor.
3. In Supabase Auth URL Configuration, set the site URL to the production URL and add these redirect URLs:
   - `https://your-domain/app`
   - `https://your-domain/reset-password`
4. Copy `.env.example` values into the corresponding Vercel project environment variables.
5. Create a Strava API application with this callback domain and route:
   - Authorisation callback domain: your production domain without `https://`
   - Redirect route used by the app: `/api/strava/callback`

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `STRAVA_CLIENT_SECRET` using a `VITE_` variable.

## Scoring methodology

The current implementation is `RunningScore v1.0`:

1. Effort distance is `distance km + elevation metres / 100`.
2. Elapsed time is used, so stops and recoveries remain part of the activity.
3. Live manual, GPX, FIT and Strava imports currently use activity totals. The scoring module also supports pace blocks, but the import pipelines do not supply them.
4. A Riegel exponent of 1.06 adjusts for distance.
5. The benchmark is a 20:21 5K, worth approximately 20 points.
6. Performance index converts to 1–25 points using `(index - 60) / 2`, rounded and capped.

League defaults are three scoring runs per week, a maximum of one scoring run per day, and a ten-week season. The database computes scores from run metrics, selects the best run per UK calendar day, applies the configured weekly cap, and counts the best eight of ten weeks. Custom seasons omit the lowest two weeks (minimum one counted week). The first season week starts on the Monday of league creation.

## Local development

In development and tests only, without environment variables, the product permits the fixed demo account. Registration requires Supabase and never stores plaintext passwords. A production build without cloud configuration rejects login:

- Email: `darren@runningleague.demo`
- Password: `Demo123!`

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm test
npm run build
npx tsc --ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck api/strava/*.ts
```

## Operational checks

- `supabase/tests/security.sql` runs temporary fixtures in a rolled-back transaction. It passed against the live database: score tampering, activity privacy, nonmember league access, cross-user inserts and joining.
- 20 automated tests pass; production build and API typecheck pass. Lint has six Fast Refresh warnings and no errors.
- Support submissions are stored in `public.support_requests`. Review them in Supabase Table Editor; automated support emails and an admin inbox are not implemented.
- No real customer signup, email recovery or Strava authorisation has been verified end to end yet. Do not advertise the complete launch checklist as ready until these external dependencies are configured and tested.
