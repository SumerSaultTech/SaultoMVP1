"""
Odoo ERP connector with OAuth 2.0 authentication.
Supports extracting ERP data for business metrics and analytics.
"""

import requests
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json

from .simple_base_connector import SimpleBaseConnector

logger = logging.getLogger(__name__)

class SimpleOdooConnector(SimpleBaseConnector):
    """
    Connector for Odoo ERP system using OAuth 2.0.
    
    This connector uses Odoo's native OAuth 2.0 implementation
    to securely access ERP data for analytics purposes.
    """
    
    def __init__(self, company_id: int, credentials: Dict[str, Any], config: Dict[str, Any] = None):
        super().__init__(company_id, credentials, config)
        
        # Odoo instance URL (e.g., https://mycompany.odoo.com)
        self.base_url = credentials.get('odoo_instance_url', '').rstrip('/')
        
        # OAuth access token
        self.access_token = credentials.get('access_token', '')
        
        # Database name
        self.database = credentials.get('database', '')
        
        # Store session for API calls
        self.session = requests.Session()
        
        # Setup authentication headers
        if self.access_token:
            self.session.headers.update({
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            })
    
    @property
    def connector_name(self) -> str:
        return 'odoo'
    
    @property
    def required_credentials(self) -> List[str]:
        """Required credentials for Odoo OAuth connector"""
        return ['odoo_instance_url', 'access_token', 'database']
    
    def test_connection(self) -> bool:
        """Test if the Odoo connection is working"""
        try:
            # Try to get server version info
            result = self._make_jsonrpc_call('common', 'version', [])
            if result and 'server_version' in result:
                logger.info(f"Connected to Odoo version: {result.get('server_version')}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False
    
    def get_available_tables(self) -> List[str]:
        """Get list of available Odoo models for ERP metrics"""
        # Return key ERP models for business metrics
        return [
            'sale_order',          # Sales orders
            'account_move',        # Invoices and bills
            'stock_move',          # Inventory movements
            'purchase_order',      # Purchase orders
            'res_partner',         # Customers and vendors
            'product_product',     # Products
            'hr_employee',         # Employees (if HR module installed)
            'project_project',     # Projects (if Project module installed)
            'crm_lead',           # CRM leads/opportunities
        ]
    
    def _make_jsonrpc_call(self, service: str, method: str, args: List = None) -> Any:
        """Make a JSON-RPC call to Odoo"""
        try:
            url = f"{self.base_url}/jsonrpc"
            
            data = {
                'jsonrpc': '2.0',
                'method': 'call',
                'params': {
                    'service': service,
                    'method': method,
                    'args': args or []
                },
                'id': 1
            }
            
            response = self.session.post(url, json=data)
            response.raise_for_status()
            
            result = response.json()
            if 'error' in result:
                raise Exception(f"Odoo API error: {result['error']}")
                
            return result.get('result')
            
        except Exception as e:
            logger.error(f"JSON-RPC call failed: {e}")
            raise e
    
    def _make_model_call(self, model: str, method: str, args: List = None, kwargs: Dict = None) -> Any:
        """Make a model-specific call to Odoo"""
        try:
            url = f"{self.base_url}/jsonrpc"
            
            data = {
                'jsonrpc': '2.0',
                'method': 'call',
                'params': {
                    'model': model,
                    'method': method,
                    'args': args or [],
                    'kwargs': kwargs or {}
                },
                'id': 1
            }
            
            response = self.session.post(url, json=data)
            response.raise_for_status()
            
            result = response.json()
            if 'error' in result:
                raise Exception(f"Odoo model call error: {result['error']}")
                
            return result.get('result')
            
        except Exception as e:
            logger.error(f"Model call failed: {e}")
            raise e
    
    def extract_data(self, table_name: str, incremental: bool = True) -> List[Dict[str, Any]]:
        """Extract data from Odoo model"""
        try:
            # Map table names to Odoo models
            model_mapping = {
                'sale_order': 'sale.order',
                'account_move': 'account.move',
                'stock_move': 'stock.move',
                'purchase_order': 'purchase.order',
                'res_partner': 'res.partner',
                'product_product': 'product.product',
                'hr_employee': 'hr.employee',
                'project_project': 'project.project',
                'crm_lead': 'crm.lead',
            }
            
            model = model_mapping.get(table_name)
            if not model:
                logger.warning(f"Unknown table: {table_name}")
                return []
            
            # Build domain filter for incremental sync
            domain = []
            if incremental:
                # Get records modified in last 30 days
                cutoff_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
                domain = [('write_date', '>=', cutoff_date)]
            
            # Define fields to extract based on model
            fields_mapping = {
                'sale.order': [
                    'id', 'name', 'partner_id', 'date_order', 'state',
                    'amount_total', 'amount_untaxed', 'currency_id',
                    'user_id', 'team_id', 'create_date', 'write_date'
                ],
                'account.move': [
                    'id', 'name', 'partner_id', 'invoice_date', 'state',
                    'move_type', 'amount_total', 'amount_untaxed', 
                    'amount_residual', 'currency_id', 'invoice_payment_state',
                    'create_date', 'write_date'
                ],
                'stock.move': [
                    'id', 'name', 'product_id', 'product_uom_qty',
                    'state', 'date', 'location_id', 'location_dest_id',
                    'picking_id', 'create_date', 'write_date'
                ],
                'res.partner': [
                    'id', 'name', 'is_company', 'customer_rank', 'supplier_rank',
                    'country_id', 'city', 'phone', 'email', 'active',
                    'create_date', 'write_date'
                ],
                'product.product': [
                    'id', 'name', 'default_code', 'list_price', 'standard_price',
                    'qty_available', 'virtual_available', 'categ_id',
                    'active', 'create_date', 'write_date'
                ],
                'crm.lead': [
                    'id', 'name', 'partner_id', 'expected_revenue', 'probability',
                    'stage_id', 'user_id', 'team_id', 'create_date', 'write_date',
                    'date_closed', 'type'
                ],
                'hr.employee': [
                    'id', 'name', 'work_email', 'job_id', 'department_id',
                    'manager_id', 'active', 'create_date', 'write_date'
                ],
                'project.project': [
                    'id', 'name', 'user_id', 'partner_id', 'date_start',
                    'date', 'stage_id', 'active', 'create_date', 'write_date'
                ],
                'purchase.order': [
                    'id', 'name', 'partner_id', 'date_order', 'state',
                    'amount_total', 'amount_untaxed', 'currency_id',
                    'user_id', 'create_date', 'write_date'
                ]
            }
            
            fields = fields_mapping.get(model, ['id', 'name', 'create_date', 'write_date'])
            
            # Search and read records
            records = self._make_model_call(
                model,
                'search_read',
                args=[domain],
                kwargs={'fields': fields, 'limit': 1000}
            )
            
            # Process records to handle Odoo's many2one fields
            processed_records = []
            for record in records:
                processed = {}
                for key, value in record.items():
                    # Handle many2one fields (returns [id, name])
                    if isinstance(value, list) and len(value) == 2 and isinstance(value[0], int):
                        processed[f"{key}_id"] = value[0]
                        processed[f"{key}_name"] = value[1]
                    else:
                        processed[key] = value
                        
                # Add metadata
                processed['_extracted_at'] = datetime.utcnow().isoformat()
                processed['_source'] = 'odoo'
                processed['_company_id'] = self.company_id
                
                processed_records.append(processed)
            
            logger.info(f"Extracted {len(processed_records)} records from {model}")
            return processed_records
            
        except Exception as e:
            logger.error(f"Failed to extract data from {table_name}: {e}")
            return []
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get high-level ERP metrics for dashboard"""
        try:
            metrics = {}
            
            # Sales metrics
            try:
                # Total confirmed sales orders
                sales_orders = self._make_model_call(
                    'sale.order',
                    'search_count',
                    args=[[('state', 'in', ['sale', 'done'])]]
                )
                
                # Total sales value using read_group
                sales_data = self._make_model_call(
                    'sale.order',
                    'read_group',
                    args=[[('state', 'in', ['sale', 'done'])]],
                    kwargs={
                        'fields': ['amount_total:sum'],
                        'groupby': []
                    }
                )
                
                metrics['total_sales_orders'] = sales_orders
                metrics['total_sales_value'] = sales_data[0].get('amount_total', 0) if sales_data else 0
                
            except Exception as e:
                logger.error(f"Failed to get sales metrics: {e}")
            
            # Invoice metrics
            try:
                invoices = self._make_model_call(
                    'account.move',
                    'search_count',
                    args=[[('move_type', '=', 'out_invoice'), ('state', '=', 'posted')]]
                )
                
                metrics['total_invoices'] = invoices
                
            except Exception as e:
                logger.error(f"Failed to get invoice metrics: {e}")
            
            # Customer metrics
            try:
                customers = self._make_model_call(
                    'res.partner',
                    'search_count',
                    args=[[('customer_rank', '>', 0)]]
                )
                
                metrics['total_customers'] = customers
                
            except Exception as e:
                logger.error(f"Failed to get customer metrics: {e}")
            
            # Product metrics
            try:
                products = self._make_model_call(
                    'product.product',
                    'search_count',
                    args=[[('active', '=', True)]]
                )
                
                metrics['total_products'] = products
                
            except Exception as e:
                logger.error(f"Failed to get product metrics: {e}")
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to get metrics summary: {e}")
            return {}
    
    def get_recent_sales_orders(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent sales orders for quick dashboard view"""
        try:
            domain = [('state', 'in', ['sale', 'done'])]
            fields = ['name', 'partner_id', 'date_order', 'amount_total', 'state']
            
            orders = self._make_model_call(
                'sale.order',
                'search_read',
                args=[domain],
                kwargs={
                    'fields': fields,
                    'order': 'date_order desc',
                    'limit': limit
                }
            )
            
            return orders or []
            
        except Exception as e:
            logger.error(f"Failed to get recent sales orders: {e}")
            return []
    
    def get_outstanding_invoices(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get outstanding invoices for cash flow tracking"""
        try:
            domain = [
                ('move_type', '=', 'out_invoice'),
                ('state', '=', 'posted'),
                ('amount_residual', '>', 0)
            ]
            fields = ['name', 'partner_id', 'invoice_date', 'amount_total', 'amount_residual']
            
            invoices = self._make_model_call(
                'account.move',
                'search_read',
                args=[domain],
                kwargs={
                    'fields': fields,
                    'order': 'invoice_date desc',
                    'limit': limit
                }
            )
            
            return invoices or []
            
        except Exception as e:
            logger.error(f"Failed to get outstanding invoices: {e}")
            return []