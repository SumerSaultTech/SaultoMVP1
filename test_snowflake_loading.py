#!/usr/bin/env python3
"""
Test script to verify Snowflake loading functionality
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add python_connectors to path
sys.path.append('python_connectors')

from python_connectors.simple_jira_connector import SimpleJiraConnector

def test_snowflake_loading():
    """Test Jira connector with Snowflake loading"""
    
    # Test credentials (replace with actual)
    test_credentials = {
        "server_url": "https://your-domain.atlassian.net",
        "username": "your-email@example.com", 
        "api_token": "your-api-token"
    }
    
    company_id = 1748544793859  # MIAS_DATA company ID
    
    print("Testing Jira connector with Snowflake loading...")
    print(f"Company ID: {company_id}")
    
    try:
        # Create connector
        connector = SimpleJiraConnector(
            company_id=company_id,
            credentials=test_credentials
        )
        
        print(f"Connector created: {connector.connector_name}")
        print(f"Snowflake loader available: {connector.snowflake_loader is not None}")
        
        # Test connection (this will fail with test credentials, but that's ok)
        print("\nTesting connection...")
        try:
            connection_ok = connector.test_connection()
            print(f"Connection test: {'PASSED' if connection_ok else 'FAILED'}")
        except Exception as e:
            print(f"Connection test failed (expected with test credentials): {e}")
        
        # Test table structure
        print(f"\nAvailable tables: {connector.get_available_tables()}")
        
        # Test data extraction structure (won't get real data without valid credentials)
        print("\nTesting data extraction structure...")
        sample_data = [{
            'id': '12345',
            'key': 'TEST-1', 
            'summary': 'Test issue',
            'status_name': 'In Progress',
            'assignee_display_name': 'John Doe',
            'created': '2024-01-01T00:00:00.000Z',
            'updated': '2024-01-02T00:00:00.000Z'
        }]
        
        print(f"Sample data structure: {sample_data[0]}")
        
        if connector.snowflake_loader:
            print("\nTesting Snowflake table creation...")
            try:
                # Test table creation with sample data
                table_name = "JIRA_ISSUES_TEST"
                connector.snowflake_loader.create_table_if_not_exists(table_name, sample_data[0])
                print(f"✅ Table {table_name} created/verified successfully")
                
                # Test data loading
                print("Testing data loading...")
                records_loaded = connector.snowflake_loader.load_data(
                    table_name=table_name,
                    data=sample_data,
                    source_system="jira",
                    company_id=company_id
                )
                print(f"✅ Loaded {records_loaded} test records into {table_name}")
                
            except Exception as e:
                print(f"❌ Snowflake test failed: {e}")
                print("This might be due to missing Snowflake credentials or connection issues")
        else:
            print("❌ Snowflake loader not available")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    test_snowflake_loading()