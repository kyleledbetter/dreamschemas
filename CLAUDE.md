# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production app
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Overview

**Dreamschema** is a CSV to Supabase schema converter that transforms CSV files into production-ready Postgres database schemas using AI-powered analysis. The application must run in Bolt.new (Next.js 15.3 & React 19) and provides intelligent schema generation, visual editing, and seamless Supabase OAuth integration.

## Core Features & Requirements

### CSV Processing
- Single or multi-file CSV upload with drag-and-drop interface
- Option to sample rows vs. full-file upload for performance
- All CSV data processed client-side or in ephemeral containers for security
- No CSV data persisted on servers

### AI-Powered Schema Generation
- Uses Gemini 2.5 Flash (`gemini-2.0-flash-preview-04-17`) for intelligent analysis
- Input: CSV headers + sample rows as JSON
- Output: Production-ready Postgres schema with proper UUID primary keys
- Maps CSV data to appropriate Postgres column types and relationships
- Follows Postgres best practices for table structure

### Visual Schema Editor
- Interactive graph using React Flow for schema visualization
- Full-screen canvas with sidebar for table/column properties
- Drag-and-drop interface for creating relations and editing structure
- Shows tables, columns, primary keys, and foreign key relationships
- Mobile responsive with collapse to list view on small screens

### Supabase Integration
- "Connect Supabase" OAuth2 integration using `supabase-management-js`
- Creates new Supabase projects and applies schemas via migration
- Includes public.profiles table setup for Supabase Auth
- Generates Supabase-compatible `.sql` migration files
- One-click copy/download of migration scripts

### Security & Privacy
- Protect user information and CSV data
- OAuth tokens scoped minimally (project & storage admin)
- All processing happens client-side or in secure containers

## Technical Architecture

### Frontend Stack
- **Framework**: Next.js 15.3 + React 19 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui with Supabase black/green theme
- **Visualization**: React Flow for schema diagrams
- **Authentication**: Supabase Auth with SSR cookies
- **AI**: Google Gemini 2.5 Flash API integration

### Key Components Structure
- `app/auth/` - Complete authentication flow (sign-up, login, password reset)
- `app/protected/` - Protected routes requiring authentication
- `components/ui/` - shadcn/ui components with Supabase theming
- `lib/supabase/` - Supabase client configuration (client, server, middleware)

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=[Supabase Project URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[Supabase Project API Key]
GEMINI_API_KEY=[Google AI Studio API Key]
```

### Deployment Targets
- Must work in Bolt.new web containers (no custom npm installs)
- Netlify static hosting + serverless functions
- Local development support

## UI/UX Flow

1. **Landing/Connect Screen**: Hero with "Connect Supabase" CTA
2. **CSV Import Modal**: Drag-and-drop with file preview and sample-rows toggle
3. **Schema Canvas**: Full-screen React Flow graph with properties sidebar
4. **Migration Review**: Split-view SQL editor with preview and export options
5. **Settings**: Light/dark toggle, OAuth account switcher

## Development Notes

- Uses `@supabase/ssr` package for cookie-based authentication
- Implements middleware for route protection
- Path aliases: `@/*` maps to project root
- Must maintain compatibility with Bolt.new web containers
- All components follow Supabase black/green color theme