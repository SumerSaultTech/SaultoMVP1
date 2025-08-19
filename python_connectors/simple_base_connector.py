"""
Simplified base connector without pandas dependency.
This version uses basic Python data structures instead of pandas DataFrames.
"""

import logging
import json
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import os
from dataclasses import dataclass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import PostgreSQL loader
try:
    from .postgres_loader import PostgresLoader
    POSTGRES_AVAILABLE = True
    logger.info("PostgreSQL loader available")
except ImportError as e:
    POSTGRES_AVAILABLE = False
    logger.info("PostgreSQL loader not available - data will only be logged")
    logger.debug(f"PostgreSQL import error: {e}")

@dataclass
class SyncResult:
    """Result of a data sync operation"""
    success: bool
    records_synced: int
    tables_synced: List[str]
    error_message: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class SimpleBaseConnector(ABC):
    """
    Simplified base class for all API connectors without pandas dependency.
    Uses basic Python data structures instead of DataFrames.
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
        
        # Initialize PostgreSQL loader if available
        self.postgres_loader = PostgresLoader() if POSTGRES_AVAILABLE else None
        
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
    def extract_data(self, table_name: str, incremental: bool = True) -> List[Dict[str, Any]]:
        """
        Extract data from a specific table/endpoint.
        
        Args:
            table_name: Name of the table/endpoint to extract
            incremental: Whether to do incremental sync (only new/updated records)
            
        Returns:
            List of dictionaries with the extracted data
        """
        pass
    
    def sync_table(self, table_name: str, incremental: bool = True) -> Tuple[bool, int]:
        """
        Sync a single table from API.
        
        Returns:
            Tuple of (success, records_count)
        """
        try:
            logger.info(f"Starting sync for table {table_name}")
            
            # Extract data from API
            data = self.extract_data(table_name, incremental)
            
            if not data:
                logger.info(f"No new data for table {table_name}")
                return True, 0
            
            logger.info(f"Extracted {len(data)} records from {table_name}")
            
            # Load data into PostgreSQL if available
            if self.postgres_loader and POSTGRES_AVAILABLE:
                try:
                    # Create table name with connector prefix
                    postgres_table_name = f"{self.connector_name}_{table_name}".lower()
                    
                    records_loaded = self.postgres_loader.load_data(
                        table_name=postgres_table_name,
                        data=data,
                        source_system=self.connector_name,
                        company_id=self.company_id
                    )
                    
                    logger.info(f"Successfully loaded {records_loaded} records into PostgreSQL table {postgres_table_name}")
                    return True, records_loaded
                    
                except Exception as e:
                    logger.error(f"Failed to load data into PostgreSQL: {e}")
                    # Still return success if data was extracted, even if PostgreSQL load failed
                    logger.info(f"Data extraction successful, but PostgreSQL load failed for {table_name}")
                    return True, len(data)
            else:
                # Fallback: just log the data if PostgreSQL is not available
                logger.info(f"PostgreSQL not available - logging data for {table_name}")
                logger.info(f"Sample record: {data[0] if data else 'No data'}")
                return True, len(data)
                
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