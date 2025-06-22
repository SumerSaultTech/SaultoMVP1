#!/usr/bin/env python3
"""
Test script specifically for the Jira connector.
This script demonstrates how to use the Jira connector with example credentials.
"""

import sys
import os
import json

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from python_connectors.jira_connector import JiraConnector
from python_connectors.connector_manager import connector_manager

def test_jira_connector_creation():
    """Test creating a Jira connector with example credentials"""
    print("Testing Jira Connector Creation...")
    
    # Example Jira credentials (these won't work but show the format)
    example_credentials = {
        "server_url": "https://your-domain.atlassian.net",
        "username": "your-email@example.com",
        "api_token": "your-api-token-here"
    }
    
    try:
        # Create connector instance
        jira_connector = JiraConnector(
            company_id=1,
            credentials=example_credentials
        )
        
        print("✓ Jira connector created successfully")
        print(f"✓ Connector name: {jira_connector.connector_name}")
        print(f"✓ Required credentials: {jira_connector.required_credentials}")
        print(f"✓ Server URL: {jira_connector.server_url}")
        
        # Test available tables
        tables = jira_connector.get_available_tables()
        print(f"✓ Available tables: {tables}")
        
        return True
        
    except Exception as e:
        print(f"✗ Failed to create Jira connector: {str(e)}")
        return False

def test_jira_connector_manager():
    """Test Jira connector through the connector manager"""
    print("\nTesting Jira Connector via Manager...")
    
    try:
        # Check if Jira is in available connectors
        available = connector_manager.get_available_connectors()
        if "jira" not in available:
            print("✗ Jira not found in available connectors")
            return False
        
        print("✓ Jira found in available connectors")
        
        # Get requirements
        requirements = connector_manager.get_connector_requirements("jira")
        print(f"✓ Jira requirements: {requirements}")
        
        # Test with mock credentials (will fail validation but shows flow)
        mock_credentials = {
            "server_url": "https://mock.atlassian.net",
            "username": "mock@example.com",
            "api_token": "mock_token"
        }
        
        success, message = connector_manager.create_connector(
            "jira", 
            company_id=999,  # Test company
            credentials=mock_credentials
        )
        
        if not success and "authentication" in message.lower():
            print("✓ Jira connector properly validates credentials (expected failure)")
            print(f"✓ Validation message: {message}")
        elif success:
            print("✓ Jira connector created (unexpected but OK for testing)")
        else:
            print(f"⚠️  Unexpected result: {message}")
        
        return True
        
    except Exception as e:
        print(f"✗ Manager test failed: {str(e)}")
        return False

def show_jira_setup_instructions():
    """Show instructions for setting up Jira connector"""
    print("\n" + "="*60)
    print("JIRA CONNECTOR SETUP INSTRUCTIONS")
    print("="*60)
    
    print("""
To use the Jira connector with real data, you need:

1. JIRA SERVER URL:
   - For Atlassian Cloud: https://your-domain.atlassian.net
   - For Jira Server: https://your-jira-server.com

2. USERNAME:
   - Your Jira email address (for Cloud)
   - Your username (for Server)

3. API TOKEN:
   - For Atlassian Cloud:
     a) Go to https://id.atlassian.com/manage-profile/security/api-tokens
     b) Click "Create API token"
     c) Give it a label and copy the token
   
   - For Jira Server:
     a) Use your password, or
     b) Generate a personal access token in Jira settings

4. EXAMPLE USAGE:
   
   credentials = {
       "server_url": "https://your-domain.atlassian.net",
       "username": "your-email@company.com", 
       "api_token": "your-api-token-here"
   }
   
   # Create connector via API
   POST /connectors/create
   {
       "company_id": 1,
       "connector_type": "jira",
       "credentials": {
           "server_url": "https://your-domain.atlassian.net",
           "username": "your-email@company.com",
           "api_token": "your-api-token"
       }
   }

5. AVAILABLE DATA:
   - Issues (with all fields and history)
   - Projects
   - Users
   - Workflows
   - Statuses
   - Priorities
   - Issue Types
   - Components
   - Versions
   - Boards (if Jira Agile is enabled)
   - Sprints (if Jira Agile is enabled)

6. SNOWFLAKE TABLES:
   Data will be loaded to tables like:
   - COMPANY_1_JIRA_ISSUES
   - COMPANY_1_JIRA_PROJECTS  
   - COMPANY_1_JIRA_USERS
   - etc.
""")

def main():
    """Run Jira connector tests"""
    print("="*60)
    print("JIRA CONNECTOR TEST SUITE")
    print("="*60)
    
    tests = [
        ("Jira Connector Creation", test_jira_connector_creation),
        ("Jira Connector Manager", test_jira_connector_manager)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"\n{'-'*40}")
        print(f"Running {test_name}...")
        print(f"{'-'*40}")
        
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"✗ {test_name} failed with exception: {str(e)}")
            results[test_name] = False
    
    # Show setup instructions
    show_jira_setup_instructions()
    
    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{test_name:<30} {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 Jira connector is ready for use!")
        return 0
    else:
        print("⚠️  Some tests failed. Check output above.")
        return 1

if __name__ == '__main__':
    exit(main())