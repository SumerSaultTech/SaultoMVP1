#!/usr/bin/env python3
"""
Start the Python Connector API service.
This script starts the Flask API on port 5002 for managing data connectors.
"""

import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import and run the API service
from python_connectors.api_service import app
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == '__main__':
    port = 5002
    logger.info(f"Starting Python Connector API service on port {port}")
    logger.info("Available endpoints:")
    logger.info("  GET  /health - Health check")
    logger.info("  GET  /connectors/available - List available connectors")
    logger.info("  POST /connectors/create - Create a new connector")
    logger.info("  POST /connectors/<company_id>/<type>/test - Test connection")
    logger.info("  GET  /connectors/<company_id>/<type>/tables - Get available tables")
    logger.info("  POST /connectors/<company_id>/<type>/sync - Sync data")
    logger.info("  GET  /connectors/<company_id>/<type>/status - Get status")
    logger.info("  DELETE /connectors/<company_id>/<type> - Remove connector")
    logger.info("  POST /connectors/<company_id>/sync-all - Sync all connectors")
    
    app.run(host='0.0.0.0', port=port, debug=False)