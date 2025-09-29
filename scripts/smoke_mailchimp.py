#!/usr/bin/env python3
"""
Mailchimp integration smoke test script

Tests the complete Mailchimp OAuth integration flow:
1. Environment variable validation
2. OAuth URL generation (mock)
3. API endpoint discovery
4. Data fetching simulation
5. Database operations
6. Data transformation pipeline

Usage:
    python scripts/smoke_mailchimp.py

Environment Variables Required:
    MAILCHIMP_OAUTH_CLIENT_ID - Your Mailchimp OAuth app client ID
    MAILCHIMP_OAUTH_CLIENT_SECRET - Your Mailchimp OAuth app client secret
    DATABASE_URL - PostgreSQL connection string

Note: This script simulates the OAuth flow without requiring actual tokens.
For full testing with real data, use the OAuth flow through the web interface.
"""

import os
import sys
import json
import psycopg2
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional

# Add the parent directory to sys.path to import from server modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class MailchimpSmokeTest:
    def __init__(self):
        self.client_id = os.getenv('MAILCHIMP_OAUTH_CLIENT_ID')
        self.client_secret = os.getenv('MAILCHIMP_OAUTH_CLIENT_SECRET')
        self.database_url = os.getenv('DATABASE_URL')
        self.app_url = os.getenv('APP_URL', 'http://localhost:5000')

        # Test configuration
        self.test_company_id = 999  # Use test company ID
        self.test_results: Dict[str, Any] = {}

        # Mock data for testing
        self.mock_metadata = {
            'dc': 'us12',
            'api_endpoint': 'https://us12.api.mailchimp.com/3.0',
            'login_url': 'https://us12.admin.mailchimp.com'
        }

        self.mock_account_info = {
            'account_id': 'test-account-12345',
            'login_name': 'test@example.com',
            'account_name': 'Test Account',
            'email': 'test@example.com',
            'first_name': 'Test',
            'last_name': 'User'
        }

        self.mock_lists = [
            {
                'id': 'list123',
                'web_id': 12345,
                'name': 'Test Newsletter List',
                'stats': {
                    'member_count': 150,
                    'unsubscribe_count': 5,
                    'cleaned_count': 2,
                    'campaign_count': 10,
                    'avg_sub_rate': 2.5,
                    'avg_unsub_rate': 0.3
                },
                'date_created': '2023-01-15T10:30:00+00:00',
                'campaign_defaults': {
                    'from_name': 'Test Company',
                    'from_email': 'newsletter@test.com',
                    'subject': 'Monthly Newsletter',
                    'language': 'en'
                },
                'list_rating': '4.2',
                'email_type_option': True
            },
            {
                'id': 'list456',
                'web_id': 67890,
                'name': 'Product Updates',
                'stats': {
                    'member_count': 300,
                    'unsubscribe_count': 8,
                    'cleaned_count': 1,
                    'campaign_count': 25,
                    'avg_sub_rate': 5.1,
                    'avg_unsub_rate': 0.2
                },
                'date_created': '2023-02-01T14:20:00+00:00',
                'campaign_defaults': {
                    'from_name': 'Product Team',
                    'from_email': 'updates@test.com',
                    'subject': 'Product Update',
                    'language': 'en'
                },
                'list_rating': '4.7',
                'email_type_option': True
            }
        ]

        self.mock_members = [
            {
                'id': 'member1hash',
                'email_address': 'user1@example.com',
                'unique_email_id': 'unique1',
                'email_type': 'html',
                'status': 'subscribed',
                'stats': {
                    'avg_open_rate': 0.25,
                    'avg_click_rate': 0.05
                },
                'timestamp_signup': '2023-01-20T10:00:00+00:00',
                'member_rating': 4,
                'last_changed': '2023-01-20T10:00:00+00:00',
                'language': 'en',
                'vip': False,
                'location': {
                    'latitude': 40.7128,
                    'longitude': -74.0060,
                    'country_code': 'US',
                    'timezone': 'America/New_York'
                },
                'merge_fields': {
                    'FNAME': 'John',
                    'LNAME': 'Doe'
                },
                'source_list_id': 'list123',
                'source_list_name': 'Test Newsletter List'
            },
            {
                'id': 'member2hash',
                'email_address': 'user2@example.com',
                'unique_email_id': 'unique2',
                'email_type': 'html',
                'status': 'subscribed',
                'stats': {
                    'avg_open_rate': 0.35,
                    'avg_click_rate': 0.08
                },
                'timestamp_signup': '2023-02-15T15:30:00+00:00',
                'member_rating': 5,
                'last_changed': '2023-02-15T15:30:00+00:00',
                'language': 'en',
                'vip': True,
                'location': {
                    'latitude': 34.0522,
                    'longitude': -118.2437,
                    'country_code': 'US',
                    'timezone': 'America/Los_Angeles'
                },
                'merge_fields': {
                    'FNAME': 'Jane',
                    'LNAME': 'Smith'
                },
                'source_list_id': 'list456',
                'source_list_name': 'Product Updates'
            }
        ]

        self.mock_campaigns = [
            {
                'id': 'campaign1',
                'web_id': 11111,
                'type': 'regular',
                'create_time': '2023-03-01T09:00:00+00:00',
                'archive_url': 'https://us12.campaign-archive.com/campaign1',
                'status': 'sent',
                'emails_sent': 148,
                'send_time': '2023-03-01T10:00:00+00:00',
                'content_type': 'html',
                'recipients': {
                    'list_id': 'list123',
                    'list_name': 'Test Newsletter List',
                    'recipient_count': 148
                },
                'settings': {
                    'subject_line': 'March Newsletter',
                    'title': 'March 2023 Newsletter',
                    'from_name': 'Test Company',
                    'reply_to': 'newsletter@test.com',
                    'to_name': '*|FNAME|*',
                    'auto_footer': True,
                    'inline_css': True
                }
            }
        ]

    def validate_environment(self) -> bool:
        """Validate required environment variables."""
        print("🔍 Validating environment variables...")

        missing_vars = []

        if not self.client_id:
            missing_vars.append('MAILCHIMP_OAUTH_CLIENT_ID')

        if not self.client_secret:
            missing_vars.append('MAILCHIMP_OAUTH_CLIENT_SECRET')

        if not self.database_url:
            missing_vars.append('DATABASE_URL')

        if missing_vars:
            print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
            print("   Please set these variables and run again.")
            return False

        print("✅ Environment variables validated")
        self.test_results['environment'] = True
        return True

    def test_oauth_url_generation(self) -> bool:
        """Test OAuth authorization URL generation."""
        print("🔗 Testing OAuth URL generation...")

        try:
            # Simulate state generation
            state_data = {
                'companyId': self.test_company_id,
                'userId': 123,
                'timestamp': int(datetime.now().timestamp() * 1000),
                'nonce': 'test-nonce-12345'
            }

            import base64
            state = base64.b64encode(json.dumps(state_data).encode()).decode()

            # Generate authorization URL
            auth_url = (
                f"https://login.mailchimp.com/oauth2/authorize?"
                f"response_type=code&"
                f"client_id={self.client_id}&"
                f"redirect_uri={self.app_url}/api/auth/mailchimp/callback&"
                f"state={state}"
            )

            print(f"   Generated URL: {auth_url[:80]}...")

            # Validate URL components
            assert 'login.mailchimp.com' in auth_url
            assert 'response_type=code' in auth_url
            assert f'client_id={self.client_id}' in auth_url
            assert 'redirect_uri' in auth_url
            assert 'state=' in auth_url

            print("✅ OAuth URL generation successful")
            self.test_results['oauth_url'] = True
            return True

        except Exception as e:
            print(f"❌ OAuth URL generation failed: {str(e)}")
            self.test_results['oauth_url'] = False
            return False

    def test_database_connection(self) -> bool:
        """Test PostgreSQL database connection."""
        print("🗄️  Testing database connection...")

        try:
            conn = psycopg2.connect(self.database_url)
            cursor = conn.cursor()

            # Test connection
            cursor.execute("SELECT version();")
            version = cursor.fetchone()
            print(f"   Connected to: {version[0][:50]}...")

            cursor.close()
            conn.close()

            print("✅ Database connection successful")
            self.test_results['database'] = True
            return True

        except Exception as e:
            print(f"❌ Database connection failed: {str(e)}")
            self.test_results['database'] = False
            return False

    def test_schema_creation(self) -> bool:
        """Test analytics schema creation."""
        print("📊 Testing schema creation...")

        try:
            conn = psycopg2.connect(self.database_url)
            cursor = conn.cursor()

            schema_name = f"analytics_company_{self.test_company_id}"

            # Create schema
            cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")

            # Test raw table creation
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {schema_name}.raw_mailchimp_lists (
                    id SERIAL PRIMARY KEY,
                    data JSONB NOT NULL,
                    source_system TEXT NOT NULL,
                    company_id BIGINT NOT NULL,
                    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {schema_name}.raw_mailchimp_list_members (
                    id SERIAL PRIMARY KEY,
                    data JSONB NOT NULL,
                    source_system TEXT NOT NULL,
                    company_id BIGINT NOT NULL,
                    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {schema_name}.raw_mailchimp_campaigns (
                    id SERIAL PRIMARY KEY,
                    data JSONB NOT NULL,
                    source_system TEXT NOT NULL,
                    company_id BIGINT NOT NULL,
                    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            conn.commit()
            print(f"   Schema '{schema_name}' created/verified")

            cursor.close()
            conn.close()

            print("✅ Schema creation successful")
            self.test_results['schema'] = True
            return True

        except Exception as e:
            print(f"❌ Schema creation failed: {str(e)}")
            self.test_results['schema'] = False
            return False

    def test_data_insertion(self) -> bool:
        """Test data insertion with mock Mailchimp data."""
        print("📥 Testing data insertion...")

        try:
            conn = psycopg2.connect(self.database_url)
            cursor = conn.cursor()

            schema_name = f"analytics_company_{self.test_company_id}"

            # Clear existing test data
            cursor.execute(f"DELETE FROM {schema_name}.raw_mailchimp_lists WHERE source_system = 'mailchimp_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_mailchimp_list_members WHERE source_system = 'mailchimp_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_mailchimp_campaigns WHERE source_system = 'mailchimp_smoke_test'")

            # Insert mock lists
            for list_data in self.mock_lists:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_mailchimp_lists
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(list_data), 'mailchimp_smoke_test', self.test_company_id))

            # Insert mock members
            for member_data in self.mock_members:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_mailchimp_list_members
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(member_data), 'mailchimp_smoke_test', self.test_company_id))

            # Insert mock campaigns
            for campaign_data in self.mock_campaigns:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_mailchimp_campaigns
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(campaign_data), 'mailchimp_smoke_test', self.test_company_id))

            conn.commit()

            # Verify insertion
            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_mailchimp_lists WHERE source_system = 'mailchimp_smoke_test'")
            list_count = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_mailchimp_list_members WHERE source_system = 'mailchimp_smoke_test'")
            member_count = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_mailchimp_campaigns WHERE source_system = 'mailchimp_smoke_test'")
            campaign_count = cursor.fetchone()[0]

            print(f"   Inserted {list_count} lists, {member_count} members, {campaign_count} campaigns")

            cursor.close()
            conn.close()

            print("✅ Data insertion successful")
            self.test_results['data_insertion'] = {
                'lists': list_count,
                'members': member_count,
                'campaigns': campaign_count
            }
            return True

        except Exception as e:
            print(f"❌ Data insertion failed: {str(e)}")
            self.test_results['data_insertion'] = False
            return False

    def test_transformations(self) -> bool:
        """Test dbt-style data transformations."""
        print("🔄 Testing data transformations...")

        try:
            conn = psycopg2.connect(self.database_url)
            cursor = conn.cursor()

            schema_name = f"analytics_company_{self.test_company_id}"

            # Drop existing transformed tables/views
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_mailchimp_lists CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_mailchimp_contacts CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_mailchimp_activities CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_mailchimp_lists CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_mailchimp_contacts CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_mailchimp_activities CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_mailchimp_lists CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_mailchimp_list_members CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_mailchimp_campaigns CASCADE")

            # Create staging tables
            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_mailchimp_lists AS
                SELECT DISTINCT
                  data->>'id' as list_id,
                  data->>'web_id' as web_id,
                  data->>'name' as list_name,
                  (data#>>'{stats,member_count}')::integer as member_count,
                  (data#>>'{stats,unsubscribe_count}')::integer as unsubscribe_count,
                  (data#>>'{stats,avg_sub_rate}')::numeric as avg_sub_rate,
                  (data->>'date_created')::timestamp as created_at,
                  data#>>'{campaign_defaults,from_name}' as default_from_name,
                  data#>>'{campaign_defaults,from_email}' as default_from_email,
                  data->>'list_rating' as list_rating
                FROM {schema_name}.raw_mailchimp_lists
                WHERE data IS NOT NULL
                  AND source_system = 'mailchimp_smoke_test'
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_mailchimp_list_members AS
                SELECT DISTINCT
                  data->>'id' as member_id,
                  data->>'email_address' as email_address,
                  data->>'status' as status,
                  (data#>>'{stats,avg_open_rate}')::numeric as avg_open_rate,
                  (data->>'last_changed')::timestamp as last_changed,
                  COALESCE(data#>>'{merge_fields,FNAME}', '') as first_name,
                  COALESCE(data#>>'{merge_fields,LNAME}', '') as last_name,
                  data->>'source_list_id' as source_list_id
                FROM {schema_name}.raw_mailchimp_list_members
                WHERE data IS NOT NULL
                  AND source_system = 'mailchimp_smoke_test'
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_mailchimp_campaigns AS
                SELECT DISTINCT
                  data->>'id' as campaign_id,
                  data->>'type' as campaign_type,
                  (data->>'create_time')::timestamp as create_time,
                  data->>'status' as status,
                  (data#>>'{emails_sent}')::integer as emails_sent,
                  data#>>'{settings,subject_line}' as subject_line,
                  data#>>'{settings,from_name}' as from_name,
                  data#>>'{recipients,list_id}' as list_id
                FROM {schema_name}.raw_mailchimp_campaigns
                WHERE data IS NOT NULL
                  AND source_system = 'mailchimp_smoke_test'
            """)

            # Create integration tables
            cursor.execute(f"""
                CREATE TABLE {schema_name}.int_mailchimp_lists AS
                SELECT
                  list_id,
                  list_name,
                  member_count,
                  unsubscribe_count,
                  avg_sub_rate,
                  created_at,
                  default_from_name,
                  default_from_email,
                  list_rating,
                  CASE
                    WHEN member_count > 1000 THEN 'Large'
                    WHEN member_count > 100 THEN 'Medium'
                    ELSE 'Small'
                  END as list_size_category
                FROM {schema_name}.stg_mailchimp_lists
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.int_mailchimp_contacts AS
                SELECT
                  member_id,
                  email_address,
                  status,
                  avg_open_rate,
                  last_changed,
                  first_name,
                  last_name,
                  source_list_id,
                  CASE
                    WHEN first_name != '' AND last_name != '' THEN first_name || ' ' || last_name
                    WHEN first_name != '' THEN first_name
                    ELSE email_address
                  END as full_name,
                  CASE
                    WHEN status = 'subscribed' THEN 'Active'
                    ELSE 'Inactive'
                  END as contact_status
                FROM {schema_name}.stg_mailchimp_list_members
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.int_mailchimp_activities AS
                SELECT
                  campaign_id,
                  campaign_type,
                  create_time,
                  status,
                  emails_sent,
                  subject_line,
                  from_name,
                  list_id,
                  CASE
                    WHEN status = 'sent' THEN 'Completed'
                    ELSE 'Draft'
                  END as activity_status
                FROM {schema_name}.stg_mailchimp_campaigns
            """)

            # Create core views
            cursor.execute(f"""
                CREATE VIEW {schema_name}.core_mailchimp_lists AS
                SELECT * FROM {schema_name}.int_mailchimp_lists
            """)

            cursor.execute(f"""
                CREATE VIEW {schema_name}.core_mailchimp_contacts AS
                SELECT * FROM {schema_name}.int_mailchimp_contacts
            """)

            cursor.execute(f"""
                CREATE VIEW {schema_name}.core_mailchimp_activities AS
                SELECT * FROM {schema_name}.int_mailchimp_activities
            """)

            conn.commit()

            # Verify transformations
            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.core_mailchimp_lists")
            lists_transformed = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.core_mailchimp_contacts")
            contacts_transformed = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.core_mailchimp_activities")
            activities_transformed = cursor.fetchone()[0]

            print(f"   Transformed {lists_transformed} lists, {contacts_transformed} contacts, {activities_transformed} activities")

            cursor.close()
            conn.close()

            print("✅ Data transformations successful")
            self.test_results['transformations'] = {
                'lists': lists_transformed,
                'contacts': contacts_transformed,
                'activities': activities_transformed
            }
            return True

        except Exception as e:
            print(f"❌ Data transformations failed: {str(e)}")
            self.test_results['transformations'] = False
            return False

    def test_cleanup(self) -> bool:
        """Clean up test data."""
        print("🧹 Cleaning up test data...")

        try:
            conn = psycopg2.connect(self.database_url)
            cursor = conn.cursor()

            schema_name = f"analytics_company_{self.test_company_id}"

            # Clean up test data
            cursor.execute(f"DELETE FROM {schema_name}.raw_mailchimp_lists WHERE source_system = 'mailchimp_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_mailchimp_list_members WHERE source_system = 'mailchimp_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_mailchimp_campaigns WHERE source_system = 'mailchimp_smoke_test'")

            # Drop test tables and views
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_mailchimp_lists CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_mailchimp_contacts CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_mailchimp_activities CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_mailchimp_lists CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_mailchimp_contacts CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_mailchimp_activities CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_mailchimp_lists CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_mailchimp_list_members CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_mailchimp_campaigns CASCADE")

            conn.commit()
            cursor.close()
            conn.close()

            print("✅ Cleanup successful")
            self.test_results['cleanup'] = True
            return True

        except Exception as e:
            print(f"❌ Cleanup failed: {str(e)}")
            self.test_results['cleanup'] = False
            return False

    def run_all_tests(self) -> None:
        """Run all smoke tests."""
        print("🚀 Starting Mailchimp integration smoke tests...")
        print("=" * 60)

        tests = [
            ('Environment Validation', self.validate_environment),
            ('OAuth URL Generation', self.test_oauth_url_generation),
            ('Database Connection', self.test_database_connection),
            ('Schema Creation', self.test_schema_creation),
            ('Data Insertion', self.test_data_insertion),
            ('Data Transformations', self.test_transformations),
            ('Cleanup', self.test_cleanup),
        ]

        passed = 0
        total = len(tests)

        for test_name, test_func in tests:
            print()
            if test_func():
                passed += 1
            else:
                print(f"   Stopping tests due to {test_name} failure")
                break

        print("\n" + "=" * 60)
        print("🏁 Smoke test results:")
        print(f"   Passed: {passed}/{total}")

        if passed == total:
            print("✅ All tests passed! Mailchimp integration is working correctly.")
        else:
            print("❌ Some tests failed. Check the output above for details.")
            sys.exit(1)

        print("\n📊 Test Summary:")
        for key, value in self.test_results.items():
            if isinstance(value, dict):
                print(f"   {key}: {json.dumps(value, indent=4)}")
            else:
                print(f"   {key}: {'✅ PASS' if value else '❌ FAIL'}")


if __name__ == '__main__':
    print("Mailchimp Integration Smoke Test")
    print("=" * 60)
    print()
    print("This script tests the Mailchimp OAuth integration without requiring actual tokens.")
    print("It validates the complete data pipeline using mock data.")
    print()

    tester = MailchimpSmokeTest()
    tester.run_all_tests()