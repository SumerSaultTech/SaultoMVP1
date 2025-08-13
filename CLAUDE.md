# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server (frontend + backend on port 5000)
- `npm run build` - Build for production (Vite + esbuild)
- `npm run start` - Start production server from dist/
- `npm run check` - Run TypeScript type checking across codebase
- `npm run db:push` - Push database schema changes to PostgreSQL (use after schema updates)

### Multi-Service Orchestration
- `npm run start:all` - Start all services via shell script (Node.js + Python connectors + Snowflake)
- `npm run start:replit` - Replit-optimized startup with automatic dependency installation
- `npm run start:connectors` - Start Python connector service only (port 5002)
- `npm run start:connectors:quick` - Quick start connector service via Python script
- `npm run start:snowflake` - Start Snowflake Python service only (port 5001)

### Python Services
- `python start_python_service.py` - Start Snowflake query service on port 5001
- `python start_simple_connector_service.py` - Start Python connector API service on port 5002
- `python quick_start_connectors.py` - Fast connector service startup
- `python test_snowflake_connection.py` - Test Snowflake connectivity and credentials
- `python test_jira_connector.py` - Test Jira connector specifically
- `python test_python_connectors.py` - Test all Python connectors

### Service Health & Monitoring
- Visit `/api/health` - Real-time status of all services (Node.js, Snowflake, connectors)
- `curl http://localhost:5001/health` - Check Snowflake Python service
- `curl http://localhost:5002/health` - Check connector Python service

## Architecture

This is a **Business Metrics Dashboard** - a sophisticated multi-service business intelligence platform with AI-powered insights, real-time KPI tracking, and Snowflake data warehouse integration.

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, Wouter routing, Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript (primary application server)
- **Database**: PostgreSQL with Drizzle ORM (application data)
- **Data Warehouse**: Snowflake (analytics data) 
- **Python Services**: Flask services for Snowflake queries and data connectors
- **AI**: Azure OpenAI + OpenAI GPT-4 for chat and business insights
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui with Radix UI primitives
- **Charts**: Recharts for data visualization

### Multi-Service Architecture

The application runs as **3 coordinated services**:

1. **Main Node.js App (Port 5000)**: 
   - Express server with 100+ API endpoints
   - React frontend serving
   - PostgreSQL database operations
   - AI chat and insights
   - Session management and authentication

2. **Snowflake Python Service (Port 5001)**:
   - Handles all Snowflake data warehouse queries
   - Query execution and result processing
   - Schema discovery and table browsing
   - Metric calculations from warehouse data

3. **Python Connector Service (Port 5002)**:
   - Custom data pipeline replacing Airbyte
   - Salesforce, Jira, HubSpot integrations
   - Real-time data sync to Snowflake
   - Connector health monitoring and management

**Service Communication**: Node.js app communicates with Python services via HTTP APIs. Services can run independently with graceful fallback to mock data when Python services are unavailable.

### Service Orchestration Patterns

- **Auto-Startup**: Main Node.js server detects and starts Python services automatically in development
- **Health Monitoring**: `/api/health` endpoint provides real-time status of all services
- **Graceful Degradation**: App continues functioning with reduced features if Python services fail
- **Service Discovery**: Services register and communicate via localhost HTTP endpoints
- **Process Management**: Shell scripts handle multi-service startup and dependency management

## Database Architecture

### PostgreSQL (Application Database)
Uses **Drizzle ORM** with complete TypeScript type safety:

**Core Tables** (`shared/schema.ts`):
- `companies` - Multi-tenant company management with Snowflake database mapping
- `users` - Authentication and role-based access (admin, user, viewer)
- `kpiMetrics` - KPI definitions with goals, categories, formatting, and time periods
- `metricHistory` - Time-series metric values with period tracking and calculations
- `chatMessages` - AI chat conversation storage with company isolation
- `dataSources` - External connector configurations, credentials, and sync status
- `sqlModels` - dbt-style SQL model definitions (stg/int/core layers)
- `pipelineActivities` - System activity logs and data sync monitoring  
- `setupStatus` - Application setup progress and configuration state

### Snowflake Data Warehouse
- **Database**: MIAS_DATA_DB
- **Schema Layers**: RAW → STG → INT → CORE (dbt-style data modeling)
- **Company Isolation**: Each company gets dedicated database schemas
- **Data Flow**: Python connectors → RAW tables → SQL transformations → analytics

### Schema Management Patterns
1. **Schema-First Development**: Define tables in `shared/schema.ts`
2. **Type Generation**: Drizzle generates TypeScript types automatically
3. **Schema Evolution**: Use `npm run db:push` to apply changes (no manual migrations)
4. **Data Access**: All database operations go through `server/storage.ts` interface
5. **Multi-Tenant Isolation**: Company-scoped queries built into storage layer

## Service Architecture

### Node.js Services (`server/services/`)
The application includes **11 specialized services**:

**AI & Analytics Services**:
- `azure-openai.ts` - Azure OpenAI chat integration with streaming responses
- `openai.ts` - OpenAI GPT-4 integration with fallback responses  
- `metrics-ai.ts` - AI-powered KPI suggestions and metric analysis

**Snowflake Integration Services**:
- `snowflake.ts` - Main Snowflake service orchestrator
- `snowflake-python.ts` - Python service communication bridge
- `snowflake-calculator.ts` - Real-time metric calculations from warehouse
- `snowflake-metrics.ts` - KPI-specific Snowflake queries and data processing
- `snowflake-cortex.ts` - Snowflake Cortex AI integration
- `snowflake-schema-discovery.ts` - Automatic schema detection and table browsing

**Data Pipeline Services**:
- `python-connector-service.ts` - Bridge to Python connector system (port 5002)

### Service Communication Patterns
- **HTTP-Based**: All services communicate via REST APIs
- **Error Handling**: Each service includes retry logic and fallback responses
- **Service Discovery**: Services register health endpoints for monitoring
- **Async Operations**: Long-running operations use background processing patterns

### Adding New Services
1. Create service file in `server/services/`
2. Export service object with consistent interface pattern
3. Import and register in `server/routes.ts`
4. Add error handling and health check endpoints
5. Update service documentation

## Python Connector System

### Custom Data Pipeline Architecture
**Replaces Airbyte** with lightweight, Replit-compatible Python services:

**Core Components** (`python_connectors/`):
- `simple_base_connector.py` - Abstract base class for all connectors
- `simple_connector_manager.py` - Orchestrates multiple connectors and sync operations
- `simple_api_service.py` - Flask HTTP API on port 5002
- `snowflake_loader.py` - Direct Snowflake data loading utilities

**Production Connectors**:
- `simple_salesforce_connector.py` - Salesforce REST API integration with real data extraction
- `simple_jira_connector.py` - Jira/Atlassian API integration with issue tracking data

### Connector Development Patterns
1. **Inheritance**: All connectors extend `SimpleBaseConnector`
2. **Standardized Interface**: `extract()`, `transform()`, `load()` methods
3. **Configuration Management**: JSON-based connector configurations
4. **Error Handling**: Built-in retry logic and error reporting
5. **Data Validation**: Schema validation before Snowflake loading

### Connector Workflow
1. **Setup**: `/api/connectors/create` configures new connectors with credentials
2. **Validation**: Python service validates credentials and API connectivity  
3. **Sync**: `/api/connectors/{companyId}/{connectorType}/sync` triggers data extraction
4. **Transform**: Data cleaning and standardization in Python
5. **Load**: Direct insertion to Snowflake RAW schema
6. **Monitor**: Health checks and sync status reporting

### Benefits of Custom System
- **No External Dependencies**: No Airbyte, no pandas/numpy requirements
- **Replit Compatible**: Pure Python with minimal dependencies
- **Direct Control**: Full control over data pipeline and transformations
- **Real Data**: Actual API integrations, not mock data
- **Fast Startup**: Lightweight services with quick initialization

## API Architecture

### Endpoint Organization (100+ Routes)
**Core Patterns** (`server/routes.ts`):

**KPI & Metrics Management**:
- `GET/POST/PUT/DELETE /api/kpi-metrics/*` - CRUD operations for KPI definitions
- `GET /api/dashboard/*` - Dashboard data aggregation and chart data
- `POST /api/metrics/calculate` - Real-time metric calculations

**AI Integration**:
- `POST /api/ai-assistant/*` - AI chat, insights, and suggestions
- `POST /api/ai/suggest-kpis` - Business-type specific KPI recommendations
- `POST /api/ai/generate-sql` - Natural language to SQL conversion

**Data Warehouse**:
- `GET/POST /api/snowflake/*` - Data warehouse queries and schema browsing
- `GET /api/snowflake/tables` - Live table and schema discovery
- `POST /api/snowflake/query` - Execute custom SQL queries

**Data Pipeline**:
- `POST /api/connectors/create` - Configure new data connectors
- `POST /api/connectors/{companyId}/{type}/sync` - Trigger data sync operations
- `GET /api/connectors/{companyId}` - List configured connectors with status

**Multi-Tenant Management**:
- `GET/POST /api/companies/*` - Company CRUD and configuration
- `GET /api/users/*` - User management with role-based access
- `GET /api/setup-status` - Application setup progress tracking

### Authentication & Session Management
- **Session-based Authentication**: Express sessions with PostgreSQL store
- **Company Context**: Users select company after login, company ID scoped to all operations
- **Role-Based Access**: Admin, user, viewer roles with endpoint-level permissions
- **API Security**: Input validation with Zod schemas, SQL injection prevention

### File Upload System
- **Upload Handling**: Multer with 16MB limit, 25+ allowed file types
- **File Processing**: Text files parsed for AI chat context, binary files referenced by name
- **Storage**: Local filesystem with `uploads/` directory

## Development Patterns

### Database Development Workflow
1. **Schema Updates**: Modify `shared/schema.ts` table definitions
2. **Type Regeneration**: Drizzle automatically generates TypeScript types  
3. **Database Sync**: Run `npm run db:push` to apply schema changes to PostgreSQL
4. **Storage Layer**: Update `server/storage.ts` with new data access methods
5. **API Integration**: Add new endpoints in `server/routes.ts` using storage methods

### Multi-Service Development
1. **Local Development**: Use `npm run dev` for hot reloading of Node.js app
2. **Python Services**: Start Python services separately for debugging
3. **Service Health**: Monitor `/api/health` for service status during development
4. **Error Handling**: Check both Node.js logs and Python service logs
5. **Database State**: Use `npm run db:push` after schema changes

### Frontend Development Patterns  
- **Component Architecture**: shadcn/ui components with Tailwind CSS styling
- **Data Fetching**: TanStack React Query with automatic caching and invalidation
- **Routing**: Wouter for client-side navigation with TypeScript route definitions
- **State Management**: React Query for server state, React hooks for local state
- **Form Handling**: React Hook Form with Zod validation schemas

### Chart Development Guidelines
- **Library**: Recharts for all data visualizations
- **Data Consistency**: Chart data must exactly match displayed metric values
- **Progressive Loading**: Implement lazy loading for large datasets
- **Responsive Design**: Charts adapt to mobile, tablet, and desktop viewports
- **Time Periods**: Support Weekly, Monthly, Quarterly, YTD views with proper data aggregation

### Service Integration Patterns
- **Python Communication**: HTTP requests to Python services with error handling
- **Fallback Responses**: Mock data when Python services unavailable
- **Async Operations**: Background processing for long-running data operations
- **Health Monitoring**: Regular health checks for service availability

## Environment Setup

### Required Environment Variables
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/database

# AI Services  
OPENAI_API_KEY=sk-...
AZURE_OPENAI_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/

# Snowflake Data Warehouse
SNOWFLAKE_ACCOUNT=your-account
SNOWFLAKE_USER=your-user
SNOWFLAKE_ACCESS_TOKEN=your-token
SNOWFLAKE_WAREHOUSE=your-warehouse
SNOWFLAKE_DATABASE=MIAS_DATA_DB
SNOWFLAKE_SCHEMA=CORE

# Application
SESSION_SECRET=your-secret-key
WORKSPACE_ID=your-workspace-id
```

### Service Dependencies
- **Node.js 18+** - Main application runtime
- **Python 3.8+** - Python services (Flask, Snowflake SDK)
- **PostgreSQL** - Application database
- **Snowflake Account** - Data warehouse (optional, has fallback)

### Development Setup
1. Clone repository and run `npm install`
2. Create `.env` file with required variables (see `.env.example`)
3. Ensure PostgreSQL is running and accessible
4. Run `npm run db:push` to initialize database schema
5. Start development with `npm run dev` (auto-starts Python services)
6. Visit `http://localhost:5000` - app should be running with all services

## File Upload System

The application supports comprehensive file uploads through multer:
- **Upload Directory**: `uploads/` (auto-created)
- **File Size Limit**: 16MB maximum
- **Allowed Extensions**: txt, pdf, png, jpg, jpeg, gif, doc, docx, xls, xlsx, ppt, pptx, csv, json, zip, py, js, html, css, c, cpp, h, java, rb, php, xml, md
- **File Processing**: Text files read and included in AI chat context, binary files referenced by name only
- **Security**: Extension validation and file size limits enforced