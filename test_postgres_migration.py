#!/usr/bin/env python3
"""
Test script for PostgreSQL migration.
Tests the new PostgreSQL-based connector system.
"""

import sys
import os
import json
from datetime import datetime

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_postgres_loader():
    """Test the PostgreSQL loader"""
    print("Testing PostgreSQL Loader...")
    
    try:
        from python_connectors.postgres_loader import PostgresLoader
        
        # Test basic initialization
        loader = PostgresLoader()
        print("✓ PostgreSQL loader initialized successfully")
        
        # Test schema name generation
        schema_name = loader.get_analytics_schema_name(123)
        expected_schema = "analytics_company_123"
        assert schema_name == expected_schema, f"Expected {expected_schema}, got {schema_name}"
        print(f"✓ Schema name generation works: {schema_name}")
        
        # Test column name cleaning
        clean_name = loader.clean_column_name("Test Column-Name.With Spaces")
        expected_clean = "test_column_name_with_spaces"
        assert clean_name == expected_clean, f"Expected {expected_clean}, got {clean_name}"
        print(f"✓ Column name cleaning works: {clean_name}")
        
        # Test PostgreSQL type detection
        test_values = [
            (None, "TEXT"),
            (True, "BOOLEAN"),
            (42, "BIGINT"),
            (3.14, "NUMERIC"),
            (datetime.now(), "TIMESTAMP"),
            ({"key": "value"}, "JSONB"),
            ("string", "TEXT")
        ]
        
        for value, expected_type in test_values:
            actual_type = loader.get_postgres_type(value)
            assert actual_type == expected_type, f"For {value}, expected {expected_type}, got {actual_type}"
        
        print("✓ PostgreSQL type detection works correctly")
        
        print("PostgreSQL Loader tests passed!")
        return True
        
    except ImportError as e:
        print(f"✗ Failed to import PostgreSQL loader: {e}")
        return False
    except Exception as e:
        print(f"✗ PostgreSQL loader test failed: {e}")
        return False

def test_base_connector_migration():
    """Test that base connector uses PostgreSQL"""
    print("\nTesting Base Connector Migration...")
    
    try:
        from python_connectors.simple_base_connector import SimpleBaseConnector, POSTGRES_AVAILABLE
        
        if not POSTGRES_AVAILABLE:
            print("✗ PostgreSQL not available in base connector")
            return False
        
        print("✓ PostgreSQL is available in base connector")
        
        # Test with a mock connector class
        class MockConnector(SimpleBaseConnector):
            @property
            def connector_name(self):
                return "test"
            
            @property
            def required_credentials(self):
                return ["test_key"]
            
            def test_connection(self):
                return True
            
            def get_available_tables(self):
                return ["test_table"]
            
            def extract_data(self, table_name, incremental=True):
                return [{"id": 1, "name": "test"}]
        
        # Initialize mock connector
        mock_connector = MockConnector(
            company_id=999,
            credentials={"test_key": "test_value"}
        )
        
        assert mock_connector.postgres_loader is not None, "PostgreSQL loader should be initialized"
        print("✓ Base connector initializes PostgreSQL loader")
        
        print("Base Connector Migration tests passed!")
        return True
        
    except Exception as e:
        print(f"✗ Base connector migration test failed: {e}")
        return False

def test_salesforce_connector():
    """Test the new Salesforce connector"""
    print("\nTesting Salesforce Connector...")
    
    try:
        from python_connectors.simple_salesforce_connector import SimpleSalesforceConnector
        
        # Test connector initialization
        connector = SimpleSalesforceConnector(
            company_id=999,
            credentials={
                "client_id": "test_id",
                "client_secret": "test_secret",
                "username": "test@example.com",
                "password": "test_password",
                "security_token": "test_token",
                "instance_url": "https://test.salesforce.com"
            }
        )
        
        assert connector.connector_name == "salesforce", "Connector name should be 'salesforce'"
        print("✓ Salesforce connector initialized")
        
        # Test required credentials
        required_creds = connector.required_credentials
        expected_creds = ["client_id", "client_secret", "username", "password", "security_token", "instance_url"]
        assert set(required_creds) == set(expected_creds), f"Required credentials mismatch"
        print("✓ Salesforce connector has correct required credentials")
        
        # Test available tables
        tables = connector.get_available_tables()
        expected_tables = ["Account", "Contact", "Opportunity", "Lead", "Case", "Task", "Event", "User"]
        assert set(tables) == set(expected_tables), "Available tables mismatch"
        print("✓ Salesforce connector has correct available tables")
        
        # Test SOQL query building
        fields = ["Id", "Name", "CreatedDate"]
        soql = connector.build_soql_query("Account", fields, incremental=True)
        assert "SELECT Id, Name, CreatedDate FROM Account" in soql
        assert "LastModifiedDate >= LAST_N_DAYS:30" in soql
        assert "IsDeleted = FALSE" in soql
        print("✓ SOQL query building works correctly")
        
        print("Salesforce Connector tests passed!")
        return True
        
    except Exception as e:
        print(f"✗ Salesforce connector test failed: {e}")
        return False

def test_connector_manager():
    """Test the connector manager with new connectors"""
    print("\nTesting Connector Manager...")
    
    try:
        from python_connectors.simple_connector_manager import SimpleConnectorManager
        
        # Test available connectors
        available = SimpleConnectorManager.get_available_connectors()
        assert "salesforce" in available, "Salesforce should be available"
        assert "jira" in available, "Jira should be available"
        print(f"✓ Available connectors: {available}")
        
        # Test connector requirements
        sf_requirements = SimpleConnectorManager.get_connector_requirements("salesforce")
        assert sf_requirements["name"] == "salesforce"
        assert "client_id" in sf_requirements["required_credentials"]
        print("✓ Salesforce requirements retrieved correctly")
        
        print("Connector Manager tests passed!")
        return True
        
    except Exception as e:
        print(f"✗ Connector manager test failed: {e}")
        return False

def main():
    """Run all PostgreSQL migration tests"""
    print("=" * 60)
    print("PostgreSQL Migration Test Suite")
    print("=" * 60)
    
    tests = [
        ("PostgreSQL Loader", test_postgres_loader),
        ("Base Connector Migration", test_base_connector_migration),
        ("Salesforce Connector", test_salesforce_connector),
        ("Connector Manager", test_connector_manager)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"\n{'=' * 40}")
        print(f"Running {test_name} Tests...")
        print(f"{'=' * 40}")
        
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"✗ {test_name} tests failed with exception: {str(e)}")
            results[test_name] = False
    
    # Summary
    print(f"\n{'=' * 60}")
    print("PostgreSQL Migration Test Summary")
    print(f"{'=' * 60}")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{test_name:<30} {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All PostgreSQL migration tests passed!")
        print("📊 Your system has been successfully migrated from Snowflake to PostgreSQL!")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == '__main__':
    exit(main())