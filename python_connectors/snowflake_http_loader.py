"""
Snowflake HTTP loader that uses the existing Snowflake service on port 5001
instead of direct snowflake-connector-python (which has libcrypto issues in Replit)
"""

import requests
import json
import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class SnowflakeHTTPLoader:
    """HTTP-based Snowflake loader using existing service"""
    
    def __init__(self, service_url: str = "http://localhost:5000"):
        self.service_url = service_url
    
    def test_connection(self) -> bool:
        """Test if Node.js API service is available"""
        try:
            response = requests.get(f"{self.service_url}/api/health", timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Node.js API service not available: {e}")
            return False
    
    def execute_sql(self, sql: str) -> bool:
        """Execute SQL via the Node.js Snowflake API"""
        try:
            response = requests.post(
                f"{self.service_url}/api/snowflake/query", 
                json={"sql": sql},
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get("success", False)
            else:
                logger.error(f"SQL execution failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error executing SQL: {e}")
            return False
    
    def create_table_if_not_exists(self, table_name: str, sample_record: Dict[str, Any]) -> bool:
        """Create table via HTTP service"""
        try:
            # Generate column definitions
            columns = []
            for key, value in sample_record.items():
                clean_key = key.replace(' ', '_').replace('-', '_').upper()
                if isinstance(value, bool):
                    col_type = "BOOLEAN"
                elif isinstance(value, int):
                    col_type = "INTEGER" 
                elif isinstance(value, float):
                    col_type = "FLOAT"
                elif isinstance(value, datetime):
                    col_type = "TIMESTAMP"
                else:
                    col_type = "VARCHAR(16777216)"
                columns.append(f"{clean_key} {col_type}")
            
            # Add metadata columns
            columns.extend([
                "LOADED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "SOURCE_SYSTEM VARCHAR(100)",
                "COMPANY_ID INTEGER"
            ])
            
            create_sql = f"""
                CREATE TABLE IF NOT EXISTS MIAS_DATA_DB.CORE.{table_name} (
                    {', '.join(columns)}
                )
            """
            
            success = self.execute_sql(create_sql)
            if success:
                logger.info(f"Created/verified table {table_name}")
            return success
            
        except Exception as e:
            logger.error(f"Error creating table {table_name}: {e}")
            return False
    
    def load_data(self, table_name: str, data: List[Dict[str, Any]], 
                  source_system: str, company_id: int) -> int:
        """Load data via HTTP service"""
        if not data:
            return 0
            
        try:
            # Create table first
            if not self.create_table_if_not_exists(table_name, data[0]):
                raise Exception("Failed to create table")
            
            # Prepare INSERT statements
            inserted_count = 0
            
            for record in data:
                # Clean and prepare values
                columns = []
                values = []
                
                for key, value in record.items():
                    clean_key = key.replace(' ', '_').replace('-', '_').upper()
                    columns.append(clean_key)
                    
                    if value is None:
                        values.append("NULL")
                    elif isinstance(value, str):
                        # Escape single quotes
                        escaped_value = value.replace("'", "''")
                        values.append(f"'{escaped_value}'")
                    elif isinstance(value, (dict, list)):
                        # Convert complex objects to JSON strings
                        json_str = json.dumps(value).replace("'", "''")
                        values.append(f"'{json_str}'")
                    elif isinstance(value, bool):
                        values.append("TRUE" if value else "FALSE")
                    elif isinstance(value, (int, float)):
                        values.append(str(value))
                    else:
                        # Convert to string and escape
                        str_value = str(value).replace("'", "''")
                        values.append(f"'{str_value}'")
                
                # Add metadata
                columns.extend(["LOADED_AT", "SOURCE_SYSTEM", "COMPANY_ID"])
                values.extend([
                    "CURRENT_TIMESTAMP",
                    f"'{source_system}'",
                    str(company_id)
                ])
                
                insert_sql = f"""
                    INSERT INTO MIAS_DATA_DB.CORE.{table_name} 
                    ({', '.join(columns)})
                    VALUES ({', '.join(values)})
                """
                
                if self.execute_sql(insert_sql):
                    inserted_count += 1
                else:
                    logger.warning(f"Failed to insert record into {table_name}")
            
            logger.info(f"Loaded {inserted_count}/{len(data)} records into {table_name}")
            return inserted_count
            
        except Exception as e:
            logger.error(f"Error loading data into {table_name}: {e}")
            return 0