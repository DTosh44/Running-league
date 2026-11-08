# RunningLeague

A responsive free-beta running product for fair private leagues, transparent activity scoring and personalised race plans.

## Product vision, look and next priorities

**What it should become:** an approachable, trustworthy place for friends and running groups to run **private leagues** that reward running performances through understandable rules, with personalised race plans alongside the competition. Users should be able to create or join a league, enter/import their own runs, see fair weekly/season standings and use structured plans without relying on direct wearable integrations.

**Implemented visual direction:** performance-led but not intimidating. Navy `#0d1735` and rich blue `#1646d8` anchor a light `#f6f8ff` interface, with restrained violet `#6b4eff` and lavender `#a997ff` accents; Inter typography, bold concise headings, clean cards and responsive mobile layouts. The current UI rules live in `src/styles.css`. Avoid visual complexity that obscures scoring, eligibility or the next action.

**Immediate direction:** prove real signup, email confirmation, login and recovery in the deployed beta with a configured SMTP sender and two independent accounts, then validate league invites and scoring permissions across those accounts. GPX/FIT import and manual entries remain valid even without Strava/Garmin APIs. Strava must not be advertised as active until credentials and full OAuth import are verified; Garmin direct integration needs partner approval. Keep RunningScore v1.0 stable unless a scoring rule change is expressly agreed. See [PROJECT.md](PROJECT.md) and [AGENTS.md](AGENTS.md).

**Later:** improve usability and integrate authorised providers only when the core private-league experience is reliable. Do not pivot into an open social network or radically change scoring during beta onboarding.

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

## Verified screenshot league pilot (PR #3 — not deployed)

The proposed friends-only version accepts **one or two Strava screenshots** (PNG, JPG or WebP; maximum 6 MB each). A free pinned Tesseract.js browser OCR reader attempts to recognise distance, ascent, moving time and *explicitly labelled elapsed time*. The browser compares the screenshots and flags missing/contradictory figures. OCR is advisory: it cannot prove the screenshots are genuine, or that two images show the same activity.

Runners choose a private league, correct the extracted figures, and confirm that the **original screenshots visibly show elapsed time**, including stops. **Both original files are uploaded** to a *private* Supabase Storage bucket when submitted; unlike the earlier one-screenshot beta, this verified flow retains the images for organiser review. The runner and creator of the selected league may view the originals with short-lived signed links. No paid AI API or direct Strava API is used. There is no guarantee of zero cost beyond the hosting/storage free-plan quotas.

All new evidence starts **pending**. The organiser sees the queue, image files, discrepancies and possible duplicates, then approves or rejects the evidence. Client-side OCR warnings are only review hints. The screenshot file is never by itself proof of a genuine activity, and an organiser must actually inspect the elapsed-time evidence.

**League eligibility:** Creating a new league defaults to an opt-in *Require verified run evidence* rule. When on, the server-side league table counts only approved evidence attached to that exact league. Manual, GPX and FIT entries remain in personal history but do not score in that verified league without evidence. Previously created leagues default to their current rules. RunningScore v1.0 and all current score calculations remain unchanged. Once a league requires verification, the organiser cannot silently disable this requirement. A reviewed activity cannot silently be edited afterward.

**Storage and privacy:** Images are restricted to each runner's folder, and become immutable evidence after submission. Only the uploader and that league's creator can retrieve them. Unsubmitted uploads can be removed; submitted evidence remains attached to the activity during the beta. Deletion requests require an administrator-managed workflow. The free Storage quota should be monitored before adding larger groups. Images can contain location, user names and routes, so only upload screenshots you are comfortable sharing with your league organiser.

### Release checklist — do not merge PR #3 until all gates pass

1. Review and apply supabase/verified-screenshot-leagues.sql to a **non-production** Supabase project first.
2. Run supabase/tests/verified-evidence-security.sql as a transactional integration test. Validate RLS with two runners, a league creator and a stranger; separately upload and download real image objects.
3. Apply the reviewed SQL to production. The existing Supabase connection currently does not grant permission to change the live project.
4. Complete real two-account signup, confirmation and recovery tests. Configure production SMTP before inviting friends.
5. Verify screenshot upload/review, owner-only signed URLs, pending exclusion, approved and rejected scoring, and at least several real iPhone/Android Strava screenshots.
6. Merge PR #3 and verify deployment only after the database is ready. No schema migration has been applied to production by this PR.

**Scope limitation:** Evidence is attached to the chosen league. A run does not automatically become verified for other private leagues; it must be reviewed there separately. GPX/FIT files alone do not meet the screenshot-evidence requirement for verified league scoring.

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
