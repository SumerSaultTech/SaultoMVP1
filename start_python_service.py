#!/usr/bin/env python3
import subprocess
import sys
import os

# Set environment variables from the current environment
env = os.environ.copy()

# Start the Python Snowflake service
try:
    print("🚀 Starting Python Snowflake service on port 5001...")
    subprocess.run([sys.executable, "snowflake_service.py"], env=env)
except KeyboardInterrupt:
    print("\n🛑 Python service stopped")
except Exception as e:
    print(f"❌ Error starting Python service: {e}")