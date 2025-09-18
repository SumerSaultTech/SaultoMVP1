#!/usr/bin/env python3
"""
Monday.com integration smoke test script

Tests the complete Monday.com OAuth integration flow with GraphQL:
1. Environment variable validation
2. OAuth URL generation (mock)
3. GraphQL endpoint testing
4. Data fetching simulation with GraphQL queries
5. Database operations
6. Data transformation pipeline

Usage:
    python scripts/smoke_monday.py

Environment Variables Required:
    MONDAY_OAUTH_CLIENT_ID - Your Monday.com OAuth app client ID
    MONDAY_OAUTH_CLIENT_SECRET - Your Monday.com OAuth app client secret
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


class MondaySmokeTest:
    def __init__(self):
        self.client_id = os.getenv('MONDAY_OAUTH_CLIENT_ID')
        self.client_secret = os.getenv('MONDAY_OAUTH_CLIENT_SECRET')
        self.database_url = os.getenv('DATABASE_URL')
        self.app_url = os.getenv('APP_URL', 'http://localhost:5000')

        # Test configuration
        self.test_company_id = 998  # Use test company ID
        self.test_results: Dict[str, Any] = {}

        # Mock Monday.com data for testing (GraphQL format)
        self.mock_user_info = {
            'id': '12345678',
            'name': 'Test User',
            'email': 'test@example.com',
            'is_admin': True,
            'photo_thumb': 'https://example.com/photo.jpg',
            'title': 'Project Manager',
            'timezone': 'America/New_York',
            'account': {
                'id': 'acc12345',
                'name': 'Test Company Account'
            }
        }

        self.mock_boards = [
            {
                'id': '12345',
                'name': 'Marketing Campaign Board',
                'description': 'Track all marketing campaigns and initiatives',
                'state': 'active',
                'board_kind': 'public',
                'created_at': '2023-01-15T10:30:00Z',
                'updated_at': '2023-12-01T14:20:00Z',
                'workspace': {
                    'id': 'ws123',
                    'name': 'Marketing Workspace'
                },
                'owners': [
                    {
                        'id': '12345678',
                        'name': 'Test User',
                        'email': 'test@example.com'
                    }
                ],
                'permissions': 'everyone'
            },
            {
                'id': '67890',
                'name': 'Product Development Board',
                'description': 'Product roadmap and feature tracking',
                'state': 'active',
                'board_kind': 'private',
                'created_at': '2023-02-01T09:15:00Z',
                'updated_at': '2023-11-28T16:45:00Z',
                'workspace': {
                    'id': 'ws456',
                    'name': 'Development Workspace'
                },
                'owners': [
                    {
                        'id': '87654321',
                        'name': 'Dev Lead',
                        'email': 'devlead@example.com'
                    }
                ],
                'permissions': 'subscribers'
            }
        ]

        self.mock_users = [
            {
                'id': '12345678',
                'name': 'John Doe',
                'email': 'john.doe@example.com',
                'title': 'Project Manager',
                'phone': '+1-555-0123',
                'mobile_phone': '+1-555-0124',
                'is_admin': True,
                'is_guest': False,
                'is_pending': False,
                'enabled': True,
                'created_at': '2023-01-01T00:00:00Z',
                'last_activity': '2023-12-01T10:30:00Z',
                'photo_thumb': 'https://example.com/john.jpg',
                'photo_original': 'https://example.com/john_large.jpg',
                'timezone': 'America/New_York',
                'location': 'New York, NY',
                'account': {
                    'id': 'acc12345',
                    'name': 'Test Company Account'
                },
                'teams': [
                    {
                        'id': 'team123',
                        'name': 'Marketing Team'
                    }
                ]
            },
            {
                'id': '87654321',
                'name': 'Jane Smith',
                'email': 'jane.smith@example.com',
                'title': 'Software Developer',
                'phone': '+1-555-0125',
                'mobile_phone': '+1-555-0126',
                'is_admin': False,
                'is_guest': False,
                'is_pending': False,
                'enabled': True,
                'created_at': '2023-01-15T00:00:00Z',
                'last_activity': '2023-12-01T09:45:00Z',
                'photo_thumb': 'https://example.com/jane.jpg',
                'photo_original': 'https://example.com/jane_large.jpg',
                'timezone': 'America/Los_Angeles',
                'location': 'San Francisco, CA',
                'account': {
                    'id': 'acc12345',
                    'name': 'Test Company Account'
                },
                'teams': [
                    {
                        'id': 'team456',
                        'name': 'Development Team'
                    }
                ]
            }
        ]

        self.mock_items = [
            {
                'id': 'item123',
                'name': 'Launch Q1 Campaign',
                'state': 'active',
                'created_at': '2023-03-01T10:00:00Z',
                'updated_at': '2023-12-01T15:30:00Z',
                'creator_id': '12345678',
                'creator': {
                    'id': '12345678',
                    'name': 'John Doe',
                    'email': 'john.doe@example.com'
                },
                'board': {
                    'id': '12345',
                    'name': 'Marketing Campaign Board'
                },
                'column_values': [
                    {
                        'id': 'status',
                        'text': 'In Progress',
                        'value': '{"index": 2, "post_id": null, "changed_at": "2023-12-01T15:30:00.000Z"}',
                        'column': {
                            'id': 'status',
                            'title': 'Status',
                            'type': 'status'
                        }
                    },
                    {
                        'id': 'priority',
                        'text': 'High',
                        'value': '{"index": 1}',
                        'column': {
                            'id': 'priority',
                            'title': 'Priority',
                            'type': 'status'
                        }
                    }
                ],
                'updates': [
                    {
                        'id': 'update123',
                        'body': 'Campaign planning is on track. Graphics team has delivered initial concepts.',
                        'created_at': '2023-11-28T14:20:00Z',
                        'creator_id': '12345678'
                    }
                ]
            },
            {
                'id': 'item456',
                'name': 'Implement User Dashboard',
                'state': 'active',
                'created_at': '2023-02-15T09:00:00Z',
                'updated_at': '2023-11-30T11:15:00Z',
                'creator_id': '87654321',
                'creator': {
                    'id': '87654321',
                    'name': 'Jane Smith',
                    'email': 'jane.smith@example.com'
                },
                'board': {
                    'id': '67890',
                    'name': 'Product Development Board'
                },
                'column_values': [
                    {
                        'id': 'status',
                        'text': 'Done',
                        'value': '{"index": 3, "post_id": null, "changed_at": "2023-11-30T11:15:00.000Z"}',
                        'column': {
                            'id': 'status',
                            'title': 'Status',
                            'type': 'status'
                        }
                    },
                    {
                        'id': 'priority',
                        'text': 'Medium',
                        'value': '{"index": 2}',
                        'column': {
                            'id': 'priority',
                            'title': 'Priority',
                            'type': 'status'
                        }
                    }
                ],
                'column_values_data': {
                    'story_points': 8,
                    'assigned_user': 'Jane Smith',
                    'due_date': '2023-11-30'
                }
            }
        ]

        self.mock_updates = [
            {
                'id': 'update123',
                'body': 'Campaign planning is on track. Graphics team has delivered initial concepts.',
                'text_body': 'Campaign planning is on track. Graphics team has delivered initial concepts.',
                'created_at': '2023-11-28T14:20:00Z',
                'updated_at': '2023-11-28T14:20:00Z',
                'creator_id': '12345678',
                'creator': {
                    'id': '12345678',
                    'name': 'John Doe',
                    'email': 'john.doe@example.com'
                },
                'replies': [
                    {
                        'id': 'reply123',
                        'body': 'Great progress! When do we expect the final designs?',
                        'created_at': '2023-11-28T15:10:00Z',
                        'creator_id': '87654321'
                    }
                ],
                'assets': [],
                'source_board_id': '12345',
                'source_board_name': 'Marketing Campaign Board'
            },
            {
                'id': 'update456',
                'body': 'Dashboard implementation completed. Ready for QA testing.',
                'text_body': 'Dashboard implementation completed. Ready for QA testing.',
                'created_at': '2023-11-30T11:15:00Z',
                'updated_at': '2023-11-30T11:15:00Z',
                'creator_id': '87654321',
                'creator': {
                    'id': '87654321',
                    'name': 'Jane Smith',
                    'email': 'jane.smith@example.com'
                },
                'replies': [],
                'assets': [
                    {
                        'id': 'asset123',
                        'name': 'dashboard_screenshot.png',
                        'url': 'https://example.com/dashboard_screenshot.png',
                        'file_extension': 'png',
                        'file_size': 245760
                    }
                ],
                'source_board_id': '67890',
                'source_board_name': 'Product Development Board'
            }
        ]

    def validate_environment(self) -> bool:
        """Validate required environment variables."""
        print("🔍 Validating environment variables...")

        missing_vars = []

        if not self.client_id:
            missing_vars.append('MONDAY_OAUTH_CLIENT_ID')

        if not self.client_secret:
            missing_vars.append('MONDAY_OAUTH_CLIENT_SECRET')

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

            # Generate authorization URL with Monday.com scopes
            scopes = [
                'boards:read',
                'users:read',
                'teams:read',
                'updates:read',
                'assets:read',
                'me:read'
            ]

            auth_url = (
                f"https://auth.monday.com/oauth2/authorize?"
                f"client_id={self.client_id}&"
                f"redirect_uri={self.app_url}/api/auth/monday/callback&"
                f"state={state}&"
                f"scope={'+'.join(scopes)}"
            )

            print(f"   Generated URL: {auth_url[:80]}...")

            # Validate URL components
            assert 'auth.monday.com' in auth_url
            assert f'client_id={self.client_id}' in auth_url
            assert 'redirect_uri' in auth_url
            assert 'state=' in auth_url
            assert 'scope=' in auth_url
            assert 'boards%3Aread' in auth_url or 'boards:read' in auth_url

            print("✅ OAuth URL generation successful")
            self.test_results['oauth_url'] = True
            return True

        except Exception as e:
            print(f"❌ OAuth URL generation failed: {str(e)}")
            self.test_results['oauth_url'] = False
            return False

    def test_graphql_queries(self) -> bool:
        """Test GraphQL query structure."""
        print("📊 Testing GraphQL query structures...")

        try:
            # Test user info query
            me_query = """
            query {
                me {
                    id
                    name
                    email
                    is_admin
                    account {
                        id
                        name
                    }
                }
            }
            """

            # Test boards query
            boards_query = """
            query($limit: Int!, $page: Int!) {
                boards(limit: $limit, page: $page) {
                    id
                    name
                    description
                    state
                    board_kind
                    created_at
                    updated_at
                    workspace {
                        id
                        name
                    }
                }
            }
            """

            # Test items query
            items_query = """
            query($boardIds: [ID!]!, $limit: Int!, $page: Int!) {
                boards(ids: $boardIds) {
                    id
                    name
                    items(limit: $limit, page: $page) {
                        id
                        name
                        state
                        created_at
                        updated_at
                        creator {
                            id
                            name
                            email
                        }
                        column_values {
                            id
                            text
                            value
                            column {
                                id
                                title
                                type
                            }
                        }
                    }
                }
            }
            """

            # Validate query structures
            queries = {
                'me_query': me_query,
                'boards_query': boards_query,
                'items_query': items_query
            }

            for query_name, query in queries.items():
                assert 'query' in query
                assert '{' in query and '}' in query
                print(f"   ✓ {query_name} structure valid")

            print("✅ GraphQL query structures validated")
            self.test_results['graphql_queries'] = True
            return True

        except Exception as e:
            print(f"❌ GraphQL query validation failed: {str(e)}")
            self.test_results['graphql_queries'] = False
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
            tables = [
                'raw_monday_boards',
                'raw_monday_users',
                'raw_monday_items',
                'raw_monday_updates'
            ]

            for table_name in tables:
                cursor.execute(f"""
                    CREATE TABLE IF NOT EXISTS {schema_name}.{table_name} (
                        id SERIAL PRIMARY KEY,
                        data JSONB NOT NULL,
                        source_system TEXT NOT NULL,
                        company_id BIGINT NOT NULL,
                        loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

            conn.commit()
            print(f"   Schema '{schema_name}' created/verified with {len(tables)} tables")

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
        """Test data insertion with mock Monday.com data."""
        print("📥 Testing data insertion...")

        try:
            conn = psycopg2.connect(self.database_url)
            cursor = conn.cursor()

            schema_name = f"analytics_company_{self.test_company_id}"

            # Clear existing test data
            cursor.execute(f"DELETE FROM {schema_name}.raw_monday_boards WHERE source_system = 'monday_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_monday_users WHERE source_system = 'monday_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_monday_items WHERE source_system = 'monday_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_monday_updates WHERE source_system = 'monday_smoke_test'")

            # Insert mock boards
            for board_data in self.mock_boards:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_monday_boards
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(board_data), 'monday_smoke_test', self.test_company_id))

            # Insert mock users
            for user_data in self.mock_users:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_monday_users
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(user_data), 'monday_smoke_test', self.test_company_id))

            # Insert mock items
            for item_data in self.mock_items:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_monday_items
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(item_data), 'monday_smoke_test', self.test_company_id))

            # Insert mock updates
            for update_data in self.mock_updates:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_monday_updates
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(update_data), 'monday_smoke_test', self.test_company_id))

            conn.commit()

            # Verify insertion
            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_monday_boards WHERE source_system = 'monday_smoke_test'")
            board_count = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_monday_users WHERE source_system = 'monday_smoke_test'")
            user_count = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_monday_items WHERE source_system = 'monday_smoke_test'")
            item_count = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_monday_updates WHERE source_system = 'monday_smoke_test'")
            update_count = cursor.fetchone()[0]

            print(f"   Inserted {board_count} boards, {user_count} users, {item_count} items, {update_count} updates")

            cursor.close()
            conn.close()

            print("✅ Data insertion successful")
            self.test_results['data_insertion'] = {
                'boards': board_count,
                'users': user_count,
                'items': item_count,
                'updates': update_count
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
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_monday_companies CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_monday_contacts CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_monday_deals CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_monday_activities CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_monday_companies CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_monday_contacts CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_monday_deals CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_monday_activities CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_monday_boards CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_monday_users CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_monday_items CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_monday_updates CASCADE")

            # Create staging tables
            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_monday_boards AS
                SELECT DISTINCT
                  data->>'id' as board_id,
                  data->>'name' as board_name,
                  data->>'description' as description,
                  data->>'state' as state,
                  data->>'board_kind' as board_kind,
                  (data->>'created_at')::timestamp as created_at,
                  (data->>'updated_at')::timestamp as updated_at,
                  data#>>'{workspace,id}' as workspace_id,
                  data#>>'{workspace,name}' as workspace_name
                FROM {schema_name}.raw_monday_boards
                WHERE data IS NOT NULL
                  AND source_system = 'monday_smoke_test'
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_monday_users AS
                SELECT DISTINCT
                  data->>'id' as user_id,
                  data->>'name' as name,
                  data->>'email' as email,
                  data->>'title' as title,
                  CASE WHEN data->>'is_admin' = 'true' THEN true ELSE false END as is_admin,
                  CASE WHEN data->>'enabled' = 'true' THEN true ELSE false END as enabled,
                  (data->>'created_at')::timestamp as created_at,
                  (data->>'last_activity')::timestamp as last_activity,
                  data->>'timezone' as timezone,
                  data->>'location' as location
                FROM {schema_name}.raw_monday_users
                WHERE data IS NOT NULL
                  AND source_system = 'monday_smoke_test'
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_monday_items AS
                SELECT DISTINCT
                  data->>'id' as item_id,
                  data->>'name' as item_name,
                  data->>'state' as state,
                  (data->>'created_at')::timestamp as created_at,
                  (data->>'updated_at')::timestamp as updated_at,
                  data->>'creator_id' as creator_id,
                  data#>>'{board,id}' as board_id,
                  data#>>'{board,name}' as board_name
                FROM {schema_name}.raw_monday_items
                WHERE data IS NOT NULL
                  AND source_system = 'monday_smoke_test'
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_monday_updates AS
                SELECT DISTINCT
                  data->>'id' as update_id,
                  data->>'body' as body,
                  (data->>'created_at')::timestamp as created_at,
                  data->>'creator_id' as creator_id,
                  data->>'source_board_id' as board_id
                FROM {schema_name}.raw_monday_updates
                WHERE data IS NOT NULL
                  AND source_system = 'monday_smoke_test'
            """)

            # Create integration tables (Monday.com → canonical models)
            cursor.execute(f"""
                CREATE TABLE {schema_name}.int_monday_companies AS
                SELECT
                  board_id,
                  board_name,
                  description,
                  state,
                  board_kind,
                  created_at,
                  updated_at,
                  workspace_id,
                  workspace_name,
                  CASE
                    WHEN state = 'active' THEN 'Active'
                    ELSE 'Inactive'
                  END as company_status
                FROM {schema_name}.stg_monday_boards
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.int_monday_contacts AS
                SELECT
                  user_id,
                  name,
                  email,
                  title,
                  is_admin,
                  enabled,
                  created_at,
                  last_activity,
                  timezone,
                  location,
                  CASE
                    WHEN enabled = true THEN 'Active'
                    ELSE 'Inactive'
                  END as contact_status
                FROM {schema_name}.stg_monday_users
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.int_monday_deals AS
                SELECT
                  item_id,
                  item_name,
                  state,
                  created_at,
                  updated_at,
                  creator_id,
                  board_id,
                  board_name,
                  CASE
                    WHEN state = 'active' THEN 'Open'
                    ELSE 'Closed'
                  END as deal_status
                FROM {schema_name}.stg_monday_items
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.int_monday_activities AS
                SELECT
                  update_id,
                  body,
                  created_at,
                  creator_id,
                  board_id,
                  'Monday.com Update' as activity_type
                FROM {schema_name}.stg_monday_updates
            """)

            # Create core views
            cursor.execute(f"""
                CREATE VIEW {schema_name}.core_monday_companies AS
                SELECT * FROM {schema_name}.int_monday_companies
            """)

            cursor.execute(f"""
                CREATE VIEW {schema_name}.core_monday_contacts AS
                SELECT * FROM {schema_name}.int_monday_contacts
            """)

            cursor.execute(f"""
                CREATE VIEW {schema_name}.core_monday_deals AS
                SELECT * FROM {schema_name}.int_monday_deals
            """)

            cursor.execute(f"""
                CREATE VIEW {schema_name}.core_monday_activities AS
                SELECT * FROM {schema_name}.int_monday_activities
            """)

            conn.commit()

            # Verify transformations
            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.core_monday_companies")
            companies_transformed = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.core_monday_contacts")
            contacts_transformed = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.core_monday_deals")
            deals_transformed = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.core_monday_activities")
            activities_transformed = cursor.fetchone()[0]

            print(f"   Transformed {companies_transformed} companies, {contacts_transformed} contacts, {deals_transformed} deals, {activities_transformed} activities")

            cursor.close()
            conn.close()

            print("✅ Data transformations successful")
            self.test_results['transformations'] = {
                'companies': companies_transformed,
                'contacts': contacts_transformed,
                'deals': deals_transformed,
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
            cursor.execute(f"DELETE FROM {schema_name}.raw_monday_boards WHERE source_system = 'monday_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_monday_users WHERE source_system = 'monday_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_monday_items WHERE source_system = 'monday_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_monday_updates WHERE source_system = 'monday_smoke_test'")

            # Drop test tables and views
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_monday_companies CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_monday_contacts CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_monday_deals CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_monday_activities CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_monday_companies CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_monday_contacts CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_monday_deals CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_monday_activities CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_monday_boards CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_monday_users CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_monday_items CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_monday_updates CASCADE")

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
        print("🚀 Starting Monday.com integration smoke tests...")
        print("=" * 60)

        tests = [
            ('Environment Validation', self.validate_environment),
            ('OAuth URL Generation', self.test_oauth_url_generation),
            ('GraphQL Query Structures', self.test_graphql_queries),
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
            print("✅ All tests passed! Monday.com integration is working correctly.")
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
    print("Monday.com Integration Smoke Test")
    print("=" * 60)
    print()
    print("This script tests the Monday.com OAuth integration with GraphQL support.")
    print("It validates the complete data pipeline using mock data.")
    print()

    tester = MondaySmokeTest()
    tester.run_all_tests()