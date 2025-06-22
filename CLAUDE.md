# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server (frontend + backend on port 5000)
- `npm run start:all` - Start all services (Node.js + Python connectors + Snowflake)
- `npm run start:connectors` - Start Python connector service only (port 5002)
- `npm run start:snowflake` - Start Snowflake Python service only (port 5001)
- `npm run build` - Build for production  
- `npm run start` - Start production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema changes to PostgreSQL

### Python Services
- `python start_python_service.py` - Start Snowflake service on port 5001
- `python start_connector_service.py` - Start Python connector API service on port 5002
- `python test_snowflake_connection.py` - Test Snowflake connectivity
- `python test_python_connectors.py` - Test Python connector system
- `python test_jira_connector.py` - Test Jira connector specifically

### Replit Setup
For Replit deployment, the app is configured to auto-start all services:
1. **Automatic Startup**: The `.replit` file is configured to start all services in parallel
2. **Manual Start**: Use `npm run start:all` or `./start_all_services.sh` 
3. **Service Ports**: 5000 (main app), 5001 (Snowflake), 5002 (connectors)
4. **Graceful Fallback**: If Python services aren't running, connectors fall back to mock mode

## Architecture

This is a **Business Metrics Dashboard** - a full-stack business intelligence platform with AI-powered insights and Snowflake data warehouse integration.

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, Wouter routing, Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Data Warehouse**: Snowflake with Python bridge services
- **AI**: Azure OpenAI + OpenAI GPT-4 for chat and insights
- **State**: TanStack React Query for server state

### Project Structure
```
client/src/
├── components/          # UI components
│   ├── dashboard/       # Dashboard-specific components  
│   ├── layout/          # Sidebar, header components
│   ├── assistant/       # AI chat interface
│   └── ui/              # shadcn/ui base components
├── pages/               # Route components
└── lib/                 # API client and utilities

server/
├── services/            # Business logic (18 services)
│   ├── azure-openai.ts  # Azure OpenAI chat integration
│   ├── snowflake-calculator.ts  # Real-time metrics
│   ├── metrics-ai.ts    # AI metric suggestions
│   └── [15 others]      # Various integrations
├── routes.ts            # 100+ API endpoints
├── storage.ts           # Data access layer
└── index.ts             # Server entry point

shared/schema.ts         # Drizzle database schema
sql/                     # SQL transformations (core/int/stg)
```

### Database Schema (PostgreSQL)
Key tables in `shared/schema.ts`:
- `companies` - Multi-tenant company management
- `users` - Authentication and roles  
- `kpiMetrics` - Core KPI definitions and calculations
- `metricHistory` - Historical metric values
- `chatMessages` - AI chat conversation storage
- `dataSources` - External data connector configurations

### Snowflake Data Warehouse
- Database: MIAS_DATA_DB
- Schemas: CORE, STG, INT, RAW (dbt-style layering)
- Python bridge services for Snowflake queries

## Key Features

1. **Real-time KPI Dashboard** - North Star metrics (revenue/profit) with 9-12 customizable KPIs
2. **AI Chat Assistant** - Integrated Azure OpenAI chat for business insights
3. **Snowflake Integration** - Live data warehouse queries and table browsing
4. **Multi-tenant Architecture** - Company isolation with role-based access
5. **Progressive Charts** - Recharts visualizations with time period views

## API Architecture

### Core Endpoint Patterns
- `/api/kpi-metrics/*` - KPI management and calculations
- `/api/dashboard/*` - Dashboard data and visualizations
- `/api/snowflake/*` - Data warehouse queries and browsing
- `/api/ai-assistant/*` - AI chat and insights
- `/api/companies/*` - Multi-tenant management

### Authentication
Session-based auth with PostgreSQL storage. Users select company after login.

## Environment Variables
Required in `.env`:
```
DATABASE_URL=postgresql://...
AZURE_OPENAI_KEY=...
AZURE_OPENAI_ENDPOINT=...  
OPENAI_API_KEY=...
SNOWFLAKE_ACCOUNT=...
SNOWFLAKE_USER=...
SNOWFLAKE_PASSWORD=...
SESSION_SECRET=...
```

## Development Patterns

### Database Changes
1. Update `shared/schema.ts` with new tables/columns
2. Run `npm run db:push` to apply changes
3. Update `server/storage.ts` data access layer
4. Never write manual SQL migrations - use Drizzle schema

### Component Development
- Use shadcn/ui components for UI consistency
- Follow existing TanStack Query patterns for data fetching
- Maintain responsive design with Tailwind CSS
- Keep TypeScript strict for type safety

### Adding New Services
Services in `server/services/` handle specific business logic:
- External API integrations (Salesforce, HubSpot, QuickBooks)
- AI functionality (Azure OpenAI, OpenAI GPT-4)
- Data processing (Snowflake calculations, transformations)

### Chart Development
- Use Recharts library for all visualizations
- Ensure chart data matches displayed values exactly
- Implement progressive data loading for performance
- Support all time periods: Weekly, Monthly, Quarterly, YTD

## Multi-Language Architecture

This codebase uses **TypeScript for application logic** and **Python for data operations**:
- TypeScript handles web server, API, frontend, and business logic
- Python services handle Snowflake queries and data processing:
  - **Port 5001**: Snowflake query service
  - **Port 5002**: API connector service (Salesforce, HubSpot, etc.)
- Communication between services via HTTP APIs

### Python Connector System
Custom Python-based data pipeline replacing Airbyte:
- **Base Connector Class**: `python_connectors/base_connector.py` - Abstract base for all connectors
- **Salesforce Connector**: `python_connectors/salesforce_connector.py` - Salesforce REST API integration  
- **HubSpot Connector**: `python_connectors/hubspot_connector.py` - HubSpot CRM API integration
- **Jira Connector**: `python_connectors/jira_connector.py` - Jira/Atlassian API integration
- **Connector Manager**: `python_connectors/connector_manager.py` - Orchestrates multiple connectors
- **API Service**: `python_connectors/api_service.py` - Flask HTTP API on port 5002
- **TypeScript Bridge**: `server/services/python-connector-service.ts` - Interfaces with Python API

## Testing

No specific test framework is configured. Check for test patterns in the codebase before adding tests.

## AI Integration

- **Azure OpenAI**: Primary chat interface integrated into dashboard  
- **OpenAI GPT-4**: Business insights and KPI suggestions
- **Context-aware**: AI understands company data schema and business model
- **Fallback handling**: Graceful degradation when AI services unavailable