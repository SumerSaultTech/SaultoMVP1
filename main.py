#!/usr/bin/env python3
"""
Flask app wrapper to start the Node.js application
"""
from flask import Flask
import subprocess
import os
import threading

# Create a simple Flask app that gunicorn can import
app = Flask(__name__)

@app.route('/health')
def health():
    return {'status': 'ok', 'message': 'Node.js app is running via Flask wrapper'}

def start_nodejs():
    """Start the Node.js application in a separate thread"""
    os.environ['NODE_ENV'] = 'development'
    
    # Change to the project directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    try:
        # Start the Node.js application
        subprocess.run(['npx', 'tsx', 'server/index.ts'], check=True)
    except Exception as e:
        print(f"Error starting Node.js app: {e}")

# Start Node.js app in background when this module is imported
nodejs_thread = threading.Thread(target=start_nodejs, daemon=True)
nodejs_thread.start()