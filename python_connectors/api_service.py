"""
Flask API service for managing Python connectors.
This service runs on port 5002 and provides HTTP endpoints for connector management.
"""

from flask import Flask, request, jsonify
import logging
import json
from datetime import datetime
from .connector_manager import connector_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.utcnow().isoformat()})

@app.route('/connectors/available', methods=['GET']) 
def get_available_connectors():
    """Get list of available connector types"""
    try:
        connectors = []
        for connector_type in connector_manager.get_available_connectors():
            requirements = connector_manager.get_connector_requirements(connector_type)
            connectors.append(requirements)
        
        return jsonify({
            "success": True,
            "connectors": connectors
        })
    except Exception as e:
        logger.error(f"Error getting available connectors: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/connectors/create', methods=['POST'])
def create_connector():
    """Create a new connector"""
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['company_id', 'connector_type', 'credentials']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        company_id = data['company_id']
        connector_type = data['connector_type']
        credentials = data['credentials']
        config = data.get('config', {})
        
        # Create connector
        success, message = connector_manager.create_connector(
            connector_type, company_id, credentials, config
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message
            })
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
            
    except Exception as e:
        logger.error(f"Error creating connector: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/connectors/<int:company_id>/<connector_type>/test', methods=['POST'])
def test_connector(company_id, connector_type):
    """Test a connector connection"""
    try:
        success, message = connector_manager.test_connector(company_id, connector_type)
        
        return jsonify({
            "success": success,
            "message": message
        })
        
    except Exception as e:
        logger.error(f"Error testing connector: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/connectors/<int:company_id>/<connector_type>/tables', methods=['GET'])
def get_connector_tables(company_id, connector_type):
    """Get available tables for a connector"""
    try:
        success, tables, error = connector_manager.get_connector_tables(company_id, connector_type)
        
        if success:
            return jsonify({
                "success": True,
                "tables": tables
            })
        else:
            return jsonify({
                "success": False,
                "error": error
            }), 400
            
    except Exception as e:
        logger.error(f"Error getting connector tables: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/connectors/<int:company_id>/<connector_type>/sync', methods=['POST'])
def sync_connector(company_id, connector_type):
    """Sync data for a connector"""
    try:
        data = request.json or {}
        tables = data.get('tables')  # Optional: specific tables to sync
        
        result = connector_manager.sync_connector(company_id, connector_type, tables)
        
        return jsonify({
            "success": result.success,
            "records_synced": result.records_synced,
            "tables_synced": result.tables_synced,
            "error_message": result.error_message,
            "start_time": result.start_time.isoformat() if result.start_time else None,
            "end_time": result.end_time.isoformat() if result.end_time else None,
            "duration_seconds": (
                (result.end_time - result.start_time).total_seconds() 
                if result.start_time and result.end_time else None
            )
        })
        
    except Exception as e:
        logger.error(f"Error syncing connector: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/connectors/<int:company_id>/<connector_type>/status', methods=['GET'])
def get_connector_status(company_id, connector_type):
    """Get status of a connector"""
    try:
        status = connector_manager.get_connector_status(company_id, connector_type)
        return jsonify(status)
        
    except Exception as e:
        logger.error(f"Error getting connector status: {str(e)}")
        return jsonify({
            "exists": False,
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/connectors/<int:company_id>/<connector_type>', methods=['DELETE'])
def remove_connector(company_id, connector_type):
    """Remove a connector"""
    try:
        success = connector_manager.remove_connector(company_id, connector_type)
        
        if success:
            return jsonify({
                "success": True,
                "message": "Connector removed successfully"
            })
        else:
            return jsonify({
                "success": False,
                "error": "Connector not found"
            }), 404
            
    except Exception as e:
        logger.error(f"Error removing connector: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/connectors/<int:company_id>/sync-all', methods=['POST'])
def sync_all_connectors(company_id):
    """Sync all connectors for a company"""
    try:
        results = connector_manager.sync_all_connectors(company_id)
        
        # Convert results to JSON-serializable format
        serialized_results = {}
        for connector_type, result in results.items():
            serialized_results[connector_type] = {
                "success": result.success,
                "records_synced": result.records_synced,
                "tables_synced": result.tables_synced,
                "error_message": result.error_message,
                "start_time": result.start_time.isoformat() if result.start_time else None,
                "end_time": result.end_time.isoformat() if result.end_time else None,
                "duration_seconds": (
                    (result.end_time - result.start_time).total_seconds() 
                    if result.start_time and result.end_time else None
                )
            }
        
        return jsonify({
            "success": True,
            "results": serialized_results
        })
        
    except Exception as e:
        logger.error(f"Error syncing all connectors: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    port = 5002
    logger.info(f"Starting Python Connector API service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)