"""
Snowflake data loader for simple connectors using pure Python mode.
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

# Enable pure Python mode to avoid libcrypto issues
os.environ["SNOWFLAKE_CONNECTOR_PREFER_PYTHON_SSL"] = "true"

import snowflake.connector

logger = logging.getLogger(__name__)

class SnowflakeLoader:
    """Helper class to load data into Snowflake"""
    
    def __init__(self):
        self.connection = None
    
    def get_connection(self):
        """Get Snowflake connection"""
        if not self.connection:
            try:
                account_id = os.getenv("SNOWFLAKE_ACCOUNT", "")
                account_format = account_id.replace(".snowflakecomputing.com", "") if ".snowflakecomputing.com" in account_id else account_id
                
                self.connection = snowflake.connector.connect(
                    account=account_format,
                    user=os.getenv("SNOWFLAKE_USER"),
                    password=os.getenv("SNOWFLAKE_PASSWORD"),
                    warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_LEARNING_WH"),
                    database='MIAS_DATA_DB',
                    schema='CORE',
                    timeout=30
                )
                logger.info("Connected to Snowflake successfully")
            except Exception as e:
                logger.error(f"Failed to connect to Snowflake: {e}")
                raise
        return self.connection
    
    def create_table_if_not_exists(self, table_name: str, sample_record: Dict[str, Any]):
        """Create table in Snowflake if it doesn't exist"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Generate column definitions from sample record
            columns = []
            for key, value in sample_record.items():
                # Clean column name
                clean_key = key.replace(' ', '_').replace('-', '_').upper()
                
                # Determine data type
                if isinstance(value, bool):
                    col_type = "BOOLEAN"
                elif isinstance(value, int):
                    col_type = "INTEGER"
                elif isinstance(value, float):
                    col_type = "FLOAT"
                elif isinstance(value, datetime):
                    col_type = "TIMESTAMP"
                else:
                    col_type = "VARCHAR(16777216)"  # Use large VARCHAR for flexibility
                
                columns.append(f"{clean_key} {col_type}")
            
            # Add metadata columns
            columns.extend([
                "LOADED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "SOURCE_SYSTEM VARCHAR(100)",
                "COMPANY_ID INTEGER"
            ])
            
            create_sql = f"""
                CREATE TABLE IF NOT EXISTS {table_name} (
                    {', '.join(columns)}
                )
            """
            
            cursor.execute(create_sql)
            logger.info(f"Created/verified table {table_name}")
            cursor.close()
            
        except Exception as e:
            logger.error(f"Error creating table {table_name}: {e}")
            raise
    
    def load_data(self, table_name: str, data: List[Dict[str, Any]], 
                  source_system: str, company_id: int) -> int:
        """Load data into Snowflake table"""
        if not data:
            logger.info("No data to load")
            return 0
            
        try:
            # Create table if needed
            self.create_table_if_not_exists(table_name, data[0])
            
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Prepare data for insertion
            insert_data = []
            for record in data:
                # Convert record to insert format
                row_data = {}
                for key, value in record.items():
                    clean_key = key.replace(' ', '_').replace('-', '_').upper()
                    
                    # Handle different data types
                    if value is None:
                        row_data[clean_key] = None
                    elif isinstance(value, (dict, list)):
                        row_data[clean_key] = json.dumps(value)  # Store complex objects as JSON
                    elif isinstance(value, bool):
                        row_data[clean_key] = value
                    elif isinstance(value, (int, float)):
                        row_data[clean_key] = value
                    elif isinstance(value, datetime):
                        row_data[clean_key] = value
                    else:
                        row_data[clean_key] = str(value)
                
                # Add metadata
                row_data['LOADED_AT'] = datetime.utcnow()
                row_data['SOURCE_SYSTEM'] = source_system
                row_data['COMPANY_ID'] = company_id
                
                insert_data.append(row_data)
            
            # Get column names from first record
            if insert_data:
                columns = list(insert_data[0].keys())
                placeholders = ', '.join(['%s'] * len(columns))
                
                insert_sql = f"""
                    INSERT INTO {table_name} ({', '.join(columns)})
                    VALUES ({placeholders})
                """
                
                # Prepare values
                values_list = []
                for row in insert_data:
                    values_list.append(tuple(row[col] for col in columns))
                
                # Execute batch insert
                cursor.executemany(insert_sql, values_list)
                
                logger.info(f"Loaded {len(values_list)} records into {table_name}")
                cursor.close()
                
                return len(values_list)
                
        except Exception as e:
            logger.error(f"Error loading data into {table_name}: {e}")
            raise
    
    def close_connection(self):
        """Close Snowflake connection"""
        if self.connection:
            self.connection.close()
            self.connection = None