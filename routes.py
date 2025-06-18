import os
import json
import logging
from datetime import datetime
from flask import request, jsonify, send_from_directory, session
from werkzeug.utils import secure_filename
from app import app
from models import User, Company, DataSource, SqlModel, KpiMetric, ChatMessage, PipelineActivity, SetupStatus

# Configure upload settings
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {
    'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 
    'ppt', 'pptx', 'csv', 'json', 'zip', 'py', 'js', 'html', 'css', 'c', 
    'cpp', 'h', 'java', 'rb', 'php', 'xml', 'md'
}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# In-memory storage for development (replace with Snowflake queries in production)
data_store = {
    'companies': [{'id': 1, 'name': 'Demo Company', 'slug': 'demo_company', 'databaseName': 'DEMO_COMPANY_DB', 'status': 'active', 'createdAt': datetime.utcnow().isoformat()}],
    'data_sources': [],
    'kpi_metrics': [],
    'chat_messages': [],
    'setup_status': {'company_id': 1, 'dataSourcesConfigured': False, 'aiAssistantEnabled': False, 'kpiMetricsCreated': False, 'pipelineDeployed': False, 'businessType': None, 'onboardingCompleted': False}
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_current_company_id():
    return session.get('company_id', 1)

def get_current_user_id():
    return session.get('user_id', 1)

def register_routes(app):
    """Register all API routes"""
    
    @app.route('/api/test')
    def api_test():
        return jsonify({
            'message': 'API is working',
            'timestamp': datetime.utcnow().isoformat()
        })

    # Company routes
    @app.route('/api/companies')
    def get_companies():
        return jsonify(data_store['companies'])

    @app.route('/api/companies', methods=['POST'])
    def create_company():
        data = request.get_json()
        company = {
            'id': len(data_store['companies']) + 1,
            'name': data['name'],
            'slug': data.get('slug', data['name'].lower().replace(' ', '_')),
            'databaseName': data.get('databaseName'),
            'status': data.get('status', 'active'),
            'createdAt': datetime.utcnow().isoformat()
        }
        data_store['companies'].append(company)
        return jsonify(company)

    # Data sources routes
    @app.route('/api/data-sources')
    def get_data_sources():
        company_id = get_current_company_id()
        sources = [ds for ds in data_store['data_sources'] if ds.get('company_id') == company_id]
        return jsonify(sources)

    @app.route('/api/data-sources', methods=['POST'])
    def create_data_source():
        data = request.get_json()
        company_id = get_current_company_id()
        
        data_source = {
            'id': len(data_store['data_sources']) + 1,
            'company_id': company_id,
            'name': data['name'],
            'type': data['type'],
            'status': data.get('status', 'inactive'),
            'lastSyncAt': None,
            'createdAt': datetime.utcnow().isoformat()
        }
        data_store['data_sources'].append(data_source)
        return jsonify(data_source)

    # KPI Metrics routes
    @app.route('/api/kpi-metrics')
    def get_kpi_metrics():
        company_id = get_current_company_id()
        metrics = [m for m in data_store['kpi_metrics'] if m.get('company_id') == company_id]
        return jsonify(metrics)

    @app.route('/api/kpi-metrics', methods=['POST'])
    def create_kpi_metric():
        data = request.get_json()
        company_id = get_current_company_id()
        
        metric = {
            'id': len(data_store['kpi_metrics']) + 1,
            'company_id': company_id,
            'name': data['name'],
            'description': data.get('description'),
            'sqlQuery': data['sqlQuery'],
            'businessType': data.get('businessType'),
            'category': data.get('category'),
            'calculationType': data.get('calculationType', 'snapshot'),
            'targetValue': data.get('targetValue'),
            'status': data.get('status', 'active'),
            'lastCalculatedAt': None,
            'createdAt': datetime.utcnow().isoformat()
        }
        data_store['kpi_metrics'].append(metric)
        return jsonify(metric)

    @app.route('/api/kpi-metrics/<int:metric_id>', methods=['DELETE'])
    def delete_kpi_metric(metric_id):
        data_store['kpi_metrics'] = [m for m in data_store['kpi_metrics'] if m.get('id') != metric_id]
        return jsonify({'success': True})

    # Chat routes
    @app.route('/api/chat/messages')
    def get_chat_messages():
        company_id = get_current_company_id()
        session_id = request.args.get('sessionId')
        
        messages = [m for m in data_store['chat_messages'] if m.get('company_id') == company_id]
        if session_id:
            messages = [m for m in messages if m.get('sessionId') == session_id]
        
        return jsonify(messages)

    @app.route('/api/chat/messages', methods=['POST'])
    def create_chat_message():
        data = request.get_json()
        company_id = get_current_company_id()
        user_id = get_current_user_id()
        
        message = {
            'id': len(data_store['chat_messages']) + 1,
            'company_id': company_id,
            'user_id': user_id,
            'sessionId': data.get('sessionId'),
            'role': data['role'],
            'content': data['content'],
            'fileAttachments': data.get('fileAttachments', []),
            'timestamp': datetime.utcnow().isoformat()
        }
        data_store['chat_messages'].append(message)
        return jsonify(message)

    # Snowflake integration routes
    @app.route('/api/snowflake/test-connection', methods=['POST'])
    def test_snowflake_connection():
        # Check if Snowflake credentials are configured
        required_vars = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD', 'SNOWFLAKE_WAREHOUSE', 'SNOWFLAKE_DATABASE']
        missing_vars = [var for var in required_vars if not os.environ.get(var)]
        
        if missing_vars:
            return jsonify({
                'success': False, 
                'error': f'Missing Snowflake configuration: {", ".join(missing_vars)}. Please configure these environment variables.'
            })
        
        try:
            # Import and test Snowflake connection
            from snowflake_service import snowflake_service
            result = snowflake_service.test_connection()
            return jsonify(result)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})

    @app.route('/api/snowflake/query', methods=['POST'])
    def execute_snowflake_query():
        data = request.get_json()
        query = data.get('query', '')
        
        if not query.strip():
            return jsonify({'success': False, 'error': 'Query cannot be empty'})
        
        try:
            from snowflake_service import snowflake_service
            result = snowflake_service.execute_query(query)
            return jsonify(result)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})

    # Dashboard data routes
    @app.route('/api/dashboard/metrics')
    def get_dashboard_metrics():
        company_id = get_current_company_id()
        
        # Return sample dashboard data based on configured KPI metrics
        kpi_count = len([m for m in data_store['kpi_metrics'] if m.get('company_id') == company_id])
        data_source_count = len([ds for ds in data_store['data_sources'] if ds.get('company_id') == company_id])
        
        dashboard_data = [
            {
                'id': 1,
                'name': 'KPI Metrics Configured',
                'value': str(kpi_count),
                'change': f'{kpi_count} metrics created',
                'category': 'configuration'
            },
            {
                'id': 2,
                'name': 'Data Sources Connected',
                'value': str(data_source_count),
                'change': f'{data_source_count} sources configured',
                'category': 'data'
            },
            {
                'id': 3,
                'name': 'Snowflake Status',
                'value': 'Ready' if all(os.environ.get(var) for var in ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER']) else 'Not Configured',
                'change': 'Configure Snowflake credentials to enable analytics',
                'category': 'infrastructure'
            }
        ]
        
        return jsonify(dashboard_data)

    # Setup status routes
    @app.route('/api/setup-status')
    def get_setup_status():
        return jsonify(data_store['setup_status'])

    @app.route('/api/setup-status', methods=['PUT'])
    def update_setup_status():
        data = request.get_json()
        data_store['setup_status'].update(data)
        data_store['setup_status']['updated_at'] = datetime.utcnow().isoformat()
        return jsonify({'success': True})

    # File upload route
    @app.route('/api/upload', methods=['POST'])
    def upload_file():
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        
        files = request.files.getlist('files')
        uploaded_files = []
        
        for file in files:
            if file and file.filename and allowed_file(file.filename):
                timestamp = int(datetime.utcnow().timestamp() * 1000)
                original_name = secure_filename(file.filename)
                filename = f"{timestamp}_{original_name}"
                
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                uploaded_files.append(filename)
        
        return jsonify({'files': uploaded_files})

    # Configure MIME types for proper module loading
    @app.after_request
    def after_request(response):
        if request.path.endswith('.js') or request.path.endswith('.ts') or request.path.endswith('.tsx'):
            response.headers['Content-Type'] = 'application/javascript'
        elif request.path.endswith('.css'):
            response.headers['Content-Type'] = 'text/css'
        elif request.path.endswith('.json'):
            response.headers['Content-Type'] = 'application/json'
        return response

    # Serve static files from client directory with proper routing
    @app.route('/src/<path:filename>')
    def serve_src_files(filename):
        response = send_from_directory('client/src', filename)
        if filename.endswith(('.js', '.ts', '.tsx')):
            response.headers['Content-Type'] = 'application/javascript'
        return response
    
    @app.route('/assets/<path:filename>')
    def serve_assets(filename):
        return send_from_directory('client/src/assets', filename)
    
    # Serve node_modules for development
    @app.route('/node_modules/<path:filename>')
    def serve_node_modules(filename):
        response = send_from_directory('node_modules', filename)
        if filename.endswith('.js'):
            response.headers['Content-Type'] = 'application/javascript'
        return response

    # Serve React app for all non-API routes
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react_app(path):
        # Check if it's an API route or static file route
        if (path.startswith('api/') or path.startswith('src/') or 
            path.startswith('assets/') or path.startswith('node_modules/')):
            return jsonify({'error': 'Endpoint not found'}), 404
            
        # Serve the React index.html for all other routes (SPA routing)
        response = send_from_directory('client', 'index.html')
        response.headers['Content-Type'] = 'text/html'
        return response

    return app