"""
PostgreSQL data loader for simple connectors.
Replaces Snowflake loader with PostgreSQL for unified data architecture.
"""

import os
import json
import logging
import psycopg
from psycopg import rows
from typing import List, Dict, Any, Optional
from datetime import datetime
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class PostgresLoader:
    """Helper class to load data into PostgreSQL analytics schemas"""
    
    def __init__(self):
        self.connection = None
        self.database_url = os.getenv("DATABASE_URL")
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required")
    
    def get_connection(self):
        """Get PostgreSQL connection"""
        if not self.connection or self.connection.closed:
            try:
                self.connection = psycopg.connect(self.database_url, autocommit=True)
                logger.info("Connected to PostgreSQL successfully")
            except Exception as e:
                logger.error(f"Failed to connect to PostgreSQL: {e}")
                raise
        return self.connection
    
    def get_analytics_schema_name(self, company_id: int) -> str:
        """Get analytics schema name for company"""
        return f"analytics_company_{company_id}"
    
    def ensure_analytics_schema(self, company_id: int):
        """Create analytics schema for company if it doesn't exist"""
        try:
            schema_name = self.get_analytics_schema_name(company_id)
            conn = self.get_connection()
            
            with conn.cursor() as cursor:
                # Create schema if not exists
                cursor.execute(f"""
                    CREATE SCHEMA IF NOT EXISTS {schema_name}
                """)
                logger.info(f"Created/verified analytics schema: {schema_name}")
                
        except Exception as e:
            logger.error(f"Error creating analytics schema for company {company_id}: {e}")
            raise
    
    def clean_column_name(self, name: str) -> str:
        """Clean column name for PostgreSQL compatibility"""
        return name.replace(' ', '_').replace('-', '_').replace('.', '_').lower()
    
    def get_postgres_type(self, value: Any) -> str:
        """Determine PostgreSQL data type from Python value"""
        if value is None:
            return "TEXT"
        elif isinstance(value, bool):
            return "BOOLEAN"
        elif isinstance(value, int):
            # Use BIGINT for potentially large IDs
            return "BIGINT"
        elif isinstance(value, float):
            return "NUMERIC"
        elif isinstance(value, datetime):
            return "TIMESTAMP"
        elif isinstance(value, (dict, list)):
            return "JSONB"
        else:
            return "TEXT"
    
    def create_table_if_not_exists(self, table_name: str, data: List[Dict[str, Any]], company_id: int):
        """Create table in PostgreSQL analytics schema if it doesn't exist"""
        try:
            schema_name = self.get_analytics_schema_name(company_id)
            full_table_name = f"{schema_name}.{table_name.lower()}"
            
            conn = self.get_connection()
            
            with conn.cursor() as cursor:
                # Collect all possible columns from all records
                all_columns = {}
                for record in data:
                    for key, value in record.items():
                        clean_key = self.clean_column_name(key)
                        if clean_key not in all_columns:
                            # Use TEXT as default type for flexible data handling
                            # This avoids integer overflow and data type mismatch issues
                            all_columns[clean_key] = "TEXT"
                
                # Generate column definitions 
                columns = []
                for clean_key in sorted(all_columns.keys()):
                    col_type = all_columns[clean_key]
                    columns.append(f"{clean_key} {col_type}")
                
                # Add metadata columns
                columns.extend([
                    "loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                    "source_system VARCHAR(100)",
                    "company_id BIGINT"  # Use BIGINT to handle large company IDs
                ])
                
                create_sql = f"""
                    CREATE TABLE IF NOT EXISTS {full_table_name} (
                        {', '.join(columns)}
                    )
                """
                
                cursor.execute(create_sql)
                logger.info(f"Created/verified table {full_table_name} with {len(all_columns)} data columns")
                
        except Exception as e:
            logger.error(f"Error creating table {table_name}: {e}")
            raise
    
    def prepare_value_for_insert(self, value: Any) -> Any:
        """Prepare value for PostgreSQL insertion"""
        if value is None:
            return None
        elif isinstance(value, (dict, list)):
            return json.dumps(value)  # Store complex objects as JSON
        elif isinstance(value, bool):
            return str(value).lower()  # Convert to string for TEXT columns
        elif isinstance(value, (int, float)):
            # Always convert numbers to strings since our tables use TEXT columns
            return str(value)
        elif isinstance(value, datetime):
            return value.isoformat()  # Convert to string for TEXT storage
        else:
            return str(value)
    
    def load_data(self, table_name: str, data: List[Dict[str, Any]], 
                  source_system: str, company_id: int) -> int:
        """Load data into PostgreSQL analytics table"""
        if not data:
            logger.info("No data to load")
            return 0
            
        try:
            # Ensure analytics schema exists
            self.ensure_analytics_schema(company_id)
            
            # Create table if needed
            self.create_table_if_not_exists(table_name, data, company_id)
            
            schema_name = self.get_analytics_schema_name(company_id)
            full_table_name = f"{schema_name}.{table_name.lower()}"
            
            conn = self.get_connection()
            
            # Prepare data for insertion
            insert_data = []
            
            # First pass: collect all possible column names
            all_columns = set()
            for record in data:
                for key in record.keys():
                    clean_key = self.clean_column_name(key)
                    all_columns.add(clean_key)
            
            # Add metadata columns
            all_columns.update(['loaded_at', 'source_system', 'company_id'])
            columns = sorted(list(all_columns))  # Sort for consistency
            
            # Second pass: prepare records with all columns
            for record in data:
                row_data = {}
                
                # Initialize all columns with None
                for col in columns:
                    row_data[col] = None
                
                # Fill in actual values
                for key, value in record.items():
                    clean_key = self.clean_column_name(key)
                    row_data[clean_key] = self.prepare_value_for_insert(value)
                
                # Add metadata
                row_data['loaded_at'] = datetime.utcnow()
                row_data['source_system'] = source_system
                row_data['company_id'] = company_id
                
                insert_data.append(row_data)
            
            if insert_data:
                with conn.cursor() as cursor:
                    # Build the INSERT statement
                    column_names = ', '.join(columns)
                    placeholders = ', '.join(['%s'] * len(columns))
                    
                    # Prepare values as tuples, ensuring all rows have same structure
                    values_list = []
                    for row in insert_data:
                        values_list.append(tuple(row.get(col) for col in columns))
                    
                    # Execute batch insert using executemany for better performance
                    cursor.executemany(
                        f"INSERT INTO {full_table_name} ({column_names}) VALUES ({placeholders})",
                        values_list
                    )
                    
                    logger.info(f"Loaded {len(values_list)} records into {full_table_name}")
                    
                    return len(values_list)
                
        except Exception as e:
            logger.error(f"Error loading data into {table_name}: {e}")
            raise
    
    def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """Execute a query and return results as list of dictionaries"""
        try:
            conn = self.get_connection()
            
            with conn.cursor(row_factory=rows.dict_row) as cursor:
                cursor.execute(query, params)
                
                if cursor.description:
                    # Query returned results
                    results = cursor.fetchall()
                    return [dict(row) for row in results]
                else:
                    # Query didn't return results (INSERT, UPDATE, DELETE, etc.)
                    return []
                    
        except Exception as e:
            logger.error(f"Error executing query: {e}")
            logger.error(f"Query: {query}")
            raise
    
    def get_table_info(self, company_id: int) -> List[Dict[str, Any]]:
        """Get information about tables in the analytics schema"""
        try:
            schema_name = self.get_analytics_schema_name(company_id)
            
            query = """
                SELECT 
                    table_name,
                    column_name,
                    data_type,
                    is_nullable
                FROM information_schema.columns 
                WHERE table_schema = %s
                ORDER BY table_name, ordinal_position
            """
            
            return self.execute_query(query, (schema_name,))
            
        except Exception as e:
            logger.error(f"Error getting table info for company {company_id}: {e}")
            return []
    
    def get_table_list(self, company_id: int) -> List[str]:
        """Get list of tables in the analytics schema"""
        try:
            schema_name = self.get_analytics_schema_name(company_id)
            
            query = """
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = %s
                ORDER BY table_name
            """
            
            results = self.execute_query(query, (schema_name,))
            return [row['table_name'] for row in results]
            
        except Exception as e:
            logger.error(f"Error getting table list for company {company_id}: {e}")
            return []
    
    def close_connection(self):
        """Close PostgreSQL connection"""
        if self.connection and not self.connection.closed:
            self.connection.close()
            self.connection = None
            logger.info("PostgreSQL connection closed")