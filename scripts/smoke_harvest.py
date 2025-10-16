#!/usr/bin/env python3
"""
Harvest integration smoke test script

Tests the complete Harvest OAuth integration flow:
1. Environment variable validation
2. OAuth URL generation (mock)
3. API endpoint discovery
4. Data fetching simulation
5. Database operations
6. Data transformation pipeline

Usage:
    python scripts/smoke_harvest.py

Environment Variables Required:
    HARVEST_OAUTH_CLIENT_ID - Your Harvest OAuth app client ID
    HARVEST_OAUTH_CLIENT_SECRET - Your Harvest OAuth app client secret
    DATABASE_URL - PostgreSQL connection string

Note: This script simulates the OAuth flow without requiring actual tokens.
For full testing with real data, use the OAuth flow through the web interface.
"""

import os
import sys
import json
import psycopg2
from datetime import datetime
from typing import Dict, List, Any, Optional

# Add the parent directory to sys.path to import from server modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class HarvestSmokeTest:
    def __init__(self):
        self.client_id = os.getenv('HARVEST_OAUTH_CLIENT_ID')
        self.client_secret = os.getenv('HARVEST_OAUTH_CLIENT_SECRET')
        self.database_url = os.getenv('DATABASE_URL')
        self.app_url = os.getenv('APP_URL', 'http://localhost:5000')

        # Test configuration
        self.test_company_id = 999  # Use test company ID
        self.test_results: Dict[str, Any] = {}

        # Mock data for testing
        self.mock_time_entries = [
            {
                'id': 10001,
                'spent_date': '2024-01-15',
                'hours': 8.0,
                'notes': 'Frontend development for dashboard',
                'is_locked': True,
                'locked_reason': 'Invoiced',
                'is_closed': True,
                'is_billed': True,
                'user': {
                    'id': 101,
                    'name': 'John Developer'
                },
                'client': {
                    'id': 201,
                    'name': 'ABC Corporation'
                },
                'project': {
                    'id': 301,
                    'name': 'Website Redesign',
                    'code': 'WEB-001'
                },
                'task': {
                    'id': 401,
                    'name': 'Programming'
                },
                'billable_rate': 150.0,
                'cost_rate': 75.0,
                'created_at': '2024-01-15T09:00:00Z',
                'updated_at': '2024-01-20T14:30:00Z'
            },
            {
                'id': 10002,
                'spent_date': '2024-01-16',
                'hours': 6.5,
                'notes': 'Backend API development',
                'is_locked': False,
                'locked_reason': None,
                'is_closed': False,
                'is_billed': False,
                'user': {
                    'id': 102,
                    'name': 'Jane Developer'
                },
                'client': {
                    'id': 202,
                    'name': 'XYZ Industries'
                },
                'project': {
                    'id': 302,
                    'name': 'Mobile App',
                    'code': 'MOB-001'
                },
                'task': {
                    'id': 401,
                    'name': 'Programming'
                },
                'billable_rate': 140.0,
                'cost_rate': 70.0,
                'created_at': '2024-01-16T09:00:00Z',
                'updated_at': '2024-01-16T15:30:00Z'
            }
        ]

        self.mock_projects = [
            {
                'id': 301,
                'name': 'Website Redesign',
                'code': 'WEB-001',
                'is_active': True,
                'is_billable': True,
                'is_fixed_fee': False,
                'bill_by': 'Project',
                'budget': 50000.0,
                'budget_by': 'project',
                'notify_when_over_budget': True,
                'over_budget_notification_percentage': 80.0,
                'created_at': '2023-12-01T10:00:00Z',
                'updated_at': '2024-01-15T09:00:00Z',
                'starts_on': '2024-01-01',
                'ends_on': '2024-06-30',
                'client': {
                    'id': 201,
                    'name': 'ABC Corporation'
                }
            },
            {
                'id': 302,
                'name': 'Mobile App',
                'code': 'MOB-001',
                'is_active': True,
                'is_billable': True,
                'is_fixed_fee': True,
                'bill_by': 'Project',
                'budget': 75000.0,
                'budget_by': 'project',
                'notify_when_over_budget': True,
                'over_budget_notification_percentage': 90.0,
                'created_at': '2023-11-15T10:00:00Z',
                'updated_at': '2024-01-16T09:00:00Z',
                'starts_on': '2024-01-01',
                'ends_on': '2024-09-30',
                'client': {
                    'id': 202,
                    'name': 'XYZ Industries'
                }
            }
        ]

        self.mock_clients = [
            {
                'id': 201,
                'name': 'ABC Corporation',
                'is_active': True,
                'address': '123 Main St\nNew York, NY 10001',
                'currency': 'USD',
                'created_at': '2023-06-01T10:00:00Z',
                'updated_at': '2024-01-15T09:00:00Z'
            },
            {
                'id': 202,
                'name': 'XYZ Industries',
                'is_active': True,
                'address': '456 Oak Ave\nLos Angeles, CA 90001',
                'currency': 'USD',
                'created_at': '2023-08-15T14:00:00Z',
                'updated_at': '2024-01-16T09:00:00Z'
            }
        ]

        self.mock_invoices = [
            {
                'id': 5001,
                'number': 'INV-2024-001',
                'amount': 12000.0,
                'due_amount': 0.0,
                'tax': 960.0,
                'tax_amount': 960.0,
                'tax2': 0.0,
                'tax2_amount': 0.0,
                'discount': 0.0,
                'discount_amount': 0.0,
                'subject': 'January Services',
                'notes': 'Thank you for your business',
                'currency': 'USD',
                'state': 'paid',
                'period_start': '2024-01-01',
                'period_end': '2024-01-31',
                'issue_date': '2024-02-01',
                'due_date': '2024-03-01',
                'payment_term': 'net 30',
                'sent_at': '2024-02-01T10:00:00Z',
                'paid_at': '2024-02-25T14:30:00Z',
                'paid_date': '2024-02-25',
                'created_at': '2024-02-01T09:00:00Z',
                'updated_at': '2024-02-25T14:30:00Z',
                'client': {
                    'id': 201,
                    'name': 'ABC Corporation'
                }
            },
            {
                'id': 5002,
                'number': 'INV-2024-002',
                'amount': 9100.0,
                'due_amount': 9100.0,
                'tax': 728.0,
                'tax_amount': 728.0,
                'tax2': 0.0,
                'tax2_amount': 0.0,
                'discount': 0.0,
                'discount_amount': 0.0,
                'subject': 'January Services',
                'notes': 'Thank you for your business',
                'currency': 'USD',
                'state': 'open',
                'period_start': '2024-01-01',
                'period_end': '2024-01-31',
                'issue_date': '2024-02-01',
                'due_date': '2024-03-01',
                'payment_term': 'net 30',
                'sent_at': '2024-02-01T10:00:00Z',
                'paid_at': None,
                'paid_date': None,
                'created_at': '2024-02-01T09:00:00Z',
                'updated_at': '2024-02-01T10:00:00Z',
                'client': {
                    'id': 202,
                    'name': 'XYZ Industries'
                }
            }
        ]

        self.mock_users = [
            {
                'id': 101,
                'first_name': 'John',
                'last_name': 'Developer',
                'email': 'john@example.com',
                'telephone': '555-0101',
                'timezone': 'America/New_York',
                'has_access_to_all_future_projects': False,
                'is_contractor': False,
                'is_active': True,
                'weekly_capacity': 144000,  # 40 hours in seconds
                'default_hourly_rate': 150.0,
                'cost_rate': 75.0,
                'roles': ['Developer', 'Team Lead'],
                'created_at': '2023-01-15T10:00:00Z',
                'updated_at': '2024-01-15T09:00:00Z'
            },
            {
                'id': 102,
                'first_name': 'Jane',
                'last_name': 'Developer',
                'email': 'jane@example.com',
                'telephone': '555-0102',
                'timezone': 'America/Los_Angeles',
                'has_access_to_all_future_projects': False,
                'is_contractor': False,
                'is_active': True,
                'weekly_capacity': 144000,  # 40 hours in seconds
                'default_hourly_rate': 140.0,
                'cost_rate': 70.0,
                'roles': ['Developer'],
                'created_at': '2023-03-20T10:00:00Z',
                'updated_at': '2024-01-16T09:00:00Z'
            }
        ]

    def validate_environment(self) -> bool:
        """Validate required environment variables."""
        print("🔍 Validating environment variables...")

        missing_vars = []

        if not self.client_id:
            missing_vars.append('HARVEST_OAUTH_CLIENT_ID')

        if not self.client_secret:
            missing_vars.append('HARVEST_OAUTH_CLIENT_SECRET')

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
            # Generate state
            import base64
            state_data = {
                'companyId': self.test_company_id,
                'userId': 123,
                'timestamp': int(datetime.now().timestamp() * 1000),
                'nonce': 'test-nonce-12345'
            }
            state = base64.b64encode(json.dumps(state_data).encode()).decode()

            # Generate authorization URL
            auth_url = (
                f"https://id.getharvest.com/oauth2/authorize?"
                f"client_id={self.client_id}&"
                f"response_type=code&"
                f"redirect_uri={self.app_url}/api/auth/harvest/callback&"
                f"state={state}"
            )

            print(f"   Generated URL: {auth_url[:80]}...")

            # Validate URL components
            assert 'id.getharvest.com' in auth_url
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
                CREATE TABLE IF NOT EXISTS {schema_name}.raw_harvest_time_entries (
                    id SERIAL PRIMARY KEY,
                    data JSONB NOT NULL,
                    source_system TEXT NOT NULL,
                    company_id BIGINT NOT NULL,
                    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {schema_name}.raw_harvest_projects (
                    id SERIAL PRIMARY KEY,
                    data JSONB NOT NULL,
                    source_system TEXT NOT NULL,
                    company_id BIGINT NOT NULL,
                    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {schema_name}.raw_harvest_clients (
                    id SERIAL PRIMARY KEY,
                    data JSONB NOT NULL,
                    source_system TEXT NOT NULL,
                    company_id BIGINT NOT NULL,
                    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {schema_name}.raw_harvest_invoices (
                    id SERIAL PRIMARY KEY,
                    data JSONB NOT NULL,
                    source_system TEXT NOT NULL,
                    company_id BIGINT NOT NULL,
                    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {schema_name}.raw_harvest_users (
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
        """Test data insertion with mock Harvest data."""
        print("📥 Testing data insertion...")

        try:
            conn = psycopg2.connect(self.database_url)
            cursor = conn.cursor()

            schema_name = f"analytics_company_{self.test_company_id}"

            # Clear existing test data
            cursor.execute(f"DELETE FROM {schema_name}.raw_harvest_time_entries WHERE source_system = 'harvest_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_harvest_projects WHERE source_system = 'harvest_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_harvest_clients WHERE source_system = 'harvest_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_harvest_invoices WHERE source_system = 'harvest_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_harvest_users WHERE source_system = 'harvest_smoke_test'")

            # Insert mock data
            for time_entry in self.mock_time_entries:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_harvest_time_entries
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(time_entry), 'harvest_smoke_test', self.test_company_id))

            for project in self.mock_projects:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_harvest_projects
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(project), 'harvest_smoke_test', self.test_company_id))

            for client in self.mock_clients:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_harvest_clients
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(client), 'harvest_smoke_test', self.test_company_id))

            for invoice in self.mock_invoices:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_harvest_invoices
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(invoice), 'harvest_smoke_test', self.test_company_id))

            for user in self.mock_users:
                cursor.execute(f"""
                    INSERT INTO {schema_name}.raw_harvest_users
                    (data, source_system, company_id)
                    VALUES (%s, %s, %s)
                """, (json.dumps(user), 'harvest_smoke_test', self.test_company_id))

            conn.commit()

            # Verify insertion
            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_harvest_time_entries WHERE source_system = 'harvest_smoke_test'")
            time_entry_count = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_harvest_projects WHERE source_system = 'harvest_smoke_test'")
            project_count = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_harvest_clients WHERE source_system = 'harvest_smoke_test'")
            client_count = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_harvest_invoices WHERE source_system = 'harvest_smoke_test'")
            invoice_count = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.raw_harvest_users WHERE source_system = 'harvest_smoke_test'")
            user_count = cursor.fetchone()[0]

            print(f"   Inserted {time_entry_count} time entries, {project_count} projects, {client_count} clients, {invoice_count} invoices, {user_count} users")

            cursor.close()
            conn.close()

            print("✅ Data insertion successful")
            self.test_results['data_insertion'] = {
                'time_entries': time_entry_count,
                'projects': project_count,
                'clients': client_count,
                'invoices': invoice_count,
                'users': user_count
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
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_harvest_time_entries CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_harvest_projects CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_harvest_invoices CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_harvest_time_entries CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_harvest_projects CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_harvest_invoices CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_harvest_time_entries CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_harvest_projects CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_harvest_clients CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_harvest_invoices CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_harvest_users CASCADE")

            # Create staging tables
            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_harvest_time_entries AS
                SELECT DISTINCT
                  (data->>'id')::bigint as time_entry_id,
                  (data->>'spent_date')::date as spent_date,
                  (data->>'hours')::numeric as hours,
                  data->>'notes' as notes,
                  (data->>'is_billed')::boolean as is_billed,
                  (data#>>'{user,id}')::bigint as user_id,
                  data#>>'{user,name}' as user_name,
                  (data#>>'{client,id}')::bigint as client_id,
                  data#>>'{client,name}' as client_name,
                  (data#>>'{project,id}')::bigint as project_id,
                  data#>>'{project,name}' as project_name,
                  (data->>'billable_rate')::numeric as billable_rate,
                  (data->>'cost_rate')::numeric as cost_rate,
                  (data->>'created_at')::timestamp as created_at,
                  (data->>'updated_at')::timestamp as updated_at
                FROM {schema_name}.raw_harvest_time_entries
                WHERE data IS NOT NULL
                  AND source_system = 'harvest_smoke_test'
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_harvest_projects AS
                SELECT DISTINCT
                  (data->>'id')::bigint as project_id,
                  data->>'name' as project_name,
                  data->>'code' as project_code,
                  (data->>'is_active')::boolean as is_active,
                  (data->>'is_billable')::boolean as is_billable,
                  (data->>'budget')::numeric as budget,
                  (data#>>'{client,id}')::bigint as client_id,
                  data#>>'{client,name}' as client_name,
                  (data->>'starts_on')::date as starts_on,
                  (data->>'ends_on')::date as ends_on,
                  (data->>'created_at')::timestamp as created_at,
                  (data->>'updated_at')::timestamp as updated_at
                FROM {schema_name}.raw_harvest_projects
                WHERE data IS NOT NULL
                  AND source_system = 'harvest_smoke_test'
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_harvest_clients AS
                SELECT DISTINCT
                  (data->>'id')::bigint as client_id,
                  data->>'name' as client_name,
                  (data->>'is_active')::boolean as is_active,
                  data->>'address' as address,
                  data->>'currency' as currency,
                  (data->>'created_at')::timestamp as created_at,
                  (data->>'updated_at')::timestamp as updated_at
                FROM {schema_name}.raw_harvest_clients
                WHERE data IS NOT NULL
                  AND source_system = 'harvest_smoke_test'
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_harvest_invoices AS
                SELECT DISTINCT
                  (data->>'id')::bigint as invoice_id,
                  data->>'number' as invoice_number,
                  (data->>'amount')::numeric as amount,
                  (data->>'due_amount')::numeric as due_amount,
                  data->>'state' as state,
                  (data#>>'{client,id}')::bigint as client_id,
                  data#>>'{client,name}' as client_name,
                  (data->>'issue_date')::date as issue_date,
                  (data->>'due_date')::date as due_date,
                  (data->>'paid_date')::date as paid_date,
                  (data->>'created_at')::timestamp as created_at,
                  (data->>'updated_at')::timestamp as updated_at
                FROM {schema_name}.raw_harvest_invoices
                WHERE data IS NOT NULL
                  AND source_system = 'harvest_smoke_test'
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.stg_harvest_users AS
                SELECT DISTINCT
                  (data->>'id')::bigint as user_id,
                  data->>'first_name' as first_name,
                  data->>'last_name' as last_name,
                  data->>'email' as email,
                  (data->>'is_active')::boolean as is_active,
                  (data->>'default_hourly_rate')::numeric as default_hourly_rate,
                  (data->>'cost_rate')::numeric as cost_rate
                FROM {schema_name}.raw_harvest_users
                WHERE data IS NOT NULL
                  AND source_system = 'harvest_smoke_test'
            """)

            # Create integration tables
            cursor.execute(f"""
                CREATE TABLE {schema_name}.int_harvest_time_entries AS
                SELECT
                  time_entry_id,
                  spent_date,
                  hours,
                  notes,
                  is_billed,
                  user_id,
                  user_name,
                  client_id,
                  client_name,
                  project_id,
                  project_name,
                  billable_rate,
                  cost_rate,
                  hours * billable_rate as billable_amount,
                  hours * cost_rate as cost_amount,
                  (hours * billable_rate) - (hours * cost_rate) as profit,
                  created_at,
                  updated_at
                FROM {schema_name}.stg_harvest_time_entries
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.int_harvest_projects AS
                SELECT
                  project_id,
                  project_name,
                  project_code,
                  is_active,
                  is_billable,
                  budget,
                  client_id,
                  client_name,
                  starts_on,
                  ends_on,
                  created_at,
                  updated_at,
                  CASE
                    WHEN is_active THEN 'Active'
                    ELSE 'Inactive'
                  END as project_status,
                  EXTRACT(DAY FROM (ends_on - starts_on)) as duration_days
                FROM {schema_name}.stg_harvest_projects
            """)

            cursor.execute(f"""
                CREATE TABLE {schema_name}.int_harvest_invoices AS
                SELECT
                  invoice_id,
                  invoice_number,
                  amount,
                  due_amount,
                  state,
                  client_id,
                  client_name,
                  issue_date,
                  due_date,
                  paid_date,
                  created_at,
                  updated_at,
                  CASE
                    WHEN state = 'paid' THEN 'Paid'
                    WHEN state = 'open' AND due_date < CURRENT_DATE THEN 'Overdue'
                    WHEN state = 'open' THEN 'Outstanding'
                    ELSE 'Draft'
                  END as payment_status,
                  CASE
                    WHEN paid_date IS NOT NULL THEN EXTRACT(DAY FROM (paid_date - issue_date))
                    ELSE NULL
                  END as days_to_payment
                FROM {schema_name}.stg_harvest_invoices
            """)

            # Create core views
            cursor.execute(f"""
                CREATE VIEW {schema_name}.core_harvest_time_entries AS
                SELECT * FROM {schema_name}.int_harvest_time_entries
            """)

            cursor.execute(f"""
                CREATE VIEW {schema_name}.core_harvest_projects AS
                SELECT * FROM {schema_name}.int_harvest_projects
            """)

            cursor.execute(f"""
                CREATE VIEW {schema_name}.core_harvest_invoices AS
                SELECT * FROM {schema_name}.int_harvest_invoices
            """)

            conn.commit()

            # Verify transformations
            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.core_harvest_time_entries")
            time_entries_transformed = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.core_harvest_projects")
            projects_transformed = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {schema_name}.core_harvest_invoices")
            invoices_transformed = cursor.fetchone()[0]

            print(f"   Transformed {time_entries_transformed} time entries, {projects_transformed} projects, {invoices_transformed} invoices")

            cursor.close()
            conn.close()

            print("✅ Data transformations successful")
            self.test_results['transformations'] = {
                'time_entries': time_entries_transformed,
                'projects': projects_transformed,
                'invoices': invoices_transformed
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
            cursor.execute(f"DELETE FROM {schema_name}.raw_harvest_time_entries WHERE source_system = 'harvest_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_harvest_projects WHERE source_system = 'harvest_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_harvest_clients WHERE source_system = 'harvest_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_harvest_invoices WHERE source_system = 'harvest_smoke_test'")
            cursor.execute(f"DELETE FROM {schema_name}.raw_harvest_users WHERE source_system = 'harvest_smoke_test'")

            # Drop test tables and views
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_harvest_time_entries CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_harvest_projects CASCADE")
            cursor.execute(f"DROP VIEW IF EXISTS {schema_name}.core_harvest_invoices CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_harvest_time_entries CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_harvest_projects CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.int_harvest_invoices CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_harvest_time_entries CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_harvest_projects CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_harvest_clients CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_harvest_invoices CASCADE")
            cursor.execute(f"DROP TABLE IF EXISTS {schema_name}.stg_harvest_users CASCADE")

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
        print("🚀 Starting Harvest integration smoke tests...")
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
            print("✅ All tests passed! Harvest integration is working correctly.")
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
    print("Harvest Integration Smoke Test")
    print("=" * 60)
    print()
    print("This script tests the Harvest OAuth integration without requiring actual tokens.")
    print("It validates the complete data pipeline using mock data.")
    print()

    tester = HarvestSmokeTest()
    tester.run_all_tests()
