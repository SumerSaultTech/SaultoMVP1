#!/usr/bin/env python3
"""
Quick start script for Python connector service only.
Use this to test connector functionality without starting all services.
"""

import subprocess
import sys
import os
import time
import requests

def install_dependencies():
    """Install Python dependencies if needed"""
    print("📦 Installing Python dependencies...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements_connectors.txt"], 
                      check=True, capture_output=True)
        print("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False
    except FileNotFoundError:
        print("⚠️  requirements_connectors.txt not found, continuing anyway...")
        return True

def start_connector_service():
    """Start the Python connector service"""
    print("🚀 Starting Python Connector Service on port 5002...")
    
    try:
        # Start the service
        process = subprocess.Popen([sys.executable, "start_connector_service.py"])
        
        # Wait a bit for service to start
        print("⏳ Waiting for service to start...")
        time.sleep(3)
        
        # Check if service is running
        try:
            response = requests.get("http://localhost:5002/health", timeout=5)
            if response.status_code == 200:
                print("✅ Python Connector Service is running!")
                print("🔗 Health check: http://localhost:5002/health")
                print("📋 Available connectors: http://localhost:5002/connectors/available")
                print("")
                print("🎯 The service is now ready to handle connector requests!")
                print("   You can now create connectors through your app's setup page.")
                print("")
                print("🛑 Press Ctrl+C to stop the service")
                
                # Keep the service running
                try:
                    process.wait()
                except KeyboardInterrupt:
                    print("\n🛑 Stopping Python Connector Service...")
                    process.terminate()
                    process.wait()
                    print("✅ Service stopped")
                    
                return True
            else:
                print(f"❌ Service health check failed: {response.status_code}")
                process.terminate()
                return False
                
        except requests.exceptions.ConnectionError:
            print("❌ Could not connect to service on port 5002")
            print("   Make sure no other service is using this port")
            process.terminate()
            return False
            
    except Exception as e:
        print(f"❌ Failed to start service: {e}")
        return False

def main():
    """Main function"""
    print("=" * 60)
    print("🔌 PYTHON CONNECTOR SERVICE - QUICK START")
    print("=" * 60)
    print("")
    
    # Install dependencies
    if not install_dependencies():
        print("❌ Setup failed - could not install dependencies")
        return 1
    
    print("")
    
    # Start service
    if start_connector_service():
        return 0
    else:
        print("❌ Failed to start Python Connector Service")
        print("")
        print("💡 Troubleshooting:")
        print("   1. Make sure port 5002 is not in use")
        print("   2. Check that Python dependencies are installed")
        print("   3. Verify start_connector_service.py exists")
        print("   4. Check console for error messages")
        return 1

if __name__ == '__main__':
    exit(main())