# Metrics Time-Series ETL: Technical Approach

## Objective
Precompute and store compact, uniform time-series data per tenant so charts render fast and consistently, regardless of raw source data volume. The ETL writes into `analytics_company_{companyId}` schema tables (e.g., `metrics_time_series`) so the UI can query small, predictable datasets.

## Key Components (code references)
- **ETL Service**: `server/services/metrics-time-series-etl.ts`
  - `populatePeriod(companyId, periodType, startDate, endDate)` executes:
    - `SELECT populate_company_metrics_time_series(companyId, periodType, startDate, endDate)`
  - The heavy lifting (aggregation/upserts) is implemented in the Postgres function.

- **Scheduler**: `server/services/sync-scheduler.ts`
  - Checks every minute (`checkInterval = 60000` ms).
  - Sets 15-minute schedules per connector and runs a daily ETL after successful syncs.
  - We will extend it to also run time-series ETL on a cadence (e.g., every 15 minutes) per company/period.

- **API Trigger Endpoints**: `server/routes.ts`
  - `POST /api/company/metrics-series/etl` — triggers ETL for selected company and `period_type`.
  - `GET /api/company/metrics-series/etl/status` — polls ETL status.
  - `GET /api/debug/tables/:companyId` — inspects tenant schema tables.

## Data Flow
1. New/updated source data lands in tenant schema tables (via connectors or manual loads).
2. Scheduler or API trigger calls ETL.
3. ETL runs `populate_company_metrics_time_series(...)` for a window based on `periodType`.
4. Postgres function aggregates/rolls up metrics and upserts rows into `analytics_company_{companyId}.metrics_time_series` (or related tables like `kpi_metrics` if applicable).
5. Read endpoints (e.g., `/api/company/metrics-series`) query the precomputed tables to drive charts.

## Period Windows (examples)
- `weekly`: last 7 days (or startOfWeek..today)
- `monthly`: first day of month..today
- `quarterly`: startOfQuarter..today
- `yearly`: startOfYear..today

ETL is idempotent: re-running upserts/overwrites the same time buckets, so frequent runs are safe.

## Scheduling Strategy
- Base loop runs every minute in `SyncScheduler`.
- Each company/connector has a 15-minute schedule by default; on successful sync, a daily ETL is run.
- Enhancement (to implement): add an ETL schedule independent of connector syncs:
  - Maintain `scheduledEtls` with `{ companyId, periods: string[], interval: number, lastRunAt, nextRunAt, enabled }`.
  - On each minute tick, run due ETL jobs for configured periods (e.g., `monthly`).
  - Default: add `addScheduledEtl(company.id, ['monthly'], 15)` for all companies.

## Database Contract
- Required function: `populate_company_metrics_time_series(bigint, text, date, date)`
  - Should create/ensure target tables exist (or require migrations to precreate them).
  - Should upsert into fixed time buckets (day/week/month), emitting fields expected by readers.
- Example target table: `analytics_company_{id}.metrics_time_series`
  - Columns (illustrative): `ts (date/timestamp)`, `series (text)`, `value (numeric)`, `running_sum (numeric)`, `granularity (text)`
  - Consider separate tables for goals if needed, or include goal columns per row.

## API/Reader Expectations
- `client/src/components/dashboard/metrics-series-chart.tsx` expects records shaped like:
  - `ts` (timestamp), `series` (metric key/name), `running_sum` (numeric)
  - The chart groups by `ts` and renders series lines.
- If a different endpoint (e.g., `/api/company/chart-data`) is used, align payload mapping in the component.

## Error Handling & Idempotency
- Postgres function returns success/error — ETL service logs and propagates a structured result.
- Idempotent upserts ensure repeated runs do not duplicate rows.
- On failure, scheduler retries ETL in a short interval (e.g., +5 minutes) without blocking other tenants.

## Observability
- Log per-run summary: companyId, period, window, rows affected/time.
- Optional: write operational logs to `pipeline_activities` for visibility in `/api/pipeline-activities`.
- Return metrics to status endpoint for UI display (last run time, last success/failure).

## Local Dev / Testing
1. Select a company (session-based) via UI or `POST /api/companies/select`.
2. Trigger ETL manually: `POST /api/company/metrics-series/etl { period_type: 'monthly', force_refresh: true }`.
3. Inspect schema: `GET /api/debug/tables/:companyId`.
4. Load charts: `GET /api/company/metrics-series?period_type=monthly` and verify non-empty data.

## Open Questions / Next Steps
- Do we precreate analytics tables via migration, or let the function ensure/create them?
- Which periods are required by default for the scheduler (monthly only, or also weekly)?
- Do we compute goals in the same ETL or a companion ETL?
- Add `scheduledEtls` and `addScheduledEtl()` to `SyncScheduler` and wire `populatePeriod(...)` with date windows.

