-- Update metric_history table to support daily goal tracking
-- This migration updates the existing metric_history table structure to include daily goals

-- Template for updating metric_history in each company schema
-- Replace {COMPANY_SCHEMA} with actual company schema name when executed

-- 1. Drop existing metric_history table if it exists (to avoid conflicts)
DROP TABLE IF EXISTS {COMPANY_SCHEMA}.metric_history CASCADE;

-- 2. Create enhanced metric_history table with daily goal tracking
CREATE TABLE {COMPANY_SCHEMA}.metric_history (
  id SERIAL PRIMARY KEY,
  company_id bigint NOT NULL,
  metric_id integer REFERENCES {COMPANY_SCHEMA}.metrics(id) ON DELETE CASCADE,
  date date NOT NULL,
  actual_value numeric,
  goal_value numeric,
  recorded_at timestamptz DEFAULT now(),
  period text NOT NULL DEFAULT 'daily',

  -- Ensure one record per metric per date
  UNIQUE(metric_id, date)
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_{COMPANY_ID}_metric_history_metric_date ON {COMPANY_SCHEMA}.metric_history(metric_id, date);
CREATE INDEX IF NOT EXISTS idx_{COMPANY_ID}_metric_history_date ON {COMPANY_SCHEMA}.metric_history(date);
CREATE INDEX IF NOT EXISTS idx_{COMPANY_ID}_metric_history_company ON {COMPANY_SCHEMA}.metric_history(company_id);

-- 4. Add table comment
COMMENT ON TABLE {COMPANY_SCHEMA}.metric_history IS 'Daily tracking of actual vs goal values for each metric';
COMMENT ON COLUMN {COMPANY_SCHEMA}.metric_history.actual_value IS 'What the metric actually achieved on this date';
COMMENT ON COLUMN {COMPANY_SCHEMA}.metric_history.goal_value IS 'Daily goal value (calculated from yearly/quarterly/monthly goals)';
COMMENT ON COLUMN {COMPANY_SCHEMA}.metric_history.date IS 'The date this measurement represents';