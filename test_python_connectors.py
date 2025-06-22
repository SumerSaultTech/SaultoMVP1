#!/usr/bin/env python3
"""
Test script for Python connectors.
This script tests the basic functionality of the connector system without requiring real API credentials.
"""

import sys
import os
import json
import requests
import time
from datetime import datetime

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from python_connectors.connector_manager import connector_manager

def test_connector_manager():
    """Test the connector manager without external APIs"""
    print("Testing Connector Manager...")
    
    print("✓ Available connectors:", connector_manager.get_available_connectors())
    
    # Test connector requirements
    for connector_type in connector_manager.get_available_connectors():
        requirements = connector_manager.get_connector_requirements(connector_type)
        print(f"✓ {connector_type} requirements:", requirements)
    
    print("Connector Manager tests passed!")

def test_api_service():
    """Test the Flask API service"""
    print("\nTesting API Service...")
    
    base_url = "http://localhost:5002"
    
    try:
        # Test health endpoint
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            print("✓ API service is healthy")
            print("✓ Health response:", response.json())
        else:
            print("✗ API service health check failed")
            return False
            
        # Test available connectors endpoint
        response = requests.get(f"{base_url}/connectors/available", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✓ Available connectors endpoint works")
            print(f"✓ Found {len(data.get('connectors', []))} connectors")
            for connector in data.get('connectors', []):
                print(f"  - {connector['name']}: {connector['required_credentials']}")
        else:
            print("✗ Available connectors endpoint failed")
            return False
            
        print("API Service tests passed!")
        return True
        
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to API service. Make sure it's running on port 5002")
        print("  Run: python start_connector_service.py")
        return False
    except Exception as e:
        print(f"✗ API service test failed: {str(e)}")
        return False

def test_mock_connector():
    """Test creating a mock connector with fake credentials"""
    print("\nTesting Mock Connector Creation...")
    
    base_url = "http://localhost:5002"
    
    try:
        # Test connectors with mock credentials
        test_configs = [
            {
                "name": "Salesforce",
                "type": "salesforce",
                "credentials": {
                    "client_id": "mock_client_id",
                    "client_secret": "mock_client_secret", 
                    "username": "mock@example.com",
                    "password": "mock_password",
                    "security_token": "mock_token",
                    "instance_url": "https://mock.salesforce.com"
                }
            },
            {
                "name": "Jira",
                "type": "jira",
                "credentials": {
                    "server_url": "https://mock.atlassian.net",
                    "username": "mock@example.com",
                    "api_token": "mock_api_token"
                }
            }
        ]
        
        for test_config in test_configs:
            print(f"\n  Testing {test_config['name']} connector...")
            
            response = requests.post(f"{base_url}/connectors/create", 
                                   json={
                                       "company_id": 999,
                                       "connector_type": test_config["type"],
                                       "credentials": test_config["credentials"]
                                   },
                                   timeout=10)
            
            if response.status_code == 400:
                # Expected to fail with invalid credentials
                print(f"    ✓ {test_config['name']} properly failed authentication (expected)")
                error_data = response.json()
                print(f"    ✓ Error: {error_data.get('error', 'Unknown error')}")
            elif response.status_code == 200:
                print(f"    ✓ {test_config['name']} created (unexpected but OK for testing)")
            else:
                print(f"    ✗ Unexpected response: {response.status_code}")
                print(f"    Response: {response.text}")
                return False
            
        print("Mock Connector tests passed!")
        return True
        
    except Exception as e:
        print(f"✗ Mock connector test failed: {str(e)}")
        return False

def test_snowflake_dependencies():
    """Test if Snowflake dependencies are available"""
    print("\nTesting Snowflake Dependencies...")
    
    try:
        import snowflake.connector
        from snowflake.connector.pandas_tools import write_pandas
        print("✓ Snowflake connector imported successfully")
        
        import pandas as pd
        print("✓ Pandas imported successfully")
        
        # Test environment variables
        required_env_vars = [
            'SNOWFLAKE_ACCOUNT',
            'SNOWFLAKE_USER', 
            'SNOWFLAKE_PASSWORD'
        ]
        
        missing_vars = []
        for var in required_env_vars:
            if not os.getenv(var):
                missing_vars.append(var)
        
        if missing_vars:
            print(f"⚠️  Missing environment variables: {', '.join(missing_vars)}")
            print("   Snowflake connections will fail without these")
        else:
            print("✓ All required Snowflake environment variables are set")
        
        print("Snowflake Dependencies tests passed!")
        return True
        
    except ImportError as e:
        print(f"✗ Missing required dependency: {str(e)}")
        print("  Run: pip install -r requirements_connectors.txt")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("Python Connectors Test Suite")
    print("=" * 60)
    
    tests = [
        ("Connector Manager", test_connector_manager),
        ("Snowflake Dependencies", test_snowflake_dependencies),
        ("API Service", test_api_service),
        ("Mock Connector", test_mock_connector)
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
    print("Test Summary")
    print(f"{'=' * 60}")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{test_name:<25} {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Python connector system is ready.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == '__main__':
    exit(main())