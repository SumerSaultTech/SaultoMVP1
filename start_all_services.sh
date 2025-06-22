#!/bin/bash
# Start all services for SaultoMVP1 in Replit

echo "🚀 Starting SaultoMVP1 Services..."

# Install Python dependencies if needed
echo "📦 Installing Python dependencies..."
pip install -r requirements_connectors.txt > /dev/null 2>&1 || echo "⚠️ Warning: Could not install Python dependencies"

# Function to start service with retry
start_service_with_retry() {
    local name="$1"
    local command="$2"
    local port="$3"
    local max_retries=3
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        echo "🔄 Starting $name (attempt $((retry + 1)))..."
        $command &
        local pid=$!
        
        # Wait a bit for service to start
        sleep 2
        
        # Check if process is still running
        if kill -0 $pid 2>/dev/null; then
            echo "✅ $name started successfully (PID: $pid)"
            return 0
        else
            echo "❌ $name failed to start, retrying..."
            retry=$((retry + 1))
        fi
    done
    
    echo "⚠️ Failed to start $name after $max_retries attempts"
    return 1
}

# Start services with retry logic
echo "🔌 Starting Python Connector Service (port 5002)..."
start_service_with_retry "Python Connector Service" "python start_connector_service.py" "5002"
CONNECTOR_PID=$!

echo "❄️  Starting Snowflake Python Service (port 5001)..."
start_service_with_retry "Snowflake Python Service" "python start_python_service.py" "5001"
SNOWFLAKE_PID=$!

echo "🌐 Starting Node.js Development Server (port 5000)..."
start_service_with_retry "Node.js Development Server" "npm run dev" "5000"
NODE_PID=$!

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Check if services are running
echo "🔍 Checking service status..."

# Check connector service
if curl -s http://localhost:5002/health > /dev/null; then
    echo "✅ Python Connector Service: RUNNING"
else
    echo "❌ Python Connector Service: NOT RUNNING"
fi

# Check if Node.js service is running (we can't easily check without making assumptions)
if ps -p $NODE_PID > /dev/null; then
    echo "✅ Node.js Development Server: RUNNING"
else
    echo "❌ Node.js Development Server: NOT RUNNING"
fi

echo ""
echo "🎉 All services started!"
echo ""
echo "Available endpoints:"
echo "  📊 Main App:           http://localhost:5000"
echo "  🔌 Connector API:      http://localhost:5002"
echo "  ❄️  Snowflake Service: http://localhost:5001"
echo ""
echo "🔧 API Endpoints:"
echo "  GET  /health                              - Health check"
echo "  GET  /connectors/available                - List connectors"
echo "  POST /connectors/create                   - Create connector"
echo "  POST /connectors/{company}/{type}/sync    - Sync data"
echo ""

# Keep script running (trap Ctrl+C to clean up)
trap 'echo "🛑 Stopping services..."; kill $CONNECTOR_PID $SNOWFLAKE_PID $NODE_PID 2>/dev/null; exit' INT

# Wait for any service to exit
wait