# RunningLeague

A responsive free-beta running product for fair private leagues, transparent activity scoring and personalised race plans.

## Working beta journeys

- Secure email/password accounts, email confirmation and password recovery through Supabase Auth
- Persistent profiles, activities, leagues and training plans with row-level database security
- Create private leagues, share an invite code and join a league
- Live weekly and season league tables
- Enter a run manually and calculate its RunningScore immediately
- Import GPX and Garmin-compatible FIT activity files in the browser
- Connect Strava, import the last 90 days and sync again on demand
- Generate a 4–24 week race plan and mark individual sessions complete
- Profile editing, support form, privacy policy and beta terms
- Responsive desktop, tablet and mobile layouts

Garmin's direct API requires partner approval. Garmin users can use the working FIT-file import while approval is pursued.

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
3. Where pace blocks exist, 30-second block speeds are capped at 1.25× benchmark speed and normalised with a fourth-power mean.
4. A Riegel exponent of 1.06 adjusts for distance.
5. The benchmark is a 20:21 5K, worth approximately 20 points.
6. Performance index converts to 1–25 points using `(index - 60) / 2`, rounded and capped.

League defaults are three scoring runs per week, a maximum of one scoring run per day, and a ten-week season. The database league table selects the best run per day and the configured number of weekly scoring runs.

## Local development

Without environment variables, the product runs in local demo mode:

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
