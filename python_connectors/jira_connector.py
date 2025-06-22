"""
Jira API connector for extracting data and loading to Snowflake.
"""

import pandas as pd
import requests
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import logging
import base64
from .base_connector import BaseConnector

logger = logging.getLogger(__name__)

class JiraConnector(BaseConnector):
    """Jira API connector using REST API v3"""
    
    @property
    def connector_name(self) -> str:
        return "jira"
    
    @property
    def required_credentials(self) -> List[str]:
        return ["server_url", "username", "api_token"]
    
    def __init__(self, company_id: int, credentials: Dict[str, Any], config: Dict[str, Any] = None):
        super().__init__(company_id, credentials, config)
        self.server_url = credentials.get("server_url", "").rstrip('/')
        self.username = credentials.get("username")
        self.api_token = credentials.get("api_token")
        
        # Create basic auth header
        if self.username and self.api_token:
            auth_string = f"{self.username}:{self.api_token}"
            auth_bytes = auth_string.encode('ascii')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
            self.auth_header = f"Basic {auth_b64}"
        else:
            self.auth_header = None
        
        # Default objects to sync
        self.default_objects = [
            "issues", "projects", "users", "workflows", "statuses", "priorities",
            "issue_types", "components", "versions", "boards", "sprints"
        ]
        
        # Object to endpoint mapping
        self.object_endpoints = {
            "issues": "/rest/api/3/search",
            "projects": "/rest/api/3/project",
            "users": "/rest/api/3/users/search",
            "workflows": "/rest/api/3/workflow",
            "statuses": "/rest/api/3/status",
            "priorities": "/rest/api/3/priority",
            "issue_types": "/rest/api/3/issuetype",
            "components": "/rest/api/3/component",
            "versions": "/rest/api/3/version",
            "boards": "/rest/agile/1.0/board",
            "sprints": "/rest/agile/1.0/sprint"
        }
    
    def get_headers(self) -> Dict[str, str]:
        """Get headers for API requests"""
        if not self.auth_header:
            raise ValueError("Authentication not configured")
        
        return {
            'Authorization': self.auth_header,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    
    def test_connection(self) -> bool:
        """Test Jira connection"""
        try:
            url = f"{self.server_url}/rest/api/3/myself"
            response = requests.get(url, headers=self.get_headers(), timeout=10)
            response.raise_for_status()
            
            logger.info("Jira connection test successful")
            return True
            
        except Exception as e:
            logger.error(f"Jira connection test failed: {str(e)}")
            return False
    
    def get_available_tables(self) -> List[str]:
        """Get list of available Jira objects"""
        # For Jira, we return our predefined objects since they're standard
        return self.default_objects
    
    def make_paginated_request(self, url: str, params: Dict[str, Any] = None) -> List[Dict]:
        """Make paginated requests to Jira API"""
        all_results = []
        start_at = 0
        max_results = 100
        
        if params is None:
            params = {}
        
        while True:
            request_params = {
                **params,
                'startAt': start_at,
                'maxResults': max_results
            }
            
            try:
                response = requests.get(url, headers=self.get_headers(), params=request_params)
                response.raise_for_status()
                
                data = response.json()
                
                # Handle different response formats
                if 'issues' in data:
                    # Issues endpoint
                    results = data['issues']
                    total = data.get('total', 0)
                elif 'values' in data:
                    # Agile endpoints (boards, sprints)
                    results = data['values']
                    total = data.get('total', len(results))
                else:
                    # Direct array response (projects, users, etc.)
                    results = data if isinstance(data, list) else [data]
                    total = len(results)
                
                all_results.extend(results)
                
                # Check if we have more pages
                if len(results) < max_results or len(all_results) >= total:
                    break
                
                start_at += max_results
                
                # Safety check to prevent infinite loops
                if start_at > 10000:
                    logger.warning(f"Reached maximum pagination limit for {url}")
                    break
                    
            except Exception as e:
                logger.error(f"Error making paginated request to {url}: {str(e)}")
                break
        
        return all_results
    
    def extract_issues(self, incremental: bool = True) -> pd.DataFrame:
        """Extract Jira issues"""
        try:
            url = f"{self.server_url}/rest/api/3/search"
            
            # Build JQL query
            jql_parts = []
            
            # Add incremental filter if requested
            if incremental:
                last_sync = self.get_last_sync_timestamp("issues")
                if last_sync:
                    # Convert to Jira datetime format
                    jira_datetime = last_sync.strftime('%Y-%m-%d %H:%M')
                    jql_parts.append(f"updated >= '{jira_datetime}'")
            
            # Add ordering
            jql_parts.append("ORDER BY updated DESC")
            
            jql = " AND ".join(jql_parts) if jql_parts else "ORDER BY updated DESC"
            
            params = {
                'jql': jql,
                'expand': 'changelog',
                'fields': '*all'
            }
            
            logger.info(f"Executing JQL: {jql}")
            
            results = self.make_paginated_request(url, params)
            
            if not results:
                logger.info("No issues found")
                return pd.DataFrame()
            
            # Flatten issue data
            flattened_issues = []
            for issue in results:
                flat_issue = {
                    'id': issue.get('id'),
                    'key': issue.get('key'),
                    'self': issue.get('self')
                }
                
                # Flatten fields
                fields = issue.get('fields', {})
                for field_key, field_value in fields.items():
                    if isinstance(field_value, dict):
                        # Handle complex objects
                        if 'name' in field_value:
                            flat_issue[f"{field_key}_name"] = field_value['name']
                        if 'displayName' in field_value:
                            flat_issue[f"{field_key}_display_name"] = field_value['displayName']
                        if 'key' in field_value:
                            flat_issue[f"{field_key}_key"] = field_value['key']
                        # Store full object as JSON string
                        flat_issue[field_key] = str(field_value)
                    elif isinstance(field_value, list):
                        # Handle arrays
                        if field_value and isinstance(field_value[0], dict):
                            # Extract names from object arrays
                            names = [item.get('name', str(item)) for item in field_value]
                            flat_issue[f"{field_key}_names"] = ', '.join(names)
                        flat_issue[field_key] = str(field_value)
                    else:
                        flat_issue[field_key] = field_value
                
                flattened_issues.append(flat_issue)
            
            df = pd.DataFrame(flattened_issues)
            
            # Convert date columns
            date_columns = [col for col in df.columns if 'date' in col.lower() or 'time' in col.lower()]
            for col in date_columns:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce')
            
            logger.info(f"Extracted {len(df)} issues")
            return df
            
        except Exception as e:
            logger.error(f"Failed to extract issues: {str(e)}")
            return pd.DataFrame()
    
    def extract_projects(self) -> pd.DataFrame:
        """Extract Jira projects"""
        try:
            url = f"{self.server_url}/rest/api/3/project"
            params = {'expand': 'description,lead,issueTypes,url,projectKeys'}
            
            results = self.make_paginated_request(url, params)
            
            if not results:
                return pd.DataFrame()
            
            # Flatten project data
            flattened_projects = []
            for project in results:
                flat_project = {}
                for key, value in project.items():
                    if isinstance(value, dict):
                        # Handle nested objects
                        if 'name' in value:
                            flat_project[f"{key}_name"] = value['name']
                        if 'displayName' in value:
                            flat_project[f"{key}_display_name"] = value['displayName']
                        flat_project[key] = str(value)
                    elif isinstance(value, list):
                        flat_project[f"{key}_count"] = len(value)
                        flat_project[key] = str(value)
                    else:
                        flat_project[key] = value
                
                flattened_projects.append(flat_project)
            
            df = pd.DataFrame(flattened_projects)
            logger.info(f"Extracted {len(df)} projects")
            return df
            
        except Exception as e:
            logger.error(f"Failed to extract projects: {str(e)}")
            return pd.DataFrame()
    
    def extract_users(self) -> pd.DataFrame:
        """Extract Jira users"""
        try:
            url = f"{self.server_url}/rest/api/3/users/search"
            params = {'query': ''}  # Empty query returns all users
            
            results = self.make_paginated_request(url, params)
            
            if not results:
                return pd.DataFrame()
            
            df = pd.DataFrame(results)
            logger.info(f"Extracted {len(df)} users")
            return df
            
        except Exception as e:
            logger.error(f"Failed to extract users: {str(e)}")
            return pd.DataFrame()
    
    def extract_generic_object(self, object_name: str) -> pd.DataFrame:
        """Extract generic Jira objects (statuses, priorities, etc.)"""
        try:
            endpoint = self.object_endpoints.get(object_name)
            if not endpoint:
                logger.warning(f"No endpoint defined for {object_name}")
                return pd.DataFrame()
            
            url = f"{self.server_url}{endpoint}"
            
            # Some endpoints don't support pagination
            if object_name in ['statuses', 'priorities', 'issue_types']:
                response = requests.get(url, headers=self.get_headers())
                response.raise_for_status()
                results = response.json()
                if not isinstance(results, list):
                    results = [results]
            else:
                results = self.make_paginated_request(url)
            
            if not results:
                return pd.DataFrame()
            
            df = pd.DataFrame(results)
            logger.info(f"Extracted {len(df)} {object_name}")
            return df
            
        except Exception as e:
            logger.error(f"Failed to extract {object_name}: {str(e)}")
            return pd.DataFrame()
    
    def extract_data(self, table_name: str, incremental: bool = True) -> pd.DataFrame:
        """Extract data from Jira object"""
        try:
            logger.info(f"Extracting data from Jira {table_name}")
            
            # Special handling for different object types
            if table_name == "issues":
                return self.extract_issues(incremental)
            elif table_name == "projects":
                return self.extract_projects()
            elif table_name == "users":
                return self.extract_users()
            else:
                return self.extract_generic_object(table_name)
                
        except Exception as e:
            logger.error(f"Failed to extract data from {table_name}: {str(e)}")
            return pd.DataFrame()