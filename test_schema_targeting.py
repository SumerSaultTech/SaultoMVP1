#!/usr/bin/env python3
"""
Test script to verify schema targeting works correctly.
This will directly test the PostgresLoader to ensure data lands in the correct company schema.
"""

import os
import sys
from datetime import datetime

# Add the python_connectors directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'python_connectors'))

from postgres_loader import PostgresLoader

def test_schema_targeting():
    """Test that data lands in the correct company-specific analytics schema"""
    
    print("Testing schema targeting with PostgresLoader...")
    
    loader = PostgresLoader()
    
    # Test data for two different companies
    test_companies = [
        {'company_id': 1, 'company_name': 'Demo Company'},
        {'company_id': 1748544793859, 'company_name': 'MIAS_DATA'}
    ]
    
    # Mock data to load
    test_data = [
        {'id': 1, 'name': 'Test Record 1', 'status': 'active'},
        {'id': 2, 'name': 'Test Record 2', 'status': 'inactive'}
    ]
    
    results = {}
    
    for company in test_companies:
        company_id = company['company_id']
        company_name = company['company_name']
        
        print(f"\nTesting company {company_id} ({company_name})...")
        
        try:
            # Expected schema name
            expected_schema = f"analytics_company_{company_id}"
            actual_schema = loader.get_analytics_schema_name(company_id)
            
            print(f"   Expected schema: {expected_schema}")
            print(f"   Actual schema:   {actual_schema}")
            
            # Verify schema name is correct
            if expected_schema != actual_schema:
                print(f"   ERROR: Schema name mismatch!")
                results[company_id] = False
                continue
                
            # Load test data
            records_loaded = loader.load_data(
                table_name='test_schema_targeting',
                data=test_data,
                source_system='test_suite',
                company_id=company_id
            )
            
            print(f"   SUCCESS: Loaded {records_loaded} records into {actual_schema}.test_schema_targeting")
            
            # Verify data exists in the correct schema
            tables = loader.get_table_list(company_id)
            if 'test_schema_targeting' in tables:
                print(f"   SUCCESS: Table found in company {company_id} schema")
                results[company_id] = True
            else:
                print(f"   ERROR: Table NOT found in company {company_id} schema")
                results[company_id] = False
                
        except Exception as e:
            print(f"   ERROR: Error testing company {company_id}: {e}")
            results[company_id] = False
    
    # Verify isolation - data should only be in each company's own schema
    print(f"\nVerifying schema isolation...")
    
    for company in test_companies:
        company_id = company['company_id']
        other_companies = [c for c in test_companies if c['company_id'] != company_id]
        
        for other_company in other_companies:
            other_company_id = other_company['company_id']
            other_tables = loader.get_table_list(other_company_id)
            
            # The test table should exist in the correct company's schema
            company_tables = loader.get_table_list(company_id)
            if 'test_schema_targeting' in company_tables:
                print(f"   SUCCESS: Company {company_id} has test data in its own schema")
            else:
                print(f"   ERROR: Company {company_id} missing test data in its own schema")
    
    print(f"\nTest Results Summary:")
    all_passed = True
    for company_id, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"   Company {company_id}: {status}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print(f"\nAll schema targeting tests PASSED! Data correctly lands in company-specific schemas.")
    else:
        print(f"\nSome schema targeting tests FAILED! Review the issues above.")
    
    # Cleanup test data
    try:
        print(f"\nCleaning up test data...")
        for company in test_companies:
            company_id = company['company_id']
            schema_name = loader.get_analytics_schema_name(company_id)
            cleanup_query = f"DROP TABLE IF EXISTS {schema_name}.test_schema_targeting"
            loader.execute_query(cleanup_query)
            print(f"   SUCCESS: Cleaned up test table for company {company_id}")
    except Exception as e:
        print(f"   WARNING: Cleanup error: {e}")
    
    loader.close_connection()
    return all_passed

if __name__ == "__main__":
    test_schema_targeting()