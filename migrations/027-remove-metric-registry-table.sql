-- Remove redundant metric_registry table
-- This table is empty and duplicates functionality already in the metrics table
-- Simplifies architecture to just: metrics (definitions) + metric_history (tracking)

-- Note: This will be applied to specific company schemas via script
-- Template for company-specific schema cleanup

-- Drop metric_registry table if it exists
DROP TABLE IF EXISTS {COMPANY_SCHEMA}.metric_registry CASCADE;

-- Remove any related indexes or constraints
-- (metric_registry table has no foreign key references to clean up)

-- Log the cleanup
-- COMMENT: Removed redundant metric_registry table - functionality consolidated into metrics table