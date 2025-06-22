"""
Base connector class for API data extraction and Snowflake loading.
All specific API connectors should inherit from this base class.
"""

import logging
import json
import pandas as pd
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import snowflake.connector
from snowflake.connector.pandas_tools import write_pandas
import os
from dataclasses import dataclass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class SyncResult:
    """Result of a data sync operation"""
    success: bool
    records_synced: int
    tables_synced: List[str]
    error_message: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class BaseConnector(ABC):
    """
    Base class for all API connectors.
    Handles common functionality like Snowflake connections, data loading, and error handling.
    """
    
    def __init__(self, company_id: int, credentials: Dict[str, Any], config: Dict[str, Any] = None):
        """
        Initialize the connector with company-specific credentials and config.
        
        Args:
            company_id: ID of the company this connector belongs to
            credentials: API credentials specific to this connector
            config: Additional configuration parameters
        """
        self.company_id = company_id
        self.credentials = credentials
        self.config = config or {}
        self.snowflake_conn = None
        
        # Snowflake connection parameters
        self.snowflake_config = {
            'account': os.getenv('SNOWFLAKE_ACCOUNT'),
            'user': os.getenv('SNOWFLAKE_USER'),
            'password': os.getenv('SNOWFLAKE_PASSWORD'),
            'warehouse': os.getenv('SNOWFLAKE_WAREHOUSE', 'COMPUTE_WH'),
            'database': os.getenv('SNOWFLAKE_DATABASE', 'MIAS_DATA_DB'),
            'schema': 'RAW'  # All raw data goes to RAW schema
        }
        
    @property
    @abstractmethod
    def connector_name(self) -> str:
        """Name of the connector (e.g., 'salesforce', 'hubspot')"""
        pass
    
    @property
    @abstractmethod
    def required_credentials(self) -> List[str]:
        """List of required credential keys for this connector"""
        pass
    
    @abstractmethod
    def test_connection(self) -> bool:
        """Test if the API connection is working"""
        pass
    
    @abstractmethod
    def get_available_tables(self) -> List[str]:
        """Get list of available tables/endpoints from the API"""
        pass
    
    @abstractmethod
    def extract_data(self, table_name: str, incremental: bool = True) -> pd.DataFrame:
        """
        Extract data from a specific table/endpoint.
        
        Args:
            table_name: Name of the table/endpoint to extract
            incremental: Whether to do incremental sync (only new/updated records)
            
        Returns:
            DataFrame with the extracted data
        """
        pass
    
    def connect_to_snowflake(self) -> bool:
        """Establish connection to Snowflake"""
        try:
            self.snowflake_conn = snowflake.connector.connect(**self.snowflake_config)
            logger.info(f"Connected to Snowflake for company {self.company_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Snowflake: {str(e)}")
            return False
    
    def close_snowflake_connection(self):
        """Close Snowflake connection"""
        if self.snowflake_conn:
            self.snowflake_conn.close()
            self.snowflake_conn = None
    
    def load_to_snowflake(self, df: pd.DataFrame, table_name: str, if_exists: str = 'replace') -> bool:
        """
        Load DataFrame to Snowflake table.
        
        Args:
            df: DataFrame to load
            table_name: Target table name
            if_exists: What to do if table exists ('replace', 'append', 'fail')
            
        Returns:
            True if successful, False otherwise
        """
        if df.empty:
            logger.warning(f"No data to load for table {table_name}")
            return True
            
        try:
            # Add metadata columns
            df['_saulto_company_id'] = self.company_id
            df['_saulto_connector'] = self.connector_name
            df['_saulto_extracted_at'] = datetime.utcnow()
            
            # Create table name with company prefix
            full_table_name = f"COMPANY_{self.company_id}_{self.connector_name.upper()}_{table_name.upper()}"
            
            # Use write_pandas to load data
            success, nchunks, nrows, _ = write_pandas(
                conn=self.snowflake_conn,
                df=df,
                table_name=full_table_name,
                database=self.snowflake_config['database'],
                schema=self.snowflake_config['schema'],
                auto_create_table=True,
                overwrite=(if_exists == 'replace')
            )
            
            if success:
                logger.info(f"Successfully loaded {nrows} rows to {full_table_name}")
                return True
            else:
                logger.error(f"Failed to load data to {full_table_name}")
                return False
                
        except Exception as e:
            logger.error(f"Error loading data to Snowflake: {str(e)}")
            return False
    
    def get_last_sync_timestamp(self, table_name: str) -> Optional[datetime]:
        """Get the timestamp of the last successful sync for incremental loading"""
        try:
            full_table_name = f"COMPANY_{self.company_id}_{self.connector_name.upper()}_{table_name.upper()}"
            cursor = self.snowflake_conn.cursor()
            
            query = f"""
            SELECT MAX(_saulto_extracted_at) as last_sync
            FROM {self.snowflake_config['database']}.{self.snowflake_config['schema']}.{full_table_name}
            """
            
            cursor.execute(query)
            result = cursor.fetchone()
            cursor.close()
            
            if result and result[0]:
                return result[0]
            return None
            
        except Exception as e:
            logger.warning(f"Could not get last sync timestamp for {table_name}: {str(e)}")
            return None
    
    def sync_table(self, table_name: str, incremental: bool = True) -> Tuple[bool, int]:
        """
        Sync a single table from API to Snowflake.
        
        Returns:
            Tuple of (success, records_count)
        """
        try:
            logger.info(f"Starting sync for table {table_name}")
            
            # Extract data from API
            df = self.extract_data(table_name, incremental)
            
            if df.empty:
                logger.info(f"No new data for table {table_name}")
                return True, 0
            
            # Load to Snowflake
            if_exists = 'append' if incremental else 'replace'
            success = self.load_to_snowflake(df, table_name, if_exists)
            
            if success:
                logger.info(f"Successfully synced {len(df)} records for table {table_name}")
                return True, len(df)
            else:
                logger.error(f"Failed to sync table {table_name}")
                return False, 0
                
        except Exception as e:
            logger.error(f"Error syncing table {table_name}: {str(e)}")
            return False, 0
    
    def full_sync(self, tables: Optional[List[str]] = None) -> SyncResult:
        """
        Perform a full sync of all or specified tables.
        
        Returns:
            SyncResult with sync details
        """
        start_time = datetime.utcnow()
        
        try:
            # Connect to Snowflake
            if not self.connect_to_snowflake():
                return SyncResult(
                    success=False,
                    records_synced=0,
                    tables_synced=[],
                    error_message="Failed to connect to Snowflake",
                    start_time=start_time,
                    end_time=datetime.utcnow()
                )
            
            # Get tables to sync
            if tables is None:
                tables = self.get_available_tables()
            
            total_records = 0
            synced_tables = []
            failed_tables = []
            
            # Sync each table
            for table in tables:
                try:
                    success, records = self.sync_table(table, incremental=True)
                    if success:
                        total_records += records
                        synced_tables.append(table)
                    else:
                        failed_tables.append(table)
                except Exception as e:
                    logger.error(f"Error syncing table {table}: {str(e)}")
                    failed_tables.append(table)
            
            end_time = datetime.utcnow()
            
            if failed_tables:
                error_msg = f"Failed to sync tables: {', '.join(failed_tables)}"
                logger.warning(error_msg)
            
            return SyncResult(
                success=len(failed_tables) == 0,
                records_synced=total_records,
                tables_synced=synced_tables,
                error_message=error_msg if failed_tables else None,
                start_time=start_time,
                end_time=end_time
            )
            
        except Exception as e:
            error_msg = f"Full sync failed: {str(e)}"
            logger.error(error_msg)
            
            return SyncResult(
                success=False,
                records_synced=0,
                tables_synced=[],
                error_message=error_msg,
                start_time=start_time,
                end_time=datetime.utcnow()
            )
            
        finally:
            self.close_snowflake_connection()
    
    def validate_credentials(self) -> Tuple[bool, str]:
        """
        Validate that all required credentials are present and valid.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check required credentials are present
        missing_creds = []
        for cred in self.required_credentials:
            if cred not in self.credentials or not self.credentials[cred]:
                missing_creds.append(cred)
        
        if missing_creds:
            return False, f"Missing credentials: {', '.join(missing_creds)}"
        
        # Test the connection
        try:
            if self.test_connection():
                return True, "Credentials validated successfully"
            else:
                return False, "Failed to authenticate with API"
        except Exception as e:
            return False, f"Error validating credentials: {str(e)}"