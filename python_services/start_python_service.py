#!/usr/bin/env python3
import subprocess
import sys
import os
import time
import signal

def start_snowflake_service():
    """Start the Snowflake metrics service on port 5001"""
    try:
        print("Starting Snowflake metrics service on port 5001...")
        process = subprocess.Popen([
            sys.executable, 'snowflake_service.py'
        ], env=dict(os.environ, PORT='5001'))
        
        # Give it a moment to start
        time.sleep(2)
        
        print(f"Snowflake service started with PID: {process.pid}")
        return process
        
    except Exception as e:
        print(f"Failed to start Snowflake service: {e}")
        return None

if __name__ == "__main__":
    service = start_snowflake_service()
    if service:
        try:
            # Keep the service running
            service.wait()
        except KeyboardInterrupt:
            print("Shutting down Snowflake service...")
            service.terminate()
            service.wait()