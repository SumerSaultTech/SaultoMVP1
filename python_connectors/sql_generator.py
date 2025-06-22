"""
SQL Generator for Snowflake - creates SQL files from extracted data
"""

import json
import os
import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class SQLGenerator:
    """Generates SQL files for Snowflake loading"""
    
    def __init__(self, output_dir: str = "snowflake_sql"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
    
    def generate_sql_file(self, connector_name: str, table_name: str, data: List[Dict[str, Any]], 
                         company_id: int) -> str:
        """Generate SQL file with CREATE TABLE and INSERT statements"""
        if not data:
            logger.info("No data to generate SQL for")
            return ""
        
        # Create filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{connector_name}_{table_name}_{company_id}_{timestamp}.sql"
        filepath = os.path.join(self.output_dir, filename)
        
        snowflake_table_name = f"{connector_name.upper()}_{table_name.upper()}"
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                # Write header
                f.write(f"-- Snowflake SQL for {snowflake_table_name}\n")
                f.write(f"-- Generated: {datetime.utcnow().isoformat()}\n")
                f.write(f"-- Source: {connector_name} - {table_name}\n")
                f.write(f"-- Records: {len(data)}\n")
                f.write(f"-- Company ID: {company_id}\n\n")
                
                # Generate CREATE TABLE
                create_sql = self._generate_create_table_sql(snowflake_table_name, data[0])
                f.write(create_sql)
                f.write("\n\n")
                
                # Generate INSERT statements
                insert_sql = self._generate_insert_statements(snowflake_table_name, data, connector_name, company_id)
                f.write(insert_sql)
                
                # Write footer
                f.write(f"\n\n-- End of SQL file for {snowflake_table_name}")
                f.write(f"\n-- Total records: {len(data)}")
            
            logger.info(f"📄 Generated SQL file: {filepath} with {len(data)} records")
            return filepath
            
        except Exception as e:
            logger.error(f"Failed to generate SQL file: {e}")
            return ""
    
    def _generate_create_table_sql(self, table_name: str, sample_record: Dict[str, Any]) -> str:
        """Generate CREATE TABLE SQL"""
        columns = []
        
        for key, value in sample_record.items():
            clean_key = key.replace(' ', '_').replace('-', '_').replace('.', '_').upper()
            
            if isinstance(value, bool):
                col_type = "BOOLEAN"
            elif isinstance(value, int):
                col_type = "NUMBER"
            elif isinstance(value, float):
                col_type = "FLOAT"
            elif isinstance(value, datetime):
                col_type = "TIMESTAMP"
            else:
                col_type = "VARCHAR(16777216)"
            
            columns.append(f"    {clean_key} {col_type}")
        
        # Add metadata columns
        columns.extend([
            "    LOADED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "    SOURCE_SYSTEM VARCHAR(100)",
            "    COMPANY_ID NUMBER"
        ])
        
        return f"""-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS MIAS_DATA_DB.CORE.{table_name} (
{','.join(columns)}
);"""
    
    def _generate_insert_statements(self, table_name: str, data: List[Dict[str, Any]], 
                                   source_system: str, company_id: int) -> str:
        """Generate INSERT statements"""
        if not data:
            return ""
        
        # Get column names from first record
        sample_record = data[0]
        columns = [key.replace(' ', '_').replace('-', '_').replace('.', '_').upper() for key in sample_record.keys()]
        columns.extend(["LOADED_AT", "SOURCE_SYSTEM", "COMPANY_ID"])
        
        sql_parts = [f"-- Insert data into {table_name}"]
        sql_parts.append(f"INSERT INTO MIAS_DATA_DB.CORE.{table_name}")
        sql_parts.append(f"({', '.join(columns)})")
        sql_parts.append("VALUES")
        
        # Generate VALUES for each record
        value_rows = []
        for i, record in enumerate(data):
            values = []
            
            for key, value in record.items():
                values.append(self._format_sql_value(value))
            
            # Add metadata values
            values.extend([
                "CURRENT_TIMESTAMP",
                f"'{source_system}'",
                str(company_id)
            ])
            
            row = f"({', '.join(values)})"
            value_rows.append(row)
        
        # Join all rows with commas
        sql_parts.append(','.join(value_rows))
        sql_parts.append(";")
        
        return '\n'.join(sql_parts)
    
    def _format_sql_value(self, value: Any) -> str:
        """Format a Python value for SQL"""
        if value is None:
            return "NULL"
        elif isinstance(value, bool):
            return "TRUE" if value else "FALSE"
        elif isinstance(value, (int, float)):
            return str(value)
        elif isinstance(value, str):
            # Escape single quotes and wrap in quotes
            escaped = value.replace("'", "''")
            return f"'{escaped}'"
        elif isinstance(value, (dict, list)):
            # Convert complex objects to JSON strings
            json_str = json.dumps(value).replace("'", "''")
            return f"'{json_str}'"
        elif isinstance(value, datetime):
            return f"'{value.isoformat()}'"
        else:
            # Convert everything else to string
            str_value = str(value).replace("'", "''")
            return f"'{str_value}'"