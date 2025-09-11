-- Fix Average Jira Cycle Time to be "lower is better" metric
-- For all companies: set isIncreasing = false for cycle time metrics

DO $$
DECLARE
    company_record RECORD;
    table_name TEXT;
BEGIN
    -- Loop through all companies
    FOR company_record IN 
        SELECT id, name FROM companies
    LOOP
        RAISE NOTICE 'Processing company %: %', company_record.id, company_record.name;
        
        -- Update cycle time metrics in company-specific KPI table
        table_name := 'analytics_company_' || company_record.id || '.kpi_metrics';
        
        BEGIN
            -- Update cycle time metrics to be "lower is better"
            EXECUTE format('
                UPDATE %I 
                SET is_increasing = false, 
                    updated_at = NOW()
                WHERE LOWER(name) LIKE ''%%cycle time%%''
                   OR LOWER(name) LIKE ''%%cycle%%time%%''
                   OR metric_key = ''jira_avg_cycle_time''
            ', table_name);
            
            GET DIAGNOSTICS company_record := ROW_COUNT;
            RAISE NOTICE 'Updated % cycle time metrics for company %', company_record, company_record.id;
            
        EXCEPTION
            WHEN others THEN
                RAISE NOTICE 'Skipping company % (table may not exist): %', company_record.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Cycle time metric direction fix completed';
END $$;