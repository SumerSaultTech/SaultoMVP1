"""
HubSpot API connector for extracting data and loading to Snowflake.
"""

import pandas as pd
import requests
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import logging
from .base_connector import BaseConnector

logger = logging.getLogger(__name__)

class HubSpotConnector(BaseConnector):
    """HubSpot API connector using REST API v3"""
    
    @property
    def connector_name(self) -> str:
        return "hubspot"
    
    @property
    def required_credentials(self) -> List[str]:
        return ["access_token"]  # HubSpot uses private app access tokens
    
    def __init__(self, company_id: int, credentials: Dict[str, Any], config: Dict[str, Any] = None):
        super().__init__(company_id, credentials, config)
        self.access_token = credentials.get("access_token")
        self.base_url = "https://api.hubapi.com"
        
        # Default objects to sync
        self.default_objects = [
            "contacts", "companies", "deals", "tickets", "products", "line_items",
            "quotes", "calls", "emails", "meetings", "notes", "tasks"
        ]
        
        # Object to endpoint mapping
        self.object_endpoints = {
            "contacts": "/crm/v3/objects/contacts",
            "companies": "/crm/v3/objects/companies", 
            "deals": "/crm/v3/objects/deals",
            "tickets": "/crm/v3/objects/tickets",
            "products": "/crm/v3/objects/products",
            "line_items": "/crm/v3/objects/line_items",
            "quotes": "/crm/v3/objects/quotes",
            "calls": "/crm/v3/objects/calls",
            "emails": "/crm/v3/objects/emails",
            "meetings": "/crm/v3/objects/meetings",
            "notes": "/crm/v3/objects/notes",
            "tasks": "/crm/v3/objects/tasks"
        }
    
    def get_headers(self) -> Dict[str, str]:
        """Get headers for API requests"""
        return {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json'
        }
    
    def test_connection(self) -> bool:
        """Test HubSpot connection"""
        try:
            url = f"{self.base_url}/crm/v3/objects/contacts"
            params = {"limit": 1}
            
            response = requests.get(url, headers=self.get_headers(), params=params)
            response.raise_for_status()
            
            logger.info("HubSpot connection test successful")
            return True
            
        except Exception as e:
            logger.error(f"HubSpot connection test failed: {str(e)}")
            return False
    
    def get_available_tables(self) -> List[str]:
        """Get list of available HubSpot objects"""
        try:
            # Try to get custom objects as well
            url = f"{self.base_url}/crm/v3/schemas"
            response = requests.get(url, headers=self.get_headers())
            
            if response.status_code == 200:
                data = response.json()
                custom_objects = [obj['name'] for obj in data.get('results', [])]
                return self.default_objects + custom_objects
            else:
                return self.default_objects
            
        except Exception as e:
            logger.error(f"Failed to get HubSpot objects: {str(e)}")
            return self.default_objects
    
    def get_object_properties(self, object_type: str) -> List[str]:
        """Get properties for a HubSpot object"""
        try:
            url = f"{self.base_url}/crm/v3/properties/{object_type}"
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            data = response.json()
            properties = [prop['name'] for prop in data.get('results', [])]
            
            # Limit to reasonable number of properties
            return properties[:100]
            
        except Exception as e:
            logger.error(f"Failed to get properties for {object_type}: {str(e)}")
            # Return basic properties as fallback
            return ['id', 'createdate', 'lastmodifieddate', 'name']
    
    def extract_data(self, table_name: str, incremental: bool = True) -> pd.DataFrame:
        """Extract data from HubSpot object"""
        try:
            # Get endpoint for this object
            endpoint = self.object_endpoints.get(table_name)
            if not endpoint:
                # Try with custom object pattern
                endpoint = f"/crm/v3/objects/{table_name}"
            
            url = f"{self.base_url}{endpoint}"
            
            # Get properties for this object
            properties = self.get_object_properties(table_name)
            if not properties:
                logger.warning(f"No properties found for {table_name}")
                return pd.DataFrame()
            
            # Build request parameters
            params = {
                "limit": 100,  # HubSpot max per request
                "properties": ",".join(properties[:50])  # Limit properties
            }
            
            # Add incremental filter if requested
            if incremental:
                last_sync = self.get_last_sync_timestamp(table_name)
                if last_sync:
                    # Convert to HubSpot timestamp (milliseconds)
                    timestamp_ms = int(last_sync.timestamp() * 1000)
                    params["filterGroups"] = [{
                        "filters": [{
                            "propertyName": "lastmodifieddate",
                            "operator": "GT",
                            "value": str(timestamp_ms)
                        }]
                    }]
            
            all_records = []
            after = None
            max_pages = 100  # Limit to prevent infinite loops
            pages = 0
            
            while pages < max_pages:
                if after:
                    params["after"] = after
                
                logger.info(f"Fetching page {pages + 1} for {table_name}")
                
                response = requests.get(url, headers=self.get_headers(), params=params)
                response.raise_for_status()
                
                data = response.json()
                results = data.get('results', [])
                
                if not results:
                    break
                
                # Process records
                for record in results:
                    processed_record = {"id": record.get("id")}
                    
                    # Flatten properties
                    properties_data = record.get("properties", {})
                    for prop_name, prop_value in properties_data.items():
                        processed_record[prop_name] = prop_value
                    
                    all_records.append(processed_record)
                
                # Check for pagination
                paging = data.get('paging', {})
                after = paging.get('next', {}).get('after')
                
                if not after:
                    break
                    
                pages += 1
            
            if not all_records:
                logger.info(f"No records found for {table_name}")
                return pd.DataFrame()
            
            # Convert to DataFrame
            df = pd.DataFrame(all_records)
            
            # Convert HubSpot timestamps to proper datetime
            timestamp_columns = [col for col in df.columns if 'date' in col.lower() or 'time' in col.lower()]
            for col in timestamp_columns:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], unit='ms', errors='coerce')
            
            logger.info(f"Extracted {len(df)} records from {table_name}")
            return df
            
        except Exception as e:
            logger.error(f"Failed to extract data from {table_name}: {str(e)}")
            return pd.DataFrame()