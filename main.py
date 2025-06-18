from app import app
from routes import register_routes

# Register all routes
register_routes(app)

# Initialize Snowflake tables if credentials are available
try:
    import os
    if all(os.environ.get(var) for var in ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD']):
        from snowflake_service import snowflake_service
        snowflake_service.create_tables_if_not_exist()
        print("Snowflake tables initialized successfully")
    else:
        print("Snowflake credentials not configured - using in-memory storage for development")
except Exception as e:
    print(f"Snowflake initialization failed: {e}")
    print("Continuing with in-memory storage for development")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)