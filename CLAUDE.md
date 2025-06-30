# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production app
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Overview

**Dreamschema** is a CSV to Supabase schema converter that transforms CSV files into production-ready Postgres database schemas using AI-powered analysis. The application runs in Next.js 15.3 & React 19 and provides intelligent schema generation, visual editing, and seamless Supabase OAuth integration.

## Core Features & Requirements

### CSV Processing
- Multi-file CSV upload with drag-and-drop interface using react-dropzone
- Smart sampling strategy (first 1000 rows for type inference)
- Support multiple delimiters (comma, tab, pipe, semicolon)
- All CSV data processed client-side using PapaParse
- No CSV data persisted on servers

### AI-Powered Schema Generation with Vercel AI SDK
- Uses Vercel AI SDK with Gemini 2.5 Flash (`gemini-2.5-flash`)
- Streaming AI responses for real-time analysis feedback
- Intelligent type detection, relationship discovery, and normalization suggestions
- Generates production-ready Postgres schema with UUID primary keys
- Includes RLS policies and proper indexing suggestions
- Fallback to rule-based analysis if AI fails

### Visual Schema Editor (React Flow)
- Interactive schema visualization with custom table nodes
- Full-screen canvas with properties editor sidebar
- Drag-and-drop interface for editing structure and relationships
- Auto-layout algorithm for initial positioning
- Real-time validation and error highlighting
- Export schema as PNG/SVG images

### Local Testing with PGLite
- Browser-based Postgres testing using @electric-sql/pglite
- Validate schema before deployment
- Run sample queries and test constraints
- No server required for validation

### Supabase Integration
- OAuth2 integration for project management
- Create new projects or select existing ones
- Apply migrations directly via Supabase Management API
- Generate TypeScript types and Prisma schemas
- Set up storage buckets for CSV archiving

### Advanced AI Features
- Interactive refinement with natural language queries
- Smart suggestions with confidence scores
- Data quality issue detection
- Performance optimization recommendations
- Streaming analysis with visual progress indicators

## Technical Architecture

### Frontend Stack
- **Framework**: Next.js 15.3 + React 19 (App Router)
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS + shadcn/ui with Supabase black/green theme
- **AI Integration**: Vercel AI SDK with Gemini 2.5 Flash (`gemini-2.5-flash`)
- **Visualization**: React Flow for schema diagrams
- **CSV Parsing**: PapaParse with smart sampling
- **Local Testing**: PGLite (@electric-sql/pglite) for browser-based Postgres
- **File Handling**: react-dropzone for multi-file upload
- **Authentication**: Supabase Auth with SSR cookies

### Key Components Structure
- `app/auth/` - Complete authentication flow (sign-up, login, password reset)
- `app/dashboard/` - Main dashboard with CSV upload and schema editing
- `app/api/` - API routes for AI analysis and schema validation
- `components/csv/` - CSV upload, preview, and analysis components
- `components/schema/` - React Flow visualizer and editing components
- `components/migration/` - SQL preview and export components
- `components/ui/` - shadcn/ui components with Supabase theming
- `lib/csv/` - CSV parsing, type inference, and relationship detection
- `lib/schema/` - Schema generation and validation logic
- `lib/ai/` - AI integration with streaming responses
- `lib/supabase/` - Supabase client configuration and management API
- `lib/db/` - PGLite integration for local testing

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=[Supabase Project URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[Supabase Project API Key]
GOOGLE_GENERATIVE_AI_API_KEY=[Google AI Studio API Key for Gemini]
```

### Deployment Targets
- Must work in Bolt.new web containers (no custom npm installs)
- Netlify static hosting + serverless functions
- Local development support

## UI/UX Flow

1. **Landing/Connect Screen**: Hero with "Connect Supabase" CTA
2. **CSV Upload**: Multi-file drag-and-drop with preview and sampling options
3. **AI Analysis**: Streaming analysis with real-time progress and results
4. **Interactive Refinement**: Natural language queries to adjust schema
5. **Schema Canvas**: Full-screen React Flow visualization with editing sidebar
6. **Local Validation**: PGLite testing with query results and error reporting
7. **Migration Export**: SQL preview with multiple format options and TypeScript generation
8. **Supabase Deploy**: Direct project creation and migration application

## Development Notes

- Uses `@supabase/ssr` package for cookie-based authentication
- Implements middleware for route protection
- Path aliases: `@/*` maps to project root
- Must maintain compatibility with Bolt.new web containers
- All components follow Supabase black/green color theme
- Vercel AI SDK for streaming responses and AI integration
- PGLite for client-side Postgres testing without servers
- React Flow for interactive schema visualization
- Fallback to rule-based analysis if AI fails

## AI Integration Details

- Model: `gemini-2.5-flash` via Vercel AI SDK
- Streaming responses for real-time feedback
- Prompt engineering optimized for schema generation
- Confidence scoring for AI suggestions
- Natural language refinement interface
- Intelligent type detection and relationship discovery
- Data quality issue identification
- Performance optimization recommendations

## Key Libraries to Install

```bash
npm install @ai-sdk/google ai papaparse react-flow-renderer @electric-sql/pglite react-dropzone
```