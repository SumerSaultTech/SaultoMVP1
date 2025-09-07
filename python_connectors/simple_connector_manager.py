"""
Simplified connector manager without pandas dependency.
"""

import logging
from typing import Dict, List, Any, Optional, Type
from datetime import datetime
import json
import os
import psycopg2
from .simple_base_connector import SimpleBaseConnector, SyncResult
from .simple_salesforce_connector import SimpleSalesforceConnector
from .simple_jira_connector import SimpleJiraConnector

logger = logging.getLogger(__name__)

class SimpleConnectorManager:
    """Simplified connector manager without pandas dependency"""
    
    # Registry of available connectors
    CONNECTOR_REGISTRY: Dict[str, Type[SimpleBaseConnector]] = {
        "salesforce": SimpleSalesforceConnector,
        "jira": SimpleJiraConnector,
    }
    
    def __init__(self):
        self.active_connectors: Dict[str, SimpleBaseConnector] = {}
    
    @classmethod
    def get_available_connectors(cls) -> List[str]:
        """Get list of available connector types"""
        return list(cls.CONNECTOR_REGISTRY.keys())
    
    @classmethod
    def get_connector_requirements(cls, connector_type: str) -> Dict[str, Any]:
        """Get requirements for a specific connector type"""
        if connector_type not in cls.CONNECTOR_REGISTRY:
            return {}
        
        connector_class = cls.CONNECTOR_REGISTRY[connector_type]
        # Create a temporary instance to get requirements
        temp_instance = connector_class(0, {}, {})
        
        return {
            "name": connector_type,
            "required_credentials": temp_instance.required_credentials,
            "description": f"{connector_type.title()} API connector (simplified)"
        }
    
    def create_connector(self, 
                        connector_type: str, 
                        company_id: int, 
                        credentials: Dict[str, Any], 
                        config: Dict[str, Any] = None) -> tuple[bool, str]:
        """
        Create and validate a new connector instance.
        
        Returns:
            Tuple of (success, message)
        """
        try:
            if connector_type not in self.CONNECTOR_REGISTRY:
                return False, f"Unknown connector type: {connector_type}"
            
            connector_class = self.CONNECTOR_REGISTRY[connector_type]
            connector = connector_class(company_id, credentials, config)
            
            # Validate credentials
            is_valid, message = connector.validate_credentials()
            if not is_valid:
                return False, message
            
            # Store connector
            connector_key = f"{company_id}_{connector_type}"
            self.active_connectors[connector_key] = connector
            
            logger.info(f"Created {connector_type} connector for company {company_id}")
            return True, "Connector created successfully"
            
        except Exception as e:
            error_msg = f"Failed to create {connector_type} connector: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def get_connector(self, company_id: int, connector_type: str) -> Optional[SimpleBaseConnector]:
        """Get a connector instance - loads from database if needed"""
        connector_key = f"{company_id}_{connector_type}"
        
        # If already in memory, return it
        if connector_key in self.active_connectors:
            return self.active_connectors[connector_key]
        
        # Try to load from database
        try:
            db_credentials = self._load_credentials_from_database(company_id, connector_type)
            if db_credentials:
                logger.info(f"📥 Loading {connector_type} connector for company {company_id} from database")
                # Create connector with database credentials
                success = self.create_connector(connector_type, company_id, db_credentials, {})
                if success:
                    return self.active_connectors.get(connector_key)
        except Exception as e:
            logger.error(f"Failed to load connector from database: {e}")
        
        return None
    
    def _load_credentials_from_database(self, company_id: int, connector_type: str) -> Optional[Dict[str, Any]]:
        """Load connector credentials from PostgreSQL database"""
        try:
            database_url = os.getenv('DATABASE_URL')
            if not database_url:
                logger.error("DATABASE_URL not found in environment")
                return None
            
            conn = psycopg2.connect(database_url)
            cur = conn.cursor()
            
            # Query data_sources table for this company and connector type
            cur.execute("""
                SELECT credentials 
                FROM data_sources 
                WHERE company_id = %s AND type = %s 
                AND credentials IS NOT NULL
            """, (company_id, connector_type))
            
            result = cur.fetchone()
            conn.close()
            
            if result and result[0]:
                logger.info(f"✅ Found {connector_type} credentials in database for company {company_id}")
                return json.loads(result[0]) if isinstance(result[0], str) else result[0]
            else:
                logger.info(f"❌ No {connector_type} credentials found in database for company {company_id}")
                return None
                
        except Exception as e:
            logger.error(f"Database error loading credentials: {e}")
            return None
    
    def test_connector(self, company_id: int, connector_type: str) -> tuple[bool, str]:
        """Test a connector connection"""
        try:
            connector = self.get_connector(company_id, connector_type)
            if not connector:
                return False, "Connector not found"
            
            if connector.test_connection():
                return True, "Connection test successful"
            else:
                return False, "Connection test failed"
                
        except Exception as e:
            return False, f"Connection test error: {str(e)}"
    
    def get_connector_tables(self, company_id: int, connector_type: str) -> tuple[bool, List[str], str]:
        """
        Get available tables for a connector.
        
        Returns:
            Tuple of (success, tables_list, error_message)
        """
        try:
            connector = self.get_connector(company_id, connector_type)
            if not connector:
                return False, [], "Connector not found"
            
            tables = connector.get_available_tables()
            return True, tables, ""
            
        except Exception as e:
            error_msg = f"Failed to get tables: {str(e)}"
            logger.error(error_msg)
            return False, [], error_msg
    
    def sync_connector(self, 
                      company_id: int, 
                      connector_type: str, 
                      tables: Optional[List[str]] = None) -> SyncResult:
        """Sync data for a specific connector"""
        try:
            connector = self.get_connector(company_id, connector_type)
            if not connector:
                return SyncResult(
                    success=False,
                    records_synced=0,
                    tables_synced=[],
                    error_message="Connector not found",
                    start_time=datetime.utcnow(),
                    end_time=datetime.utcnow()
                )
            
            logger.info(f"Starting sync for {connector_type} connector (company {company_id})")
            result = connector.full_sync(tables)
            
            # Log result
            if result.success:
                logger.info(f"Sync completed: {result.records_synced} records, {len(result.tables_synced)} tables")
            else:
                logger.error(f"Sync failed: {result.error_message}")
            
            return result
            
        except Exception as e:
            error_msg = f"Sync failed for {connector_type}: {str(e)}"
            logger.error(error_msg)
            
            return SyncResult(
                success=False,
                records_synced=0,
                tables_synced=[],
                error_message=error_msg,
                start_time=datetime.utcnow(),
                end_time=datetime.utcnow()
            )
    
    def sync_all_connectors(self, company_id: int) -> Dict[str, SyncResult]:
        """Sync all connectors for a company"""
        results = {}
        
        # Find all connectors for this company
        company_connectors = [
            key for key in self.active_connectors.keys() 
            if key.startswith(f"{company_id}_")
        ]
        
        for connector_key in company_connectors:
            connector_type = connector_key.split("_", 1)[1]
            result = self.sync_connector(company_id, connector_type)
            results[connector_type] = result
        
        return results
    
    def remove_connector(self, company_id: int, connector_type: str) -> bool:
        """Remove a connector"""
        try:
            connector_key = f"{company_id}_{connector_type}"
            if connector_key in self.active_connectors:
                del self.active_connectors[connector_key]
                logger.info(f"Removed {connector_type} connector for company {company_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to remove connector: {str(e)}")
            return False
    
    def get_connector_status(self, company_id: int, connector_type: str) -> Dict[str, Any]:
        """Get status information for a connector"""
        try:
            connector = self.get_connector(company_id, connector_type)
            if not connector:
                return {
                    "exists": False,
                    "status": "not_found"
                }
            
            # Test connection
            connection_ok, message = self.test_connector(company_id, connector_type)
            
            # Get table count
            success, tables, _ = self.get_connector_tables(company_id, connector_type)
            table_count = len(tables) if success else 0
            
            return {
                "exists": True,
                "status": "connected" if connection_ok else "error",
                "message": message,
                "table_count": table_count,
                "available_tables": tables if success else []
            }
            
        except Exception as e:
            return {
                "exists": True,
                "status": "error",
                "message": str(e),
                "table_count": 0,
                "available_tables": []
            }

# Global connector manager instance
simple_connector_manager = SimpleConnectorManager()