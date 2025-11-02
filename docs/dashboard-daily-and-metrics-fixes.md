# Dashboard Daily + Metrics Fixes (2025-11-02)

## Overview
- Added Daily to dashboard time period selectors and wired backend to accept `period_type=daily`.
- Fixed Business Metrics charts to use `metric_key` reliably (snake_case compatible), reading from `metrics_time_series`.
- Resolved 500s for company-specific metrics by removing/relaxing schema-dependent columns in queries and, for one company, adding the missing `company_id` column to its `metrics` table.
- Added targeted console logs to aid future debugging.

## Frontend changes
- MetricProgressChart (`client/src/components/dashboard/metric-progress-chart.tsx`)
  - Map "Daily View"/"Daily" to `daily` in `getPeriodMapping`.
  - Fallback to `metric.metric_key` when `metric.metricKey` is missing.
  - Fetches from `/api/company/metrics-series?metric_keys=<metric_key>&period_type=<period>`.
- Metrics Overview (`client/src/components/dashboard/metrics-overview.tsx`)
  - Added Daily to dropdown options.
  - Added console logs for `/api/dashboard/metrics-data` and `/api/kpi-metrics` results.
- North Star Metrics (`client/src/components/dashboard/north-star-metrics.tsx`)
  - Added Daily to `northStarTimePeriodOptions`.
- Metrics Trends (`client/src/components/dashboard/metrics-series-chart.tsx`)
  - Added `daily` to `TimePeriod` and `TIME_PERIOD_CONFIGS` so the Select renders a daily/today option.

## Backend changes
- MetricsSeries types and routing
  - `server/services/metrics-series.ts`: `MetricsSeriesQuery.periodType` now includes `'daily'`.
  - `server/routes.ts`: `/api/company/metrics-series` query typing updated to allow `'daily'`.
- DatabaseStorage.getKpiMetrics (`server/storage.ts`)
  - Removed dependency on `company_id` filter and selection (per-company schema already isolates tenants).
  - Switched to selecting a core, widely available set of columns and mapping optional fields with safe defaults.
  - Attached `companyId` in code to avoid reliance on a column that may not exist in some companies' schemas.
  - Added temporary query string logging to verify the executed SQL.

## Data model and SQL operations (run as needed)
- Ensure `metrics_time_series.metric_key` exists and is populated per company:
```sql
ALTER TABLE analytics_company_{company_id}.metrics_time_series
  ADD COLUMN IF NOT EXISTS metric_key text;

UPDATE analytics_company_{company_id}.metrics_time_series mts
SET metric_key = m.metric_key
FROM analytics_company_{company_id}.metrics m
WHERE mts.metric_key IS NULL
  AND mts.series_label = m.name;

-- Optional once backfilled
-- ALTER TABLE analytics_company_{company_id}.metrics_time_series
--   ALTER COLUMN metric_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mts_unique_{company_id}
  ON analytics_company_{company_id}.metrics_time_series (ts, metric_key, is_goal, period_type);

CREATE INDEX IF NOT EXISTS idx_mts_metric_period_ts_{company_id}
  ON analytics_company_{company_id}.metrics_time_series (metric_key, period_type, ts);
```
- Company 1756502314139: added `company_id` to the `metrics` table to standardize with other tenants (optional when using per-schema isolation):
```sql
ALTER TABLE analytics_company_1756502314139.metrics
  ADD COLUMN IF NOT EXISTS company_id bigint;

UPDATE analytics_company_1756502314139.metrics
SET company_id = 1756502314139
WHERE company_id IS NULL;

ALTER TABLE analytics_company_1756502314139.metrics
  ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_metrics_company_id_1756502314139
  ON analytics_company_1756502314139.metrics (company_id);
```

## Behavior after changes
- Daily is selectable in dashboard dropdowns (North Star, Business Metrics, Trends). Requests to `/api/company/metrics-series` now support `period_type=daily`.
- Business Metrics charts render if `metrics_time_series` contains rows for the requested `metric_key` and `period_type`.
- `/api/kpi-metrics` no longer 500s due to missing `company_id` column across companies.

## Known lints and follow-ups (non-blocking)
- TypeScript lints in `server/services/metrics-series.ts` about Map/Set iteration and implicit any. Suggested fixes:
  - Add explicit generics for reduce/sort lambdas.
  - Avoid `for..of` over `Map`/`Set` unless TS target is ES2015+ or enable `downlevelIteration`.
- `metrics-series-chart.tsx` earlier flagged tooltip typing; ensure data shape includes `fullDate` or guard accesses.

## Troubleshooting tips used
- Added console logs for dashboard fetches to inspect raw shapes/status.
- Verified which endpoint powers which UI block:
  - Config: `/api/kpi-metrics` → `metrics`
  - North Star snapshot: `/api/dashboard/metrics-data`
  - Charts: `/api/company/metrics-series` → `metrics_time_series`
- When charts showed no data, validated `metrics_time_series` presence, `metric_key` backfill, and available `period_type` rows.

## Next steps (optional improvements)
- Create a one-click admin job to initialize per-company analytics schema (create `metrics` and `metrics_time_series`, indexes) and backfill `metric_key`.
- Backfill existing companies automatically on deploy or on first access.
- Tighten server TS types and address remaining lints.

## Files touched (high level)
- Client
  - `client/src/components/dashboard/metric-progress-chart.tsx`
  - `client/src/components/dashboard/metrics-overview.tsx`
  - `client/src/components/dashboard/north-star-metrics.tsx`
  - `client/src/components/dashboard/metrics-series-chart.tsx`
- Server
  - `server/services/metrics-series.ts`
  - `server/routes.ts`
  - `server/storage.ts`

## Outcome
- Dashboard charts now render for both companies after aligning API requests, relaxing schema assumptions in queries, and ensuring data exists with proper `metric_key` mapping.
