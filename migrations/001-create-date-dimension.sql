-- Migration: Create Date Dimension Table
-- Date: 2025-01-XX
-- Purpose: Create reusable date spine for time-series queries (2020-2026)

-- Create shared utilities schema
CREATE SCHEMA IF NOT EXISTS shared_utils;

-- Create date dimension table with all time period buckets
CREATE TABLE IF NOT EXISTS shared_utils.dim_date AS
SELECT d::date AS dt,
       date_trunc('week', d)::date    AS week_start,
       date_trunc('month', d)::date   AS month_start,
       date_trunc('quarter', d)::date AS quarter_start,
       date_trunc('year', d)::date    AS year_start,
       EXTRACT(year FROM d)::int      AS year_num,
       EXTRACT(quarter FROM d)::int   AS quarter_num,
       EXTRACT(month FROM d)::int     AS month_num,
       EXTRACT(week FROM d)::int      AS week_num,
       EXTRACT(dow FROM d)::int       AS day_of_week
FROM generate_series('2020-01-01'::date, '2026-12-31'::date, INTERVAL '1 day') d;

-- Create indexes for fast time-series joins
CREATE UNIQUE INDEX IF NOT EXISTS dim_date_pk ON shared_utils.dim_date(dt);
CREATE INDEX IF NOT EXISTS dim_date_week_idx    ON shared_utils.dim_date(week_start);
CREATE INDEX IF NOT EXISTS dim_date_month_idx   ON shared_utils.dim_date(month_start);
CREATE INDEX IF NOT EXISTS dim_date_quarter_idx ON shared_utils.dim_date(quarter_start);
CREATE INDEX IF NOT EXISTS dim_date_year_idx    ON shared_utils.dim_date(year_start);

-- Grant read access to all users (shared resource)
GRANT USAGE ON SCHEMA shared_utils TO PUBLIC;
GRANT SELECT ON shared_utils.dim_date TO PUBLIC;

-- Verify table creation
SELECT 
  COUNT(*) as total_days,
  MIN(dt) as start_date,
  MAX(dt) as end_date
FROM shared_utils.dim_date;

COMMENT ON TABLE shared_utils.dim_date IS 'Shared date dimension for time-series queries across all tenants';
COMMENT ON COLUMN shared_utils.dim_date.dt IS 'Primary date column';
COMMENT ON COLUMN shared_utils.dim_date.week_start IS 'Monday of the week';
COMMENT ON COLUMN shared_utils.dim_date.month_start IS 'First day of the month';
COMMENT ON COLUMN shared_utils.dim_date.quarter_start IS 'First day of the quarter';
COMMENT ON COLUMN shared_utils.dim_date.year_start IS 'January 1st of the year';