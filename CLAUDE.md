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
- `npm run start:all` - Start all services via shell script (Node.js + Python connectors)
- `npm run start:replit` - Replit-optimized startup with automatic dependency installation
- `npm run start:connectors` - Start Python connector service only (port 5002)
- `npm run start:connectors:quick` - Quick start connector service via Python script

### Python Services
- `python start_simple_connector_service.py` - Start Python connector API service on port 5002
- `python quick_start_connectors.py` - Fast connector service startup
- `python test_jira_connector.py` - Test Jira connector specifically
- `python test_python_connectors.py` - Test all Python connectors

### Service Health & Monitoring
- Visit `/api/health` - Real-time status of all services (Node.js, connectors)
- `curl http://localhost:5002/health` - Check connector Python service

## Architecture

This is a **Business Metrics Dashboard** - a sophisticated multi-service business intelligence platform with AI-powered insights, real-time KPI tracking, and PostgreSQL analytics integration.

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, Wouter routing, Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript (primary application server)
- **Database**: PostgreSQL with Drizzle ORM (application data + analytics schemas)
- **Python Services**: Flask service for data connectors
- **AI**: Azure OpenAI + OpenAI GPT-4 for chat and business insights
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui with Radix UI primitives
- **Charts**: Recharts for data visualization

### Multi-Service Architecture

The application runs as **2 coordinated services**:

1. **Main Node.js App (Port 5000)**: 
   - Express server with 100+ API endpoints
   - React frontend serving
   - PostgreSQL database operations (application + analytics data)
   - AI chat and insights
   - Session management and authentication

2. **Python Connector Service (Port 5002)**:
   - Custom data pipeline replacing Airbyte
   - Salesforce, Jira, HubSpot integrations
   - Real-time data sync to PostgreSQL analytics schemas
   - Connector health monitoring and management

**Service Communication**: Node.js app communicates with Python connector service via HTTP APIs. The service can run independently with graceful fallback to mock data when Python service is unavailable.

### Service Orchestration Patterns

- **Auto-Startup**: Main Node.js server detects and starts Python services automatically in development
- **Health Monitoring**: `/api/health` endpoint provides real-time status of all services
- **Graceful Degradation**: App continues functioning with reduced features if Python services fail
- **Service Discovery**: Services register and communicate via localhost HTTP endpoints
- **Process Management**: Shell scripts handle multi-service startup and dependency management

## Database Architecture

### PostgreSQL (Unified Database)
Uses **Drizzle ORM** with complete TypeScript type safety for application data, and company-specific analytics schemas for warehouse data:

**Application Tables** (`shared/schema.ts` in `public` schema):
- `companies` - Multi-tenant company management
- `users` - Authentication and role-based access (admin, user, viewer)
- `kpiMetrics` - KPI definitions with goals, categories, formatting, and time periods
- `metricHistory` - Time-series metric values with period tracking and calculations
- `chatMessages` - AI chat conversation storage with company isolation
- `dataSources` - External connector configurations, credentials, and sync status
- `sqlModels` - dbt-style SQL model definitions (stg/int/core layers)
- `pipelineActivities` - System activity logs and data sync monitoring  
- `setupStatus` - Application setup progress and configuration state

**Analytics Schemas** (per company: `analytics_company_{id}`):
- **Schema Layers**: RAW → STG → INT → CORE (dbt-style data modeling)
- **Company Isolation**: Each company gets dedicated analytics schema
- **Data Flow**: Python connectors → Company analytics schema → SQL transformations → metrics

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

**PostgreSQL Analytics Services**:
- `postgres-analytics.ts` - PostgreSQL analytics service with time-period-aware queries and real-time metric calculations

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

## Time Period Switching Architecture

### Metrics Calculation Logic
**Critical Pattern**: Both North Star Metrics and Business Metrics must use identical calculation logic:

**Time Period Calculations**:
- **Daily**: `(yearlyValue / 365) * performanceMultiplier`
- **Weekly**: `(yearlyValue / 52) * performanceMultiplier`  
- **Monthly**: `(yearlyValue / 12) * performanceMultiplier`
- **Quarterly**: `(yearlyValue / 4) * performanceMultiplier`
- **Yearly/YTD**: `yearlyValue` (no division)

**Performance Multipliers**: Each metric has realistic business variations by time period (e.g., daily revenue might be 1.1x expected, weekly profit might be 0.8x expected)

**Backend SQL Templates**: PostgreSQL queries filter by time period:
- Daily: `DATE(date_column) = CURRENT_DATE`
- Weekly: `DATE_TRUNC('week', date_column) = DATE_TRUNC('week', CURRENT_DATE)`
- Monthly: Current month and year filters
- Quarterly: Current quarter and year filters

### Consistency Requirements
1. **Same Calculation Functions**: Both metric sections use identical division logic
2. **Same Performance Multipliers**: Identical realistic business variations
3. **Same Formatting Functions**: Use `formatActualValue()` for current values
4. **Backend Coordination**: API returns period-specific data based on `timePeriod` parameter

## Python Connector System

### Custom Data Pipeline Architecture
**Replaces Airbyte** with lightweight, Replit-compatible Python services:

**Core Components** (`python_connectors/`):
- `simple_base_connector.py` - Abstract base class for all connectors
- `simple_connector_manager.py` - Orchestrates multiple connectors and sync operations
- `simple_api_service.py` - Flask HTTP API on port 5002
- `postgres_loader.py` - Direct PostgreSQL data loading utilities

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
5. **Load**: Direct insertion to PostgreSQL analytics schemas
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
- `GET/POST /api/postgres/*` - PostgreSQL analytics queries and schema browsing
- `GET /api/postgres/tables` - Live table and schema discovery from analytics schemas
- `POST /api/postgres/query` - Execute custom SQL queries against PostgreSQL

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

### Time Period Development Guidelines
When adding new time period functionality:
1. **Backend**: Add time period case to `getTimeFilter()` in `postgres-analytics.ts`
2. **Business Metrics**: Add case to `getAdaptiveActual()`, `getAdaptiveGoal()`, `getAdaptiveProgress()` 
3. **North Star Metrics**: Add case to `getPeriodCurrentValue()`, `getPeriodGoal()`, `getTimePeriodDisplayName()`
4. **Performance Multipliers**: Add realistic business variations for the new time period
5. **Testing**: Verify both metric sections show identical values when switching periods

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
- **Time Periods**: Support Daily, Weekly, Monthly, Quarterly, YTD views with proper data aggregation

### Service Integration Patterns
- **Python Communication**: HTTP requests to Python services with error handling
- **Fallback Responses**: Mock data when Python services unavailable
- **Async Operations**: Background processing for long-running data operations
- **Health Monitoring**: Regular health checks for service availability

## Environment Setup

### Required Environment Variables
```env
# Database (PostgreSQL for both application and analytics data)
DATABASE_URL=postgresql://username:password@localhost:5432/database

# AI Services  
OPENAI_API_KEY=sk-...
AZURE_OPENAI_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/

# Application
SESSION_SECRET=your-secret-key
WORKSPACE_ID=your-workspace-id
```

### Service Dependencies
- **Node.js 18+** - Main application runtime
- **Python 3.8+** - Python connector services (Flask, psycopg2)
- **PostgreSQL** - Unified database for application and analytics data

### Development Setup
1. Clone repository and run `npm install`
2. Create `.env` file with required variables (see `.env.example`)
3. Ensure PostgreSQL is running and accessible
4. Run `npm run db:push` to initialize database schema
5. Start development with `npm run dev` (auto-starts Python services)
6. Visit `http://localhost:5000` - app should be running with all services

## UI Design & Color Theming

**IMPORTANT: All new features must follow the consistent GREEN color theme.**

### Primary Color Palette (Saulto Brand Colors)
- **Primary Buttons**: Use default `<Button>` component (no custom className needed)
- **Primary Icons**: `text-primary` or `text-primary-600` (primary icons)
- **Light Green**: `bg-green-50 text-green-700 border-green-200` (backgrounds, badges)
- **Success States**: `bg-green-100 text-green-800` (success badges, indicators)
- **Secondary Icons**: `text-green-500` (secondary icons)

### Secondary Colors (Use Sparingly)
- **Admin/Warning**: `bg-red-100 text-red-800` (admin roles, warnings)
- **Status/Pending**: `bg-yellow-100 text-yellow-800` (pending states)
- **Neutral**: `bg-gray-100 text-gray-800` (disabled, neutral states)

### ❌ Avoid These Colors
- **NO BLUE**: Never use `bg-blue-*`, `text-blue-*`, `border-blue-*` for new features
- **Consistency Rule**: All buttons, icons, and interactive elements should use green theme

### Examples
```tsx
// ✅ Correct - Default button styling (uses Saulto brand colors)
<Button>Save</Button>
<Button className="flex items-center gap-2">
  <Plus className="h-4 w-4" />
  Add User
</Button>
<Mail className="text-primary" />
<Badge className="bg-green-50 text-green-700 border-green-200">Active</Badge>

// ❌ Incorrect - Custom primary colors (too dark)
<Button className="bg-primary-500 hover:bg-primary-600">Save</Button>

// ❌ Incorrect - Blue theme
<Button className="bg-blue-600 hover:bg-blue-700">Save</Button>
<Mail className="text-blue-600" />
<Badge className="bg-blue-50 text-blue-700 border-blue-200">Active</Badge>

// ❌ Incorrect - Generic green
<Button className="bg-green-600 hover:bg-green-700">Save</Button>
```

## File Upload System

The application supports comprehensive file uploads through multer:
- **Upload Directory**: `uploads/` (auto-created)
- **File Size Limit**: 16MB maximum
- **Allowed Extensions**: txt, pdf, png, jpg, jpeg, gif, doc, docx, xls, xlsx, ppt, pptx, csv, json, zip, py, js, html, css, c, cpp, h, java, rb, php, xml, md
- **File Processing**: Text files read and included in AI chat context, binary files referenced by name only
- **Security**: Extension validation and file size limits enforced