# Automatic Recommendations

The **Automatic recommendations** page (`/automatic-recommendations`) schedules an outfit recommendation using a manual location. This is useful for planning ahead — a morning commute, a weekend hike, or an event — and reviewing the result later. Delivery is best-effort, not a guarantee of an exact minute.

## Creating a schedule

Each schedule includes:

| Field | Description |
| --- | --- |
| **Label** | A name for the schedule (e.g. "Morning commute"). |
| **Latitude & longitude** | A manual location — GPS is not used. Latitude −90 to 90, longitude −180 to 180. |
| **Run time** | When the recommendation should be generated. |
| **Recurrence** | `Once`, `Daily`, or `Weekly`. |
| **Unit preference** | `metric` (°C, km/h) or `imperial` (°F, mph). |
| **Timezone** | Detected automatically from your browser. |
| **Styling prompt** | Optional Pro/Dev guidance (max 1000 characters); ignored for Free schedules. |

## Managing schedules

- **Pause / resume** any schedule without deleting it.
- Each schedule shows its recurrence and next run time.
- The list updates immediately after changes.

## Results

The **Recent results** section shows the outcome of each scheduled run:

- **Status** — e.g. completed, failed.
- **Time** — when the run executed.
- **Output** — the saved outfit recommendation, or an error message if it failed.

Completed recommendations are also copied to your **[Inbox](./account-and-support#inbox)**. If that copy fails, the completed result remains in run history.

Runs enforce account access and the current Free recommendation allowance or Pro App Credit balance before generation, and use the same account-default AI model as Style. These are existing limits, not activation of the planned V6 entitlement table. Demo sessions cannot save schedules.

## How scheduling works

::: tip Supabase Cron
The scheduler runs via **Supabase Cron** (not Vercel Cron) and invokes the secure worker each minute. A bounded worker claims one job per invocation, so provider latency and queued jobs can delay delivery. Daily/weekly schedules preserve local wall-clock time across daylight-saving changes. Missed occurrences are skipped after one run, not backfilled with repeated charges. Failed recurring runs advance to a future occurrence; failed one-offs are disabled instead of repeatedly calling providers.
:::

Setup is documented for developers in [Development → Automatic recommendation scheduler](../development#automatic-recommendation-scheduler).
