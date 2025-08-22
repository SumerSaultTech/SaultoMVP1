# Overview

This is a comprehensive business intelligence platform called "Business Metrics Dashboard" that provides real-time KPI tracking, AI-powered insights, and data analytics for businesses. The application offers a multi-tenant dashboard where companies can track North Star metrics (like Annual Revenue and Profit), monitor customizable KPI metrics, and get AI-powered business insights through an integrated chat interface called SaultoChat.

The platform is designed as a modern, full-stack web application with a React frontend and Node.js backend, featuring data visualization, user management, and extensive data source integrations through Python connector services.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built with React 18 and TypeScript using Vite as the build tool. Key architectural decisions include:

- **Routing**: Uses Wouter for lightweight client-side routing instead of React Router
- **State Management**: TanStack React Query for server state management, avoiding complex state management libraries
- **UI Framework**: shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **Charts**: Recharts library for data visualization and progressive charts
- **Forms**: React Hook Form with Zod validation for type-safe form handling

The component structure follows a feature-based organization with clear separation between dashboard components, layout components, and reusable UI components.

## Backend Architecture

The backend uses Node.js with Express and TypeScript for the main application server. Key design patterns include:

- **Multi-Service Architecture**: Two coordinated services - main Node.js app (port 5000) and Python connector service (port 5002)
- **Database**: PostgreSQL with Drizzle ORM for application data and analytics schemas
- **Session Management**: Express sessions with PostgreSQL store for authentication
- **API Design**: RESTful endpoints with comprehensive error handling and logging

## Data Storage Solutions

The application uses PostgreSQL as the primary database with a sophisticated schema design:

- **Application Schema**: Main tables for companies, users, data sources, SQL models, KPI metrics, and chat messages
- **Analytics Schemas**: Company-specific schemas (analytics_company_{id}) for storing connector data
- **ORM**: Drizzle ORM chosen for its TypeScript-first approach and excellent performance

The migration from Snowflake to PostgreSQL was implemented to unify the data architecture and reduce external dependencies.

## Authentication and Authorization

Simple session-based authentication with:
- PostgreSQL session storage using connect-pg-simple
- Role-based access control (admin, user, viewer)
- Multi-tenant company isolation
- Frontend authentication state management

## AI Integration

Dual AI service architecture:
- **Azure OpenAI**: Primary AI service for chat functionality
- **OpenAI GPT-4**: Fallback service for business insights and KPI suggestions
- **Metrics AI Service**: Specialized service for generating business metric suggestions and SQL queries

# External Dependencies

## Third-Party Services

- **Azure OpenAI**: Primary AI service for SaultoChat functionality and business insights
- **OpenAI**: Secondary AI service and fallback for GPT-4 powered features
- **SendGrid**: Email service integration for notifications and user management

## Data Connector Services

Python-based connector services for external data integration:
- **Salesforce Connector**: REST API v59.0 integration for CRM data
- **Jira Connector**: REST API v3 integration for project management data
- **HubSpot Connector**: Marketing and sales data integration (planned)

These connectors run as a separate Python Flask service (port 5002) that interfaces with the main Node.js application.

## Database and Infrastructure

- **PostgreSQL**: Primary database for both application data and analytics storage
- **Neon Database**: Serverless PostgreSQL provider integration
- **Replit**: Development and deployment platform with specific optimizations

## UI and Visualization Libraries

- **Radix UI**: Primitive components for accessibility and behavior
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Recharts**: Data visualization and charting library
- **React Hook Form**: Form state management and validation
- **Wouter**: Minimalist routing library for React

The architecture prioritizes simplicity, type safety, and maintainability while providing a scalable foundation for business intelligence features.