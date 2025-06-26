# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server (frontend + backend on port 5000)
- `npm run build` - Build for production  
- `npm run start` - Start production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema changes to PostgreSQL

### Python Services
- `python start_python_service.py` - Start Snowflake service on port 5001
- `python test_snowflake_connection.py` - Test Snowflake connectivity
- `python snowflake_service.py` - Direct Snowflake service (called by start_python_service.py)

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
- `companies` - Multi-tenant company management with Snowflake database mapping
- `users` - Authentication and roles (admin, user, viewer)
- `kpiMetrics` - Core KPI definitions with goals, categories, and formatting
- `metricHistory` - Time-series metric values with period tracking
- `chatMessages` - AI chat conversation storage
- `dataSources` - External data connector configurations and sync status
- `sqlModels` - SQL model definitions with layer organization (stg/int/core)
- `pipelineActivities` - System activity logs and monitoring
- `setupStatus` - Application setup and configuration tracking

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
SNOWFLAKE_WAREHOUSE=...
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

This codebase uses **TypeScript for application logic** and **Python for Snowflake operations**:
- TypeScript handles web server, API, frontend, and business logic
- Python services (port 5001) handle Snowflake queries and data processing
- Communication between services via HTTP APIs

## Testing

No specific test framework is configured. Check for test patterns in the codebase before adding tests.

## AI Integration

- **Azure OpenAI**: Primary chat interface integrated into dashboard  
- **OpenAI GPT-4**: Business insights and KPI suggestions
- **Context-aware**: AI understands company data schema and business model
- **Fallback handling**: Graceful degradation when AI services unavailable

## File Upload System

The application supports file uploads through multer with the following specifications:
- **Upload Directory**: `uploads/`
- **File Size Limit**: 16MB
- **Allowed Extensions**: txt, pdf, png, jpg, jpeg, gif, doc, docx, xls, xlsx, ppt, pptx, csv, json, zip, py, js, html, css, c, cpp, h, java, rb, php, xml, md
- **File Processing**: Text files are read and included in chat context, binary files are referenced by name