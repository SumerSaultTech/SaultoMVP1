#!/usr/bin/env python3
from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import sys
import json
import subprocess
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
CORS(app)

def create_snowflake_db():
    """Test Snowflake connection and return status"""
    try:
        result = subprocess.run([
            'python3', 'test_snowflake.py'
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0 and "✅ Connected to Snowflake" in result.stdout:
            return {"success": True, "message": "Snowflake connection verified"}
        else:
            return {"success": False, "error": result.stdout + result.stderr}
    except Exception as e:
        return {"success": False, "error": str(e)}

def test_snowflake_connection():
    """Test basic Snowflake connectivity"""
    try:
        result = subprocess.run([
            'python3', 'test_snowflake.py'
        ], capture_output=True, text=True, timeout=30)
        
        return {
            "success": result.returncode == 0,
            "output": result.stdout,
            "error": result.stderr if result.stderr else None
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "snowflake-metrics"})

@app.route('/test-connection', methods=['GET'])
def test_connection():
    result = test_snowflake_connection()
    return jsonify(result)

@app.route('/metrics', methods=['GET'])
def get_metrics():
    time_view = request.args.get('timeView', 'Monthly View')
    
    try:
        # Execute the Snowflake metrics query
        result = subprocess.run([
            'python3', 'snowflake_metrics_query.py', time_view
        ], capture_output=True, text=True, timeout=45)
        
        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                if data.get('success'):
                    return jsonify(data['data'])
                else:
                    return jsonify({"error": data.get('error', 'Unknown error')}), 500
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid JSON response from metrics query"}), 500
        else:
            return jsonify({
                "error": f"Metrics query failed: {result.stderr or result.stdout}"
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Metrics query timed out"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/chart-data', methods=['GET'])
def get_chart_data():
    time_view = request.args.get('timeView', 'Monthly View')
    
    # Generate realistic chart data based on time view
    if time_view == 'Daily View':
        periods = [f"Day {i+1}" for i in range(30)]
        base_values = [4800, 5200, 4900, 5100, 5300, 4700, 5000]
    elif time_view == 'Weekly View':
        periods = [f"Week {i+1}" for i in range(12)]
        base_values = [35000, 38000, 42000, 39000, 41000, 45000]
    elif time_view == 'Yearly View':
        periods = [f"Year {2020 + i}" for i in range(5)]
        base_values = [2800000, 3200000, 4100000, 4800000, 5200000]
    else:  # Monthly View
        periods = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        base_values = [280000, 320000, 310000, 340000, 360000, 380000, 390000, 420000, 440000, 460000, 480000, 500000]
    
    # Generate trend data with some variation
    chart_data = []
    for i, period in enumerate(periods):
        base = base_values[i % len(base_values)]
        variation = base * 0.1 * (0.5 - (i % 10) / 20)  # Add realistic variation
        chart_data.append({
            "name": period,
            "value": int(base + variation)
        })
    
    return jsonify(chart_data)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)