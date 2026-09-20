# RunningLeague

A responsive web product for fair, social running leagues and personalised race planning.

## Included in this prototype

- Public product website with the agreed blue, white and violet visual direction
- Local demo login and account creation
- Member dashboard, activity history and transparent score breakdowns
- Private-league cards, weekly table and season rules
- Four-part race-plan questionnaire and a generated 4–24 week schedule
- Responsive layouts for desktop, tablet and mobile
- Automated tests for authentication, planning and scoring

## Demo access

- Email: `darren@runningleague.demo`
- Password: `Demo123!`

Authentication and saved training plans use browser storage in this prototype. Production should replace this with Supabase Auth and database persistence.

## Scoring methodology

The current implementation matches the `RunningScore v1.0` workbook:

1. Effort distance is `distance km + elevation metres / 100`.
2. Elapsed time is used, so stops and recoveries remain part of the activity.
3. Where pace blocks exist, 30-second block speeds are capped at 1.25× benchmark speed and normalised with a fourth-power mean.
4. A Riegel exponent of 1.06 adjusts for distance.
5. The benchmark is a 20:21 5K, worth approximately 20 points.
6. Performance index converts to 1–25 points using `(index - 60) / 2`, rounded and capped.

League defaults are three scoring runs per week, a maximum of one scoring run per day, and the best eight weeks from a ten-week season.

## Run locally

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm test
npm run build
```
