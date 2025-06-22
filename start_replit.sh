#!/bin/bash
# Replit-optimized startup script for SaultoMVP1

echo "🚀 Starting SaultoMVP1 for Replit..."

# Function to check if port is in use
port_in_use() {
    lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
}

# Function to start service if not already running
start_if_not_running() {
    local service_name="$1"
    local command="$2"
    local port="$3"
    
    if port_in_use $port; then
        echo "✅ $service_name already running on port $port"
        return 0
    fi
    
    echo "🔄 Starting $service_name on port $port..."
    $command &
    
    # Wait and check if it started
    sleep 3
    if port_in_use $port; then
        echo "✅ $service_name started successfully"
        return 0
    else
        echo "⚠️ $service_name may have failed to start"
        return 1
    fi
}

# Install Python dependencies quietly
echo "📦 Installing Python dependencies..."
pip install -q -r requirements_connectors.txt 2>/dev/null || echo "⚠️ Warning: Python dependencies install failed (may not be critical)"

# Start Python Connector Service first (most important for your use case)
start_if_not_running "Python Connector Service" "python start_connector_service.py" "5002"

# Start Snowflake Python Service
start_if_not_running "Snowflake Python Service" "python start_python_service.py" "5001"

# Start main Node.js app last
echo "🌐 Starting main Node.js application..."
if port_in_use 5000; then
    echo "⚠️ Port 5000 already in use, killing existing process..."
    pkill -f "tsx server/index.ts" 2>/dev/null || true
    sleep 2
fi

npm run dev &
NODE_PID=$!

# Final status check
echo ""
echo "🔍 Final Service Status Check:"
sleep 5

if port_in_use 5002; then
    echo "✅ Python Connector Service: RUNNING (port 5002)"
else
    echo "❌ Python Connector Service: NOT RUNNING"
fi

if port_in_use 5001; then
    echo "✅ Snowflake Python Service: RUNNING (port 5001)"
else
    echo "❌ Snowflake Python Service: NOT RUNNING"
fi

if port_in_use 5000; then
    echo "✅ Main Node.js App: RUNNING (port 5000)"
else
    echo "❌ Main Node.js App: NOT RUNNING"
fi

echo ""
echo "🎉 Startup complete!"
echo "📊 Visit your app and check /api/health for detailed status"
echo ""
echo "💡 If Python Connector Service isn't running:"
echo "   - Open a new Shell tab in Replit"
echo "   - Run: python start_connector_service.py"
echo ""

# Keep main process running
echo "🔒 Keeping services running... (Press Ctrl+C to stop)"
trap 'echo "🛑 Stopping all services..."; kill $NODE_PID 2>/dev/null; pkill -f "python start_" 2>/dev/null; exit' INT

# Wait for main Node.js process
wait $NODE_PID