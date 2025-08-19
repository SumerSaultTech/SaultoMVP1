"""
Simplified Salesforce API connector without pandas dependency.
"""

import requests
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import logging
import urllib.parse
from .simple_base_connector import SimpleBaseConnector

logger = logging.getLogger(__name__)

class SimpleSalesforceConnector(SimpleBaseConnector):
    """Simplified Salesforce API connector using REST API v59.0"""
    
    @property
    def connector_name(self) -> str:
        return "salesforce"
    
    @property
    def required_credentials(self) -> List[str]:
        return ["client_id", "client_secret", "username", "password", "security_token", "instance_url"]
    
    def __init__(self, company_id: int, credentials: Dict[str, Any], config: Dict[str, Any] = None):
        super().__init__(company_id, credentials, config)
        self.client_id = credentials.get("client_id")
        self.client_secret = credentials.get("client_secret")
        self.username = credentials.get("username")
        self.password = credentials.get("password")
        self.security_token = credentials.get("security_token")
        self.instance_url = credentials.get("instance_url", "").rstrip('/')
        
        # Authentication state
        self.access_token = None
        self.token_type = "Bearer"
        
        # API version
        self.api_version = "v59.0"
        
        # Default objects to sync
        self.default_objects = [
            "Account", "Contact", "Opportunity", "Lead", "Case", "Task", "Event", "User"
        ]
        
        # Standard field mappings for each object
        self.object_fields = {
            "Account": [
                "Id", "Name", "Type", "Industry", "AnnualRevenue", "NumberOfEmployees",
                "BillingStreet", "BillingCity", "BillingState", "BillingPostalCode", 
                "BillingCountry", "Phone", "Website", "OwnerId", "CreatedDate", 
                "LastModifiedDate", "IsDeleted"
            ],
            "Contact": [
                "Id", "FirstName", "LastName", "AccountId", "Email", "Phone", "Title",
                "Department", "LeadSource", "OwnerId", "CreatedDate", "LastModifiedDate", "IsDeleted"
            ],
            "Opportunity": [
                "Id", "Name", "AccountId", "StageName", "Amount", "CloseDate", "Probability",
                "Type", "LeadSource", "OwnerId", "CreatedDate", "LastModifiedDate", "IsDeleted"
            ],
            "Lead": [
                "Id", "FirstName", "LastName", "Company", "Email", "Phone", "Status", "Source",
                "Industry", "Rating", "OwnerId", "CreatedDate", "LastModifiedDate", "IsDeleted"
            ],
            "Case": [
                "Id", "CaseNumber", "AccountId", "ContactId", "Subject", "Status", "Priority",
                "Origin", "Type", "Reason", "OwnerId", "CreatedDate", "LastModifiedDate", "IsDeleted"
            ],
            "Task": [
                "Id", "Subject", "AccountId", "WhoId", "WhatId", "Status", "Priority",
                "ActivityDate", "OwnerId", "CreatedDate", "LastModifiedDate", "IsDeleted"
            ],
            "Event": [
                "Id", "Subject", "AccountId", "WhoId", "WhatId", "StartDateTime", "EndDateTime",
                "Type", "OwnerId", "CreatedDate", "LastModifiedDate", "IsDeleted"
            ],
            "User": [
                "Id", "Name", "Username", "Email", "FirstName", "LastName", "IsActive",
                "UserRoleId", "ProfileId", "CreatedDate", "LastModifiedDate"
            ]
        }
    
    def authenticate(self) -> bool:
        """Authenticate with Salesforce using OAuth 2.0 Username-Password flow"""
        try:
            # OAuth token endpoint
            token_url = f"{self.instance_url}/services/oauth2/token"
            
            # Username-password flow parameters
            params = {
                'grant_type': 'password',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'username': self.username,
                'password': self.password + self.security_token  # Concatenate password with security token
            }
            
            response = requests.post(token_url, data=params, timeout=30)
            response.raise_for_status()
            
            token_data = response.json()
            self.access_token = token_data['access_token']
            self.token_type = token_data.get('token_type', 'Bearer')
            
            # Update instance URL if provided in response
            if 'instance_url' in token_data:
                self.instance_url = token_data['instance_url']
            
            logger.info("Salesforce authentication successful")
            return True
            
        except Exception as e:
            logger.error(f"Salesforce authentication failed: {str(e)}")
            self.access_token = None
            return False
    
    def get_headers(self) -> Dict[str, str]:
        """Get headers for API requests"""
        if not self.access_token:
            raise ValueError("Not authenticated. Call authenticate() first.")
        
        return {
            'Authorization': f'{self.token_type} {self.access_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    
    def test_connection(self) -> bool:
        """Test Salesforce connection"""
        try:
            # First authenticate
            if not self.authenticate():
                return False
            
            # Test with a simple query
            url = f"{self.instance_url}/services/data/{self.api_version}/query"
            params = {'q': 'SELECT Id, Name FROM Organization LIMIT 1'}
            
            response = requests.get(url, headers=self.get_headers(), params=params, timeout=10)
            response.raise_for_status()
            
            logger.info("Salesforce connection test successful")
            return True
            
        except Exception as e:
            logger.error(f"Salesforce connection test failed: {str(e)}")
            return False
    
    def get_available_tables(self) -> List[str]:
        """Get list of available Salesforce objects"""
        return self.default_objects
    
    def make_soql_request(self, soql_query: str, max_records: int = 2000) -> List[Dict]:
        """Make SOQL query request with pagination"""
        all_records = []
        
        try:
            # Ensure we're authenticated
            if not self.access_token:
                if not self.authenticate():
                    return []
            
            url = f"{self.instance_url}/services/data/{self.api_version}/query"
            params = {'q': soql_query}
            
            records_retrieved = 0
            
            while url and records_retrieved < max_records:
                if url.startswith('http'):
                    # Full URL for subsequent requests
                    response = requests.get(url, headers=self.get_headers(), timeout=30)
                else:
                    # Relative URL - construct full URL
                    response = requests.get(f"{self.instance_url}{url}", headers=self.get_headers(), timeout=30)
                
                if response.status_code == 401:
                    # Token expired, re-authenticate
                    logger.info("Access token expired, re-authenticating...")
                    if self.authenticate():
                        continue  # Retry the request
                    else:
                        break
                
                response.raise_for_status()
                data = response.json()
                
                if 'records' in data:
                    records = data['records']
                    # Remove Salesforce metadata from records
                    clean_records = []
                    for record in records:
                        clean_record = {k: v for k, v in record.items() if k != 'attributes'}
                        clean_records.append(clean_record)
                    
                    all_records.extend(clean_records)
                    records_retrieved += len(records)
                    
                    # Check for more records
                    if data.get('done', True) or not data.get('nextRecordsUrl'):
                        break
                    
                    url = data.get('nextRecordsUrl')
                else:
                    break
            
            logger.info(f"Retrieved {len(all_records)} records from Salesforce")
            return all_records
            
        except Exception as e:
            logger.error(f"SOQL request failed: {str(e)}")
            return []
    
    def build_soql_query(self, object_name: str, fields: List[str], incremental: bool = True, limit: int = None) -> str:
        """Build SOQL query for object extraction"""
        fields_str = ', '.join(fields)
        query = f"SELECT {fields_str} FROM {object_name}"
        
        conditions = []
        
        # Add incremental filter if requested
        if incremental:
            # Get records updated in last 30 days for initial sync
            conditions.append("LastModifiedDate >= LAST_N_DAYS:30")
        
        # Exclude deleted records for most objects
        if object_name != "User":  # Users don't have IsDeleted field
            conditions.append("IsDeleted = FALSE")
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " ORDER BY LastModifiedDate DESC"
        
        if limit:
            query += f" LIMIT {limit}"
        
        return query
    
    def extract_data(self, table_name: str, incremental: bool = True) -> List[Dict[str, Any]]:
        """Extract data from Salesforce object"""
        try:
            logger.info(f"Extracting data from Salesforce {table_name}")
            
            # Get fields for this object
            fields = self.object_fields.get(table_name, ["Id", "Name", "CreatedDate", "LastModifiedDate"])
            
            # Build SOQL query
            soql_query = self.build_soql_query(table_name, fields, incremental)
            
            logger.info(f"Executing SOQL: {soql_query}")
            
            # Execute query
            results = self.make_soql_request(soql_query)
            
            if not results:
                logger.info(f"No {table_name} records found")
                return []
            
            logger.info(f"Extracted {len(results)} {table_name} records")
            return results
                
        except Exception as e:
            logger.error(f"Failed to extract data from {table_name}: {str(e)}")
            return []