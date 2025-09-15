-- Add numerator and denominator columns to metric_history table
-- For tracking raw components of percentage/ratio/average metrics
-- These allow calculation of percentages elsewhere in the application

-- Note: This will be applied to specific company schemas via script
-- Template for company-specific schema updates

-- Add numerator and denominator columns
ALTER TABLE {COMPANY_SCHEMA}.metric_history
ADD COLUMN IF NOT EXISTS numerator DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS denominator DECIMAL(15,2);

-- Add comments for clarity
COMMENT ON COLUMN {COMPANY_SCHEMA}.metric_history.numerator IS 'Numerator value for percentage/ratio/average metrics (e.g., sales won for conversion rate)';
COMMENT ON COLUMN {COMPANY_SCHEMA}.metric_history.denominator IS 'Denominator value for percentage/ratio/average metrics (e.g., total leads for conversion rate)';

-- Log the update
-- COMMENT: Added numerator/denominator columns for tracking percentage and ratio metric components