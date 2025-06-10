#!/usr/bin/env python3
"""
Flask proxy application for Node.js backend
"""
from flask import Flask, request, jsonify, send_from_directory
import subprocess
import os
import threading
import time
import requests
import signal
import atexit

app = Flask(__name__)

# Global variables to track processes
nodejs_process = None
snowflake_process = None

def start_nodejs():
    """Start the Node.js application on port 3001"""
    global nodejs_process
    
    # Set environment variables
    os.environ['NODE_ENV'] = 'development'
    os.environ['GUNICORN_MODE'] = '1'
    
    # Change to the project directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    try:
        # Start the Node.js application on port 3001
        nodejs_process = subprocess.Popen(
            ['npx', 'tsx', 'server/index.ts'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        print(f"Started Node.js application with PID: {nodejs_process.pid}")
        
        # Monitor the process
        for line in iter(nodejs_process.stdout.readline, ''):
            if line:
                print(f"Node.js: {line.strip()}")
        
    except Exception as e:
        print(f"Error starting Node.js app: {e}")

def start_snowflake_service():
    """Start the Snowflake metrics service on port 5001"""
    global snowflake_process
    
    try:
        snowflake_process = subprocess.Popen(
            ['python3', 'snowflake_service.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=dict(os.environ, PORT='5001')
        )
        print(f"Started Snowflake service with PID: {snowflake_process.pid}")
        return snowflake_process
    except Exception as e:
        print(f"Error starting Snowflake service: {e}")
        return None

def cleanup_processes():
    """Clean up all processes on exit"""
    global nodejs_process, snowflake_process
    if nodejs_process:
        nodejs_process.terminate()
        nodejs_process.wait()
    if snowflake_process:
        snowflake_process.terminate()
        snowflake_process.wait()

# Register cleanup function
atexit.register(cleanup_processes)

# Start Node.js in background thread
nodejs_thread = threading.Thread(target=start_nodejs, daemon=True)
nodejs_thread.start()

# Start Snowflake service in background thread
snowflake_thread = threading.Thread(target=start_snowflake_service, daemon=True)
snowflake_thread.start()

# Give services time to start
time.sleep(3)

@app.route('/health')
def health():
    """Health check endpoint"""
    try:
        # Check if Node.js backend is responding
        response = requests.get('http://localhost:3001/api/test', timeout=5)
        if response.status_code == 200:
            return jsonify({'status': 'ok', 'backend': 'connected'})
    except:
        pass
    return jsonify({'status': 'ok', 'backend': 'starting'})

@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy_api(path):
    """Proxy API requests to Node.js backend"""
    try:
        url = f'http://localhost:3001/api/{path}'
        
        # Forward the request to Node.js backend
        if request.method == 'GET':
            resp = requests.get(url, params=request.args, timeout=30)
        elif request.method == 'POST':
            resp = requests.post(url, json=request.get_json(), params=request.args, timeout=30)
        elif request.method == 'PUT':
            resp = requests.put(url, json=request.get_json(), params=request.args, timeout=30)
        elif request.method == 'DELETE':
            resp = requests.delete(url, params=request.args, timeout=30)
        
        # Return the response
        return jsonify(resp.json()), resp.status_code
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Backend service unavailable'}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve frontend files or proxy to Node.js for development"""
    try:
        # Try to proxy to Node.js backend for frontend serving
        url = f'http://localhost:3001/{path}' if path else 'http://localhost:3001/'
        resp = requests.get(url, timeout=10)
        
        # Return the HTML content
        return resp.text, resp.status_code, {'Content-Type': resp.headers.get('Content-Type', 'text/html')}
    except:
        # Fallback to simple message
        return '''
        <!DOCTYPE html>
        <html>
        <head><title>Business Intelligence Platform</title></head>
        <body>
            <h1>Business Intelligence Platform</h1>
            <p>Backend is starting up...</p>
            <script>setTimeout(() => window.location.reload(), 3000);</script>
        </body>
        </html>
        '''

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)