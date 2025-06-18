# Simple data models for in-memory storage while using Snowflake as primary data source
from datetime import datetime
from typing import Dict, List, Optional
import json

class SnowflakeDataModel:
    """Base class for data models that will be stored in Snowflake"""
    
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)
        if not hasattr(self, 'created_at'):
            self.created_at = datetime.utcnow()
        if not hasattr(self, 'id'):
            self.id = None
    
    def to_dict(self):
        result = {}
        for key, value in self.__dict__.items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            else:
                result[key] = value
        return result

class Company(SnowflakeDataModel):
    def __init__(self, name: str, slug: str, database_name: str = None, status: str = 'active', **kwargs):
        super().__init__(**kwargs)
        self.name = name
        self.slug = slug
        self.database_name = database_name or f"{slug.upper()}_DB"
        self.status = status

class User(SnowflakeDataModel):
    def __init__(self, username: str, email: str, company_id: int, password_hash: str = None, **kwargs):
        super().__init__(**kwargs)
        self.username = username
        self.email = email
        self.company_id = company_id
        self.password_hash = password_hash

class DataSource(SnowflakeDataModel):
    def __init__(self, company_id: int, name: str, type: str, connection_string: str = None, 
                 config: str = None, status: str = 'inactive', last_sync_at: datetime = None, **kwargs):
        super().__init__(**kwargs)
        self.company_id = company_id
        self.name = name
        self.type = type
        self.connection_string = connection_string
        self.config = config
        self.status = status
        self.last_sync_at = last_sync_at

class SqlModel(SnowflakeDataModel):
    def __init__(self, company_id: int, name: str, sql_content: str, layer: str, 
                 description: str = None, status: str = 'draft', deployed_at: datetime = None, **kwargs):
        super().__init__(**kwargs)
        self.company_id = company_id
        self.name = name
        self.description = description
        self.sql_content = sql_content
        self.layer = layer
        self.status = status
        self.deployed_at = deployed_at

class KpiMetric(SnowflakeDataModel):
    def __init__(self, company_id: int, name: str, sql_query: str, description: str = None,
                 business_type: str = None, category: str = None, calculation_type: str = 'snapshot',
                 target_value: str = None, status: str = 'active', last_calculated_at: datetime = None, **kwargs):
        super().__init__(**kwargs)
        self.company_id = company_id
        self.name = name
        self.description = description
        self.sql_query = sql_query
        self.business_type = business_type
        self.category = category
        self.calculation_type = calculation_type
        self.target_value = target_value
        self.status = status
        self.last_calculated_at = last_calculated_at

class ChatMessage(SnowflakeDataModel):
    def __init__(self, company_id: int, user_id: int, role: str, content: str,
                 session_id: str = None, file_attachments: str = None, timestamp: datetime = None, **kwargs):
        super().__init__(**kwargs)
        self.company_id = company_id
        self.user_id = user_id
        self.session_id = session_id
        self.role = role
        self.content = content
        self.file_attachments = file_attachments
        self.timestamp = timestamp or datetime.utcnow()

class PipelineActivity(SnowflakeDataModel):
    def __init__(self, company_id: int, activity_type: str, description: str, status: str,
                 details: str = None, timestamp: datetime = None, **kwargs):
        super().__init__(**kwargs)
        self.company_id = company_id
        self.activity_type = activity_type
        self.description = description
        self.status = status
        self.details = details
        self.timestamp = timestamp or datetime.utcnow()

class SetupStatus(SnowflakeDataModel):
    def __init__(self, company_id: int, data_sources_configured: bool = False, 
                 ai_assistant_enabled: bool = False, kpi_metrics_created: bool = False,
                 pipeline_deployed: bool = False, business_type: str = None,
                 onboarding_completed: bool = False, updated_at: datetime = None, **kwargs):
        super().__init__(**kwargs)
        self.company_id = company_id
        self.data_sources_configured = data_sources_configured
        self.ai_assistant_enabled = ai_assistant_enabled
        self.kpi_metrics_created = kpi_metrics_created
        self.pipeline_deployed = pipeline_deployed
        self.business_type = business_type
        self.onboarding_completed = onboarding_completed
        self.updated_at = updated_at or datetime.utcnow()