"""
Simplified Zoho API connector without pandas dependency.
Supports Zoho CRM, Books, and Desk APIs via OAuth 2.0
"""

import requests
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import logging
import urllib.parse
from .simple_base_connector import SimpleBaseConnector

logger = logging.getLogger(__name__)

class SimpleZohoConnector(SimpleBaseConnector):
    """Simplified Zoho API connector using OAuth 2.0 for CRM, Books, and Desk"""
    
    @property
    def connector_name(self) -> str:
        return "zoho"
    
    @property
    def required_credentials(self) -> List[str]:
        return ["access_token", "refresh_token", "datacenter", "client_id", "client_secret"]
    
    def __init__(self, company_id: int, credentials: Dict[str, Any], config: Dict[str, Any] = None):
        super().__init__(company_id, credentials, config)
        self.access_token = credentials.get("access_token")
        self.refresh_token = credentials.get("refresh_token")
        self.client_id = credentials.get("client_id")
        self.client_secret = credentials.get("client_secret")
        self.datacenter = credentials.get("datacenter", "com")
        
        # API base URLs
        self.crm_base_url = f"https://www.zohoapis.{self.datacenter}/crm/v6"
        self.books_base_url = f"https://books.zohoapis.{self.datacenter}/api/v3"
        self.accounts_base_url = f"https://accounts.zoho.{self.datacenter}/oauth/v2"
        
        # Default tables to sync for business metrics
        self.default_tables = [
            # CRM tables (most important for sales metrics)
            "crm_deals",
            "crm_contacts", 
            "crm_accounts",
            "crm_leads",
            "crm_tasks",
            
            # Books tables (financial metrics)
            "books_invoices",
            "books_customers",
            "books_items",
            "books_expenses",
            
            # Desk tables (support metrics)
            "desk_tickets",
            "desk_contacts"
        ]
        
        # Field mappings for each table
        self.table_fields = {
            "crm_deals": [
                "id", "Deal_Name", "Amount", "Stage", "Probability", "Closing_Date",
                "Account_Name", "Contact_Name", "Owner", "Created_Time", "Modified_Time"
            ],
            "crm_contacts": [
                "id", "First_Name", "Last_Name", "Email", "Phone", "Account_Name",
                "Owner", "Created_Time", "Modified_Time"
            ],
            "crm_accounts": [
                "id", "Account_Name", "Phone", "Website", "Industry", "Annual_Revenue",
                "Owner", "Created_Time", "Modified_Time"
            ],
            "crm_leads": [
                "id", "First_Name", "Last_Name", "Email", "Phone", "Company", 
                "Lead_Status", "Owner", "Created_Time", "Modified_Time"
            ],
            "books_invoices": [
                "invoice_id", "invoice_number", "customer_name", "total", "balance",
                "status", "date", "due_date", "created_time"
            ],
            "books_customers": [
                "contact_id", "contact_name", "email", "phone", "company_name",
                "balance", "created_time"
            ]
        }
    
    def get_headers(self) -> Dict[str, str]:
        """Get headers for API requests"""
        if not self.access_token:
            raise ValueError("Not authenticated. Access token required.")
        
        return {
            'Authorization': f'Zoho-oauthtoken {self.access_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    
    def refresh_access_token(self) -> bool:
        """Refresh the access token using refresh token"""
        try:
            refresh_params = {
                'grant_type': 'refresh_token',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'refresh_token': self.refresh_token,
            }

            response = requests.post(
                f"{self.accounts_base_url}/token",
                data=refresh_params,
                timeout=30
            )
            response.raise_for_status()

            token_data = response.json()
            self.access_token = token_data['access_token']
            
            # Update refresh token if provided
            if 'refresh_token' in token_data:
                self.refresh_token = token_data['refresh_token']
            
            logger.info("✅ Zoho access token refreshed successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to refresh Zoho access token: {str(e)}")
            return False
    
    def test_connection(self) -> bool:
        """Test Zoho connection"""
        try:
            # Test CRM API access
            url = f"{self.crm_base_url}/org"
            
            response = requests.get(url, headers=self.get_headers(), timeout=10)
            
            if response.status_code == 401:
                # Try to refresh token
                if self.refresh_access_token():
                    response = requests.get(url, headers=self.get_headers(), timeout=10)
                else:
                    return False
            
            response.raise_for_status()
            
            logger.info("✅ Zoho connection test successful")
            return True
            
        except Exception as e:
            logger.error(f"❌ Zoho connection test failed: {str(e)}")
            return False
    
    def get_available_tables(self) -> List[str]:
        """Get list of available Zoho tables"""
        return self.default_tables
    
    def make_api_request(self, url: str, method: str = 'GET', data: Dict = None, max_retries: int = 2) -> List[Dict]:
        """Make API request with retry logic and token refresh"""
        for attempt in range(max_retries + 1):
            try:
                headers = self.get_headers()
                
                if method == 'GET':
                    response = requests.get(url, headers=headers, timeout=30)
                else:
                    response = requests.post(url, headers=headers, json=data, timeout=30)
                
                if response.status_code == 401 and attempt < max_retries:
                    logger.info("🔄 Access token expired, refreshing...")
                    if self.refresh_access_token():
                        continue
                    else:
                        break
                
                response.raise_for_status()
                
                # Handle different response formats
                response_data = response.json()
                
                if isinstance(response_data, dict):
                    # CRM API format
                    if 'data' in response_data:
                        return response_data['data']
                    # Books API format  
                    elif any(key in response_data for key in ['invoices', 'customers', 'items', 'expenses']):
                        for key in ['invoices', 'customers', 'items', 'expenses']:
                            if key in response_data:
                                return response_data[key]
                    # Single record or org info
                    else:
                        return [response_data] if response_data else []
                elif isinstance(response_data, list):
                    return response_data
                else:
                    return []
                    
            except requests.exceptions.RequestException as e:
                logger.error(f"API request failed (attempt {attempt + 1}): {str(e)}")
                if attempt == max_retries:
                    return []
                
        return []
    
    def extract_crm_data(self, module: str, max_records: int = 200) -> List[Dict[str, Any]]:
        """Extract data from Zoho CRM module"""
        try:
            logger.info(f"📊 Extracting CRM {module} data...")
            
            all_records = []
            page = 1
            per_page = 200
            
            while len(all_records) < max_records:
                url = f"{self.crm_base_url}/{module}?page={page}&per_page={per_page}"
                
                records = self.make_api_request(url)
                
                if not records:
                    break
                
                all_records.extend(records)
                
                logger.info(f"Fetched {len(all_records)} {module} records so far...")
                
                # If we got fewer than per_page records, we've reached the end
                if len(records) < per_page:
                    break
                
                page += 1
            
            logger.info(f"✅ Extracted {len(all_records)} {module} records")
            return all_records[:max_records]
            
        except Exception as e:
            logger.error(f"❌ Failed to extract CRM {module} data: {str(e)}")
            return []
    
    def extract_books_data(self, entity: str, max_records: int = 200) -> List[Dict[str, Any]]:
        """Extract data from Zoho Books entity"""
        try:
            logger.info(f"📈 Extracting Books {entity} data...")
            
            url = f"{self.books_base_url}/{entity}?per_page={max_records}"
            
            records = self.make_api_request(url)
            
            logger.info(f"✅ Extracted {len(records)} {entity} records")
            return records
            
        except Exception as e:
            logger.error(f"❌ Failed to extract Books {entity} data: {str(e)}")
            return []
    
    def extract_data(self, table_name: str, incremental: bool = True) -> List[Dict[str, Any]]:
        """Extract data from specified Zoho table"""
        try:
            logger.info(f"🔄 Extracting data from {table_name}")
            
            # Parse table name to determine API and module/entity
            if table_name.startswith("crm_"):
                module = table_name.replace("crm_", "")
                # Capitalize first letter for API
                module = module.capitalize() + 's' if not module.endswith('s') else module.capitalize()
                return self.extract_crm_data(module)
            
            elif table_name.startswith("books_"):
                entity = table_name.replace("books_", "")
                return self.extract_books_data(entity)
            
            elif table_name.startswith("desk_"):
                # Desk API would be implemented here
                logger.warning(f"Desk API not yet implemented for {table_name}")
                return []
            
            else:
                logger.warning(f"Unknown table type: {table_name}")
                return []
                
        except Exception as e:
            logger.error(f"❌ Failed to extract data from {table_name}: {str(e)}")
            return []
    
    def get_crm_modules(self) -> List[Dict[str, Any]]:
        """Get available CRM modules"""
        try:
            url = f"{self.crm_base_url}/settings/modules"
            response_data = self.make_api_request(url)
            
            if isinstance(response_data, list) and len(response_data) > 0:
                # Response might be wrapped
                modules_data = response_data[0] if isinstance(response_data[0], dict) and 'modules' in response_data[0] else response_data
                return modules_data.get('modules', []) if isinstance(modules_data, dict) else modules_data
            
            return []
        except Exception as e:
            logger.error(f"Failed to get CRM modules: {str(e)}")
            return []
    
    def get_books_entities(self) -> List[str]:
        """Get available Books entities"""
        # Books doesn't have a modules endpoint, return standard entities
        return ["customers", "invoices", "items", "expenses", "bills", "payments", "creditnotes"]
    
    def validate_credentials(self) -> tuple[bool, str]:
        """Validate Zoho credentials"""
        try:
            # Check required credentials are present
            missing_creds = []
            for cred in self.required_credentials:
                if not self.credentials.get(cred):
                    missing_creds.append(cred)
            
            if missing_creds:
                return False, f"Missing credentials: {', '.join(missing_creds)}"
            
            # Test the connection
            if self.test_connection():
                return True, "✅ Zoho credentials validated successfully"
            else:
                return False, "❌ Failed to authenticate with Zoho API"
                
        except Exception as e:
            return False, f"Error validating credentials: {str(e)}"
    
    def get_sync_stats(self) -> Dict[str, Any]:
        """Get statistics about available data for sync"""
        try:
            stats = {
                "connector": "zoho",
                "available_tables": len(self.get_available_tables()),
                "tables": {}
            }
            
            # Get basic stats for key tables
            key_tables = ["crm_deals", "crm_contacts", "books_invoices"]
            
            for table in key_tables:
                try:
                    # Get just a few records to check availability
                    sample_data = self.extract_data(table, incremental=True)
                    stats["tables"][table] = {
                        "available": len(sample_data) > 0,
                        "sample_count": min(len(sample_data), 5)
                    }
                except Exception as e:
                    stats["tables"][table] = {
                        "available": False,
                        "error": str(e)
                    }
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get sync stats: {str(e)}")
            return {"error": str(e)}