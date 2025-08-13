"""
Simplified Salesforce API connector without pandas dependency.
"""

import requests
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import logging
from .simple_base_connector import SimpleBaseConnector

logger = logging.getLogger(__name__)

class SimpleSalesforceConnector(SimpleBaseConnector):
    """Simplified Salesforce API connector using REST API"""
    
    @property
    def connector_name(self) -> str:
        return "salesforce"
    
    @property
    def required_credentials(self) -> List[str]:
        return ["client_id", "client_secret", "username", "password", "security_token", "instance_url"]
    
    def __init__(self, company_id: int, credentials: Dict[str, Any], config: Dict[str, Any] = None):
        super().__init__(company_id, credentials, config)
        self.access_token = None
        self.instance_url = credentials.get("instance_url", "https://login.salesforce.com")
        
        # Default tables to sync
        self.default_tables = [
            "Account", "Contact", "Lead", "Opportunity", "User", "Task", "Event",
            "Case", "Product2", "Pricebook2", "PricebookEntry", "Quote", "Contract",
            "Campaign", "CampaignMember", "OpportunityLineItem"
        ]
    
    def authenticate(self) -> bool:
        """Authenticate with Salesforce and get access token"""
        try:
            auth_url = f"{self.instance_url}/services/oauth2/token"
            
            data = {
                'grant_type': 'password',
                'client_id': self.credentials['client_id'],
                'client_secret': self.credentials['client_secret'],
                'username': self.credentials['username'],
                'password': self.credentials['password'] + self.credentials.get('security_token', '')
            }
            
            response = requests.post(auth_url, data=data)
            response.raise_for_status()
            
            auth_data = response.json()
            self.access_token = auth_data['access_token']
            self.instance_url = auth_data['instance_url']
            
            logger.info("Successfully authenticated with Salesforce")
            return True
            
        except Exception as e:
            logger.error(f"Salesforce authentication failed: {str(e)}")
            return False
    
    def test_connection(self) -> bool:
        """Test Salesforce connection"""
        if not self.authenticate():
            return False
            
        try:
            # Test with a simple query
            query = "SELECT Id, Name FROM Account LIMIT 1"
            result = self.soql_query(query)
            return result is not None
            
        except Exception as e:
            logger.error(f"Salesforce connection test failed: {str(e)}")
            return False
    
    def soql_query(self, query: str) -> Optional[Dict]:
        """Execute SOQL query"""
        if not self.access_token:
            if not self.authenticate():
                return None
        
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }
            
            url = f"{self.instance_url}/services/data/v57.0/query"
            params = {'q': query}
            
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                # Token expired, try to re-authenticate
                logger.info("Access token expired, re-authenticating...")
                if self.authenticate():
                    return self.soql_query(query)
            logger.error(f"SOQL query failed: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"SOQL query error: {str(e)}")
            return None
    
    def get_available_tables(self) -> List[str]:
        """Get list of available Salesforce objects"""
        if not self.access_token:
            if not self.authenticate():
                return self.default_tables
        
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }
            
            url = f"{self.instance_url}/services/data/v57.0/sobjects"
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            data = response.json()
            
            # Filter to common business objects that are queryable
            objects = []
            for obj in data['sobjects']:
                if (obj['queryable'] and 
                    obj['createable'] and 
                    not obj['name'].endswith('__History') and
                    not obj['name'].endswith('__Share') and
                    not obj['name'].startswith('Setup')):
                    objects.append(obj['name'])
            
            # Return top objects or default list
            return objects[:20] if objects else self.default_tables
            
        except Exception as e:
            logger.error(f"Failed to get Salesforce objects: {str(e)}")
            return self.default_tables
    
    def get_object_fields(self, object_name: str) -> List[str]:
        """Get field names for a Salesforce object"""
        if not self.access_token:
            if not self.authenticate():
                return []
        
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }
            
            url = f"{self.instance_url}/services/data/v57.0/sobjects/{object_name}/describe"
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            data = response.json()
            
            # Get field names, prioritizing commonly used fields
            fields = []
            for field in data['fields']:
                if field['type'] not in ['address', 'location']:  # Skip complex types
                    fields.append(field['name'])
            
            # Limit to reasonable number of fields
            return fields[:50]
            
        except Exception as e:
            logger.error(f"Failed to get fields for {object_name}: {str(e)}")
            # Return basic fields as fallback
            return ['Id', 'Name', 'CreatedDate', 'LastModifiedDate']
    
    def extract_data(self, table_name: str, incremental: bool = True) -> List[Dict[str, Any]]:
        """Extract data from Salesforce object"""
        try:
            # Get fields for this object
            fields = self.get_object_fields(table_name)
            if not fields:
                logger.warning(f"No fields found for {table_name}")
                return []
            
            # Build SOQL query
            field_list = ', '.join(fields)
            query = f"SELECT {field_list} FROM {table_name}"
            
            # Add incremental filter if requested
            if incremental:
                # For demo purposes, just get recent records
                query += " WHERE LastModifiedDate > LAST_N_DAYS:30"
            
            # Add ordering and limit
            query += " ORDER BY LastModifiedDate DESC LIMIT 1000"
            
            logger.info(f"Executing query: {query}")
            
            # Execute query
            result = self.soql_query(query)
            if not result or not result.get('records'):
                logger.info(f"No records found for {table_name}")
                return []
            
            # Clean up records (remove Salesforce metadata)
            records = result['records']
            cleaned_records = []
            
            for record in records:
                # Remove Salesforce metadata
                clean_record = {k: v for k, v in record.items() if k != 'attributes'}
                
                # Flatten nested objects to strings
                for key, value in clean_record.items():
                    if isinstance(value, dict):
                        clean_record[key] = str(value)
                
                cleaned_records.append(clean_record)
            
            logger.info(f"Extracted {len(cleaned_records)} records from {table_name}")
            return cleaned_records
            
        except Exception as e:
            logger.error(f"Failed to extract data from {table_name}: {str(e)}")
            return []