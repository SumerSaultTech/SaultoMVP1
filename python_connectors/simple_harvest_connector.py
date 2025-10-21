"""
Simplified Harvest API connector without pandas dependency.
"""

import requests
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import logging
from .simple_base_connector import SimpleBaseConnector

logger = logging.getLogger(__name__)

class SimpleHarvestConnector(SimpleBaseConnector):
    """Simplified Harvest API connector using OAuth 2.0 and REST API v2"""

    @property
    def connector_name(self) -> str:
        return "harvest"

    @property
    def required_credentials(self) -> List[str]:
        return ["account_id", "access_token"]

    def __init__(self, company_id: int, credentials: Dict[str, Any], config: Dict[str, Any] = None):
        super().__init__(company_id, credentials, config)
        self.account_id = credentials.get("account_id")
        self.access_token = credentials.get("access_token")

        # API configuration
        self.base_url = "https://api.harvestapp.com/v2"
        self.api_version = "v2"

        # Default entities to sync
        self.default_entities = [
            "time_entries", "projects", "clients", "tasks", "users",
            "invoices", "expenses", "estimates", "contacts", "roles"
        ]

        # Pagination settings
        self.per_page = 100  # Harvest default is 100

    def authenticate(self) -> bool:
        """Validate authentication credentials"""
        try:
            if not self.access_token or not self.account_id:
                logger.error("Missing access_token or account_id")
                return False

            # Test with a simple API call
            return self.test_connection()

        except Exception as e:
            logger.error(f"Harvest authentication failed: {str(e)}")
            return False

    def get_headers(self) -> Dict[str, str]:
        """Get headers for API requests"""
        if not self.access_token or not self.account_id:
            raise ValueError("Not authenticated. Need valid access_token and account_id.")

        return {
            'Authorization': f'Bearer {self.access_token}',
            'Harvest-Account-ID': str(self.account_id),
            'User-Agent': 'Saulto Business Metrics Dashboard',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }

    def test_connection(self) -> bool:
        """Test Harvest connection"""
        try:
            # Test with current user endpoint
            url = f"{self.base_url}/users/me"

            response = requests.get(url, headers=self.get_headers(), timeout=10)
            response.raise_for_status()

            user_data = response.json()
            logger.info(f"Harvest connection test successful for user: {user_data.get('first_name', 'Unknown')} {user_data.get('last_name', '')}")
            return True

        except Exception as e:
            logger.error(f"Harvest connection test failed: {str(e)}")
            return False

    def get_available_tables(self) -> List[str]:
        """Get list of available Harvest entities"""
        return self.default_entities

    def make_paginated_request(self, endpoint: str, params: Dict[str, Any] = None) -> List[Dict]:
        """Make paginated request to Harvest API"""
        all_records = []

        try:
            if not self.access_token:
                if not self.authenticate():
                    return []

            url = f"{self.base_url}/{endpoint}"
            page = 1

            if params is None:
                params = {}

            while True:
                # Add pagination parameters
                params['page'] = page
                params['per_page'] = self.per_page

                response = requests.get(url, headers=self.get_headers(), params=params, timeout=30)
                response.raise_for_status()

                data = response.json()

                # Extract records from response
                # Harvest API returns data in format: {entity_name: [...], per_page: X, total_pages: Y, ...}
                # Find the key that contains the list of records
                records = []
                for key, value in data.items():
                    if isinstance(value, list) and key != 'links':
                        records = value
                        break

                if not records:
                    break

                all_records.extend(records)

                # Check if there are more pages
                total_pages = data.get('total_pages', 1)
                if page >= total_pages:
                    break

                page += 1

            logger.info(f"Retrieved {len(all_records)} records from Harvest {endpoint}")
            return all_records

        except Exception as e:
            logger.error(f"Harvest API request failed for {endpoint}: {str(e)}")
            return []

    def extract_data(self, table_name: str, incremental: bool = True) -> List[Dict[str, Any]]:
        """Extract data from Harvest entity"""
        try:
            logger.info(f"Extracting data from Harvest {table_name}")

            params = {}

            # Add incremental filter if requested
            if incremental:
                # Get records updated in last 30 days
                thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d')
                params['updated_since'] = thirty_days_ago

            # Execute request
            results = self.make_paginated_request(table_name, params)

            if not results:
                logger.info(f"No {table_name} records found")
                return []

            logger.info(f"Extracted {len(results)} {table_name} records")
            return results

        except Exception as e:
            logger.error(f"Failed to extract data from {table_name}: {str(e)}")
            return []

    def get_time_entries_by_date_range(self, from_date: str, to_date: str, user_id: int = None,
                                        project_id: int = None, is_billed: bool = None) -> List[Dict]:
        """
        Get time entries for a specific date range with optional filters

        Args:
            from_date: Start date in YYYY-MM-DD format
            to_date: End date in YYYY-MM-DD format
            user_id: Filter by specific user ID
            project_id: Filter by specific project ID
            is_billed: Filter by billing status (True/False/None)
        """
        try:
            params = {
                'from': from_date,
                'to': to_date
            }

            if user_id is not None:
                params['user_id'] = user_id

            if project_id is not None:
                params['project_id'] = project_id

            if is_billed is not None:
                params['is_billed'] = str(is_billed).lower()

            return self.make_paginated_request('time_entries', params)

        except Exception as e:
            logger.error(f"Failed to get time entries: {str(e)}")
            return []

    def get_project_tasks(self, project_id: int) -> List[Dict]:
        """Get all task assignments for a specific project"""
        try:
            endpoint = f"projects/{project_id}/task_assignments"
            return self.make_paginated_request(endpoint)

        except Exception as e:
            logger.error(f"Failed to get project tasks: {str(e)}")
            return []

    def get_project_users(self, project_id: int) -> List[Dict]:
        """Get all user assignments for a specific project"""
        try:
            endpoint = f"projects/{project_id}/user_assignments"
            return self.make_paginated_request(endpoint)

        except Exception as e:
            logger.error(f"Failed to get project users: {str(e)}")
            return []

    def get_company_info(self) -> Dict[str, Any]:
        """Get information about the Harvest account"""
        try:
            url = f"{self.base_url}/company"
            response = requests.get(url, headers=self.get_headers(), timeout=10)
            response.raise_for_status()

            return response.json()

        except Exception as e:
            logger.error(f"Failed to get company info: {str(e)}")
            return {}

    def get_invoice_messages(self, invoice_id: int) -> List[Dict]:
        """Get all messages for a specific invoice"""
        try:
            endpoint = f"invoices/{invoice_id}/messages"
            return self.make_paginated_request(endpoint)

        except Exception as e:
            logger.error(f"Failed to get invoice messages: {str(e)}")
            return []

    def get_invoice_payments(self, invoice_id: int) -> List[Dict]:
        """Get all payments for a specific invoice"""
        try:
            endpoint = f"invoices/{invoice_id}/payments"
            return self.make_paginated_request(endpoint)

        except Exception as e:
            logger.error(f"Failed to get invoice payments: {str(e)}")
            return []

    def get_project_expenses(self, project_id: int = None, from_date: str = None,
                             to_date: str = None, is_billed: bool = None) -> List[Dict]:
        """
        Get expenses with optional filters

        Args:
            project_id: Filter by specific project ID
            from_date: Start date in YYYY-MM-DD format
            to_date: End date in YYYY-MM-DD format
            is_billed: Filter by billing status
        """
        try:
            params = {}

            if project_id is not None:
                params['project_id'] = project_id

            if from_date:
                params['from'] = from_date

            if to_date:
                params['to'] = to_date

            if is_billed is not None:
                params['is_billed'] = str(is_billed).lower()

            return self.make_paginated_request('expenses', params)

        except Exception as e:
            logger.error(f"Failed to get expenses: {str(e)}")
            return []
