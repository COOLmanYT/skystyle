# Automatic Recommendations

The **Automatic recommendations** page (`/automatic-recommendations`) schedules an exact-time outfit recommendation using a manual location. This is useful for planning ahead — a morning commute, a weekend hike, or an event — and reviewing the result later.

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
| **Styling prompt** | Optional free-text guidance (max 1000 characters). |

## Managing schedules

- **Pause / resume** any schedule without deleting it.
- Each schedule shows its recurrence and next run time.
- The list updates immediately after changes.

## Results

The **Recent results** section shows the outcome of each scheduled run:

- **Status** — e.g. completed, failed.
- **Time** — when the run executed.
- **Output** — the saved outfit recommendation, or an error message if it failed.

Completed recommendations are also delivered to your **[Inbox](./account-and-support#inbox)**, so you can review them alongside your other notices.

## How scheduling works

::: tip Supabase Cron
The scheduler runs via **Supabase Cron** (not Vercel Cron) and invokes the secure worker each minute. This means exact-time recommendations are delivered at the minute you schedule, and it keeps the worker compatible with Vercel Hobby (which only permits one cron invocation per day).
:::

Setup is documented for developers in [Development → Automatic recommendation scheduler](../development#automatic-recommendation-scheduler).
