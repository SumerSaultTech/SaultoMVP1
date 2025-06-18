import os
import json
import logging
from typing import Dict, List, Optional, Any
import snowflake.connector
from datetime import datetime
from models import Company, User, DataSource, SqlModel, KpiMetric, ChatMessage, PipelineActivity, SetupStatus

class SnowflakeService:
    """Service to handle all Snowflake database operations"""
    
    def __init__(self):
        self.connection = None
        self.cursor = None
        
    def get_connection(self):
        """Create and return Snowflake connection"""
        if not self.connection:
            try:
                self.connection = snowflake.connector.connect(
                    account=os.environ.get('SNOWFLAKE_ACCOUNT'),
                    user=os.environ.get('SNOWFLAKE_USER'),
                    password=os.environ.get('SNOWFLAKE_PASSWORD'),
                    warehouse=os.environ.get('SNOWFLAKE_WAREHOUSE'),
                    database=os.environ.get('SNOWFLAKE_DATABASE'),
                    schema=os.environ.get('SNOWFLAKE_SCHEMA', 'PUBLIC')
                )
                self.cursor = self.connection.cursor()
                logging.info("Connected to Snowflake successfully")
            except Exception as e:
                logging.error(f"Failed to connect to Snowflake: {e}")
                raise
        return self.connection
    
    def test_connection(self) -> Dict[str, Any]:
        """Test Snowflake connection"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT CURRENT_TIMESTAMP")
            result = cursor.fetchone()
            return {"success": True, "timestamp": str(result[0])}
        except Exception as e:
            logging.error(f"Snowflake connection test failed: {e}")
            return {"success": False, "error": str(e)}
    
    def execute_query(self, query: str, params: tuple = None) -> Dict[str, Any]:
        """Execute a query and return results"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            # Get column names
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            
            # Fetch results
            results = cursor.fetchall()
            
            # Convert to list of dictionaries
            data = []
            for row in results:
                row_dict = {}
                for i, value in enumerate(row):
                    if isinstance(value, datetime):
                        row_dict[columns[i]] = value.isoformat()
                    else:
                        row_dict[columns[i]] = value
                data.append(row_dict)
            
            return {
                "success": True,
                "data": data,
                "columns": columns,
                "row_count": len(data)
            }
        except Exception as e:
            logging.error(f"Query execution failed: {e}")
            return {"success": False, "error": str(e)}
    
    def create_tables_if_not_exist(self):
        """Create application tables in Snowflake if they don't exist"""
        table_definitions = [
            """
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER AUTOINCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) UNIQUE NOT NULL,
                database_name VARCHAR(100),
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER AUTOINCREMENT PRIMARY KEY,
                username VARCHAR(64) UNIQUE NOT NULL,
                email VARCHAR(120) UNIQUE NOT NULL,
                password_hash VARCHAR(256),
                company_id INTEGER REFERENCES companies(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS data_sources (
                id INTEGER AUTOINCREMENT PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                name VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL,
                connection_string TEXT,
                config TEXT,
                status VARCHAR(20) DEFAULT 'inactive',
                last_sync_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS sql_models (
                id INTEGER AUTOINCREMENT PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                name VARCHAR(100) NOT NULL,
                description TEXT,
                sql_content TEXT NOT NULL,
                layer VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'draft',
                deployed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS kpi_metrics (
                id INTEGER AUTOINCREMENT PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                name VARCHAR(100) NOT NULL,
                description TEXT,
                sql_query TEXT NOT NULL,
                business_type VARCHAR(50),
                category VARCHAR(50),
                calculation_type VARCHAR(20) DEFAULT 'snapshot',
                target_value VARCHAR(50),
                status VARCHAR(20) DEFAULT 'active',
                last_calculated_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER AUTOINCREMENT PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                user_id INTEGER REFERENCES users(id),
                session_id VARCHAR(100),
                role VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                file_attachments TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS pipeline_activities (
                id INTEGER AUTOINCREMENT PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                activity_type VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                status VARCHAR(20) NOT NULL,
                details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS setup_status (
                id INTEGER AUTOINCREMENT PRIMARY KEY,
                company_id INTEGER UNIQUE REFERENCES companies(id),
                data_sources_configured BOOLEAN DEFAULT FALSE,
                ai_assistant_enabled BOOLEAN DEFAULT FALSE,
                kpi_metrics_created BOOLEAN DEFAULT FALSE,
                pipeline_deployed BOOLEAN DEFAULT FALSE,
                business_type VARCHAR(100),
                onboarding_completed BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        ]
        
        try:
            for table_sql in table_definitions:
                result = self.execute_query(table_sql)
                if not result["success"]:
                    logging.error(f"Failed to create table: {result['error']}")
            
            # Create default company if none exists
            companies_result = self.execute_query("SELECT COUNT(*) as count FROM companies")
            if companies_result["success"] and companies_result["data"][0]["COUNT"] == 0:
                self.execute_query(
                    "INSERT INTO companies (name, slug, database_name) VALUES (?, ?, ?)",
                    ("Demo Company", "demo_company", "DEMO_COMPANY_DB")
                )
                logging.info("Created default demo company")
                
        except Exception as e:
            logging.error(f"Error creating tables: {e}")
    
    def close_connection(self):
        """Close Snowflake connection"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
        self.connection = None
        self.cursor = None

# Global Snowflake service instance
snowflake_service = SnowflakeService()