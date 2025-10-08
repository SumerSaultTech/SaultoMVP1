# Business Metrics Dashboard

A comprehensive business intelligence platform for tracking and visualizing key performance indicators (KPIs) with AI-powered insights and Snowflake cloud data warehouse integration.

## 🎯 Overview

This application provides a modern, responsive dashboard for businesses to:
- Track North Star metrics (Annual Revenue & Profit) with real-time progress
- Monitor 9-12 customizable KPI metrics across different time periods
- Visualize performance with interactive charts and goal tracking
- Get AI-powered insights and metric suggestions
- Manage multi-tenant company environments with role-based access

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: React with Vite
- **Routing**: Wouter for client-side navigation
- **Styling**: Tailwind CSS with shadcn/ui components
- **Charts**: Recharts for data visualization
- **State Management**: TanStack Query for server state
- **Forms**: React Hook Form with Zod validation

### Backend (Node.js + Express)
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Data Warehouse**: Snowflake integration
- **AI**: OpenAI GPT-4o for insights and suggestions
- **Session**: Express session with PostgreSQL store

### Key Technologies
- **Database ORM**: Drizzle with PostgreSQL
- **Data Visualization**: Recharts with progressive charts
- **UI Components**: shadcn/ui component library
- **Authentication**: Session-based with PostgreSQL storage
- **Type Safety**: Full TypeScript coverage across frontend and backend

## 📁 Project Structure

```
├── client/                     # Frontend React application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── dashboard/      # Dashboard-specific components
│   │   │   ├── layout/         # Layout components (sidebar, header)
│   │   │   └── ui/             # shadcn/ui base components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utility functions and configurations
│   │   ├── pages/              # Page components (routes)
│   │   └── App.tsx             # Main application component
│   └── index.html              # HTML entry point
├── server/                     # Backend Express application
│   ├── services/               # Business logic services
│   │   ├── ai-assistant.ts     # AI-powered insights
│   │   ├── metrics-ai.ts       # Metrics AI suggestions
│   │   ├── openai.ts           # OpenAI integration
│   │   ├── data-connector.ts   # Data source connections
│   │   └── python-connector-service.ts # Python connector integration
│   ├── db.ts                   # Database connection
│   ├── routes.ts               # API endpoints
│   ├── storage.ts              # Data access layer
│   └── index.ts                # Server entry point
├── shared/                     # Shared types and schemas
│   └── schema.ts               # Database schema and types
└── README.md                   # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Snowflake account (optional, for data warehouse features)
- OpenAI API key (for AI features)

### Environment Setup

**For new team members:**
```bash
# 1. Install dotenv-vault globally
npm install -g dotenv-vault

# 2. Login to vault and pull encrypted .env
npx dotenv-vault@latest login
npx dotenv-vault@latest pull
```

**Manual setup (if not using vault):**
Create a `.env` file with:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/database
OPENAI_API_KEY=your_openai_api_key
SESSION_SECRET=your_session_secret
```

### Installation & Running
```bash
# Install dependencies
npm install

# Start development server (runs both frontend and backend)
npm run dev
```

The application will be available at `http://localhost:5000`

## 🎨 Key Features

### 1. North Star Metrics
- **Always Visible**: Annual Revenue and Annual Profit displayed prominently
- **Time Period Views**: Weekly, Monthly, Quarterly, Year-to-Date
- **Progress Tracking**: "On pace" indicators based on YTD progress vs YTD goals
- **Interactive Charts**: Progressive line charts showing cumulative performance

### 2. KPI Dashboard
- **Customizable Metrics**: Add, edit, and track business-specific KPIs
- **Dynamic Calculations**: Adaptive goals and actuals based on selected time periods
- **Color-Coded Status**: Green (≥100%), Yellow (90-99%), Red (<90%)
- **Chart Synchronization**: Displayed values always match chart visualizations

### 3. AI Assistant
- **Smart Suggestions**: AI-powered KPI recommendations based on business type
- **SQL Generation**: Natural language to SQL query conversion
- **Business Analysis**: Automated insights and performance analysis
- **Context-Aware**: Understands your data schema and business model

### 4. Multi-Tenant Management
- **Company Isolation**: Each company has separate data and users
- **Role-Based Access**: Admin panel for user and company management
- **Database Separation**: Company-specific database schemas in Snowflake

## 📊 Data Flow

### Metrics Calculation Logic
1. **Base Data Generation**: Each metric has performance patterns and seasonal variations
2. **Time Period Adaptation**: Goals and actuals automatically adjust for selected time period
3. **Progressive Charts**: Show cumulative data building over time periods
4. **Real-Time Sync**: Chart data and displayed values use identical calculations

### Chart Types by Time Period
- **Weekly**: Daily cumulative progression (Mon-Sun)
- **Monthly**: Daily cumulative progression across full month
- **Quarterly**: Weekly cumulative progression with week start dates
- **YTD**: Monthly cumulative progression (Jan-Dec)

## 🛠️ Development Guidelines

### Adding New Metrics
1. Update the `kpiMetrics` array in your component
2. Define calculation logic in metric generation functions
3. Ensure chart data matches displayed values exactly
4. Add appropriate formatting for the metric type

### Database Changes
1. Update `shared/schema.ts` with new tables/columns
2. Use `npm run db:push` to apply schema changes
3. Update storage interface in `server/storage.ts`
4. Never write manual SQL migrations

### Component Development
- Use shadcn/ui components for consistency
- Follow the existing pattern of data fetching with TanStack Query
- Ensure responsive design with Tailwind CSS classes
- Maintain type safety with proper TypeScript types

## 🔧 API Endpoints

### Core Endpoints
- `GET /api/kpi-metrics` - Fetch all KPI metrics
- `POST /api/kpi-metrics` - Create new KPI metric
- `PUT /api/kpi-metrics/:id` - Update existing metric
- `DELETE /api/kpi-metrics/:id` - Delete metric

### AI Endpoints
- `POST /api/ai/suggest-kpis` - Get AI KPI suggestions
- `POST /api/ai/generate-sql` - Convert natural language to SQL
- `POST /api/ai/chat` - Chat with AI assistant

### Management Endpoints
- `GET /api/companies` - List companies
- `GET /api/users` - List users
- `POST /api/companies` - Create company
- `GET /api/setup-status` - Get setup progress

## 🎯 Performance Considerations

### Chart Optimization
- Progressive data loading for large datasets
- Memoized calculations for expensive operations
- Responsive design with mobile-optimized charts
- Efficient re-rendering with proper React keys

### Database Performance
- Indexed queries for fast metric retrieval
- Company-scoped data isolation
- Efficient pagination for large datasets
- Cached calculations where appropriate

## 🔒 Security Features

- Session-based authentication with PostgreSQL storage
- Company data isolation at the database level
- Input validation with Zod schemas
- Secure API endpoints with proper error handling

## 📱 Responsive Design

- Mobile-first approach with Tailwind CSS
- Collapsible sidebar for smaller screens
- Touch-friendly chart interactions
- Optimized layouts for tablet and desktop

## 🤖 AI Integration

### OpenAI Features
- **Model**: GPT-4o (latest OpenAI model)
- **KPI Suggestions**: Business-type specific recommendations
- **SQL Generation**: Natural language to SQL conversion
- **Chat Assistant**: Contextual business insights
- **Schema Understanding**: AI analyzes your data structure

### AI Service Architecture
- Fallback responses when AI is unavailable
- Structured JSON responses for consistent parsing
- Context-aware prompts with business domain knowledge
- Error handling for API rate limits and failures

## 📈 Metrics & Analytics

### Supported Metric Types
- **Revenue Metrics**: MRR, ARR, Revenue Growth
- **Customer Metrics**: CAC, LTV, Churn Rate
- **Operational Metrics**: Conversion rates, engagement
- **Financial Metrics**: Profit margins, cash flow
- **Custom Metrics**: User-defined with flexible calculations

### Goal Setting
- Yearly, quarterly, or monthly goal definitions
- Automatic time-period adaptation of goals
- Progress tracking with visual indicators
- Historical performance comparison

## 🚨 Troubleshooting

### Common Issues

**Numbers don't match between cards and charts:**
- Both use identical data from `generateNorthStarData()`
- Check that chart data and display values reference same source

**AI features not working:**
- Verify `OPENAI_API_KEY` is set in environment
- Check API key has sufficient credits
- Review error logs for rate limit issues

**Database connection issues:**
- Verify `DATABASE_URL` format and credentials
- Ensure PostgreSQL is running and accessible
- Check that database schema is up to date with `npm run db:push`

### Development Tips
- Use browser dev tools to inspect chart data
- Check network tab for API response issues
- Review console logs for React component errors
- Use TypeScript errors to catch type mismatches early

## 🤝 Contributing

1. Follow existing code patterns and TypeScript conventions
2. Ensure all new features have proper error handling
3. Test both mobile and desktop responsive behavior
4. Update this README when adding major features
5. Maintain data consistency between visualizations and displayed values

## 📞 Support

For questions about:
- **Setup & Configuration**: Check environment variables and database connection
- **Feature Development**: Review existing component patterns
- **Data Integration**: Examine Snowflake and API service configurations
- **UI/UX Issues**: Check Tailwind CSS classes and responsive design patterns

Remember: The application prioritizes authentic data over mock data, so ensure proper API keys and database connections are configured for full functionality.