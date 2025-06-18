import os
import logging
from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Enable CORS for development
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# Snowflake configuration
app.config["SNOWFLAKE_ACCOUNT"] = os.environ.get("SNOWFLAKE_ACCOUNT")
app.config["SNOWFLAKE_USER"] = os.environ.get("SNOWFLAKE_USER")
app.config["SNOWFLAKE_PASSWORD"] = os.environ.get("SNOWFLAKE_PASSWORD")
app.config["SNOWFLAKE_WAREHOUSE"] = os.environ.get("SNOWFLAKE_WAREHOUSE")
app.config["SNOWFLAKE_DATABASE"] = os.environ.get("SNOWFLAKE_DATABASE")
app.config["SNOWFLAKE_SCHEMA"] = os.environ.get("SNOWFLAKE_SCHEMA", "PUBLIC")