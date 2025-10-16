"""
Simplified QuickBooks API connector without pandas dependency.
"""

import requests
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import logging
import urllib.parse
from .simple_base_connector import SimpleBaseConnector

logger = logging.getLogger(__name__)

class SimpleQuickBooksConnector(SimpleBaseConnector):
    """Simplified QuickBooks API connector using OAuth 2.0 and REST API"""

    @property
    def connector_name(self) -> str:
        return "quickbooks"

    @property
    def required_credentials(self) -> List[str]:
        return ["client_id", "client_secret", "realm_id", "access_token", "refresh_token"]

    def __init__(self, company_id: int, credentials: Dict[str, Any], config: Dict[str, Any] = None):
        super().__init__(company_id, credentials, config)
        self.client_id = credentials.get("client_id")
        self.client_secret = credentials.get("client_secret")
        self.realm_id = credentials.get("realm_id")  # Company ID in QuickBooks
        self.access_token = credentials.get("access_token")
        self.refresh_token = credentials.get("refresh_token")

        # API endpoints
        self.base_url = "https://quickbooks.api.intuit.com/v3/company"
        self.auth_url = "https://oauth.platform.intuit.com/oauth2/v1"

        # API version
        self.api_version = "v3"

        # Default entities to sync
        self.default_entities = [
            "Invoice", "Customer", "Item", "Payment", "Bill", "Vendor",
            "Purchase", "Account", "Employee", "Estimate"
        ]

        # Entity fields mapping (QuickBooks returns all fields by default)
        self.entity_limits = {
            "Invoice": 1000,
            "Customer": 1000,
            "Item": 1000,
            "Payment": 1000,
            "Bill": 1000,
            "Vendor": 1000,
            "Purchase": 1000,
            "Account": 1000,
            "Employee": 1000,
            "Estimate": 1000
        }

    def refresh_access_token(self) -> bool:
        """Refresh the OAuth access token using refresh token"""
        try:
            token_url = f"{self.auth_url}/tokens/bearer/refresh"

            # Basic authentication with client_id:client_secret
            import base64
            auth_string = f"{self.client_id}:{self.client_secret}"
            auth_bytes = auth_string.encode('ascii')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')

            headers = {
                'Authorization': f'Basic {auth_b64}',
                'Content-Type': 'application/x-www-form-urlencoded'
            }

            data = {
                'grant_type': 'refresh_token',
                'refresh_token': self.refresh_token
            }

            response = requests.post(token_url, headers=headers, data=data, timeout=30)
            response.raise_for_status()

            token_data = response.json()
            self.access_token = token_data.get('access_token')
            new_refresh_token = token_data.get('refresh_token')

            # Update refresh token if new one provided
            if new_refresh_token:
                self.refresh_token = new_refresh_token

            logger.info("QuickBooks access token refreshed successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to refresh QuickBooks access token: {str(e)}")
            return False

    def authenticate(self) -> bool:
        """Validate authentication credentials"""
        try:
            # QuickBooks uses OAuth 2.0, so we just verify we have valid tokens
            if not self.access_token:
                logger.error("No access token provided")
                return False

            # Test the token with a simple query
            return self.test_connection()

        except Exception as e:
            logger.error(f"QuickBooks authentication failed: {str(e)}")
            return False

    def get_headers(self) -> Dict[str, str]:
        """Get headers for API requests"""
        if not self.access_token:
            raise ValueError("Not authenticated. Need valid access_token.")

        return {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }

    def test_connection(self) -> bool:
        """Test QuickBooks connection"""
        try:
            # Test with CompanyInfo query
            url = f"{self.base_url}/{self.realm_id}/companyinfo/{self.realm_id}"

            response = requests.get(url, headers=self.get_headers(), timeout=10)

            # If 401, try refreshing token
            if response.status_code == 401:
                logger.info("Access token expired, attempting refresh...")
                if self.refresh_access_token():
                    response = requests.get(url, headers=self.get_headers(), timeout=10)
                else:
                    return False

            response.raise_for_status()

            company_info = response.json()
            logger.info(f"QuickBooks connection test successful for company: {company_info.get('CompanyInfo', {}).get('CompanyName', 'Unknown')}")
            return True

        except Exception as e:
            logger.error(f"QuickBooks connection test failed: {str(e)}")
            return False

    def get_available_tables(self) -> List[str]:
        """Get list of available QuickBooks entities"""
        return self.default_entities

    def make_query_request(self, entity: str, query: str, max_results: int = 1000) -> List[Dict]:
        """Make QuickBooks query request with pagination"""
        all_records = []

        try:
            # Ensure we have valid token
            if not self.access_token:
                if not self.authenticate():
                    return []

            url = f"{self.base_url}/{self.realm_id}/query"

            # QuickBooks uses 1-based pagination
            start_position = 1
            max_per_page = 1000  # QuickBooks max is 1000

            while len(all_records) < max_results:
                # Build paginated query
                paginated_query = f"{query} STARTPOSITION {start_position} MAXRESULTS {max_per_page}"

                params = {'query': paginated_query}

                response = requests.get(url, headers=self.get_headers(), params=params, timeout=30)

                # Handle token expiration
                if response.status_code == 401:
                    logger.info("Access token expired, refreshing...")
                    if self.refresh_access_token():
                        continue  # Retry request
                    else:
                        break

                response.raise_for_status()
                data = response.json()

                query_response = data.get('QueryResponse', {})

                # Get records for this entity
                records = query_response.get(entity, [])

                if not records:
                    break

                all_records.extend(records)

                # Check if we've retrieved all records
                if len(records) < max_per_page:
                    break

                # Move to next page
                start_position += max_per_page

            logger.info(f"Retrieved {len(all_records)} {entity} records from QuickBooks")
            return all_records

        except Exception as e:
            logger.error(f"QuickBooks query request failed: {str(e)}")
            return []

    def build_query(self, entity: str, incremental: bool = True) -> str:
        """Build QuickBooks SQL-like query"""
        query = f"SELECT * FROM {entity}"

        conditions = []

        # Add incremental filter if requested
        if incremental:
            # Get records modified in last 30 days
            thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d')
            conditions.append(f"MetaData.LastUpdatedTime >= '{thirty_days_ago}'")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        return query

    def extract_data(self, table_name: str, incremental: bool = True) -> List[Dict[str, Any]]:
        """Extract data from QuickBooks entity"""
        try:
            logger.info(f"Extracting data from QuickBooks {table_name}")

            # Build query
            query = self.build_query(table_name, incremental)

            logger.info(f"Executing query: {query}")

            # Get max results for this entity
            max_results = self.entity_limits.get(table_name, 1000)

            # Execute query
            results = self.make_query_request(table_name, query, max_results)

            if not results:
                logger.info(f"No {table_name} records found")
                return []

            logger.info(f"Extracted {len(results)} {table_name} records")
            return results

        except Exception as e:
            logger.error(f"Failed to extract data from {table_name}: {str(e)}")
            return []

    def get_reports(self, report_type: str, start_date: str = None, end_date: str = None) -> Dict[str, Any]:
        """
        Get QuickBooks reports (Profit & Loss, Balance Sheet, etc.)

        Args:
            report_type: Type of report (e.g., 'ProfitAndLoss', 'BalanceSheet', 'CashFlow')
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
        """
        try:
            url = f"{self.base_url}/{self.realm_id}/reports/{report_type}"

            params = {}
            if start_date:
                params['start_date'] = start_date
            if end_date:
                params['end_date'] = end_date

            response = requests.get(url, headers=self.get_headers(), params=params, timeout=30)

            # Handle token expiration
            if response.status_code == 401:
                if self.refresh_access_token():
                    response = requests.get(url, headers=self.get_headers(), params=params, timeout=30)

            response.raise_for_status()

            return response.json()

        except Exception as e:
            logger.error(f"Failed to get {report_type} report: {str(e)}")
            return {}
