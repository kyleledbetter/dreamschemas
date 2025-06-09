# Dreamschemas - CSV to Supabase Schema Converter

I want to build a Next.js 15.3 React 19 application that converts CSV files into production-ready Postgres database schemas for Supabase. The tool should provide intelligent schema generation, visual editing, and seamless Supabase OAuth integration to create a Supabase project and apply the generated schema to it.

Requirements:
* Must be able to run the UI in Bolt.new (Next.js 15.3 and React 19)
* Must be secure and protect user information
* Must use Gemini 2.5 Flash (gemini-2.0-flash-preview-04-17) for AI processing of the CSV files and mapping to Postgres schema
* Must accept one or multiple CSV files
* Must create a proper Postgres Schema with multiple tables
* Must with with Supabase Auth with a public.profiles table
* Must follow Postgres best practices for table uuid id columns and proper column types and relationships
* Must visualize suggested schema table structure, keys, and relations
* Must allow editing of schema structure
* Must generate Supabase Postgres Migration script for manual copy and download of migration
* Must use Supabase black and green color theme for Tailwind and Shadcn UI
* Must include "Connect Supabase"  OAuth2 integration to use with supabase-management-js typescript library to create the new project and database via migration (docs https://supabase.com/docs/guides/integrations/build-a-supabase-integration)
* Must use react-flow for the schema visualization
* Must be able to run locally and in Bolt.new web containers and deployed to Netlify

# Dreamschemas – CSV → Supabase Schema Converter

## Introduction
Dreamschemas is a browser-based tool—built in Bolt.new (Next.js 15.3 & React 19)—that ingests one or more CSV files, uses Gemini 2.5 Flash to infer production-ready Postgres schemas, and lets users visually refine and apply them to a Supabase project via OAuth.

## Goals
- **Automate schema generation** from arbitrary CSV data with high accuracy  
- **Empower users** to visually inspect & edit inferred tables, columns, keys, and relationships  
- **Seamless Supabase integration**: project creation, migrations, storage buckets, edge functions  
- **Enterprise-grade security**: protect CSV data and database credentials  
- **Deploy anywhere**: run locally, in Bolt.new web containers, or on Netlify  

## Features
1. **CSV Import**  
   - Single or multi-file upload  
   - Option to sample rows vs. full-file upload for performance  
2. **AI-driven Schema Inference**  
   - Gemini 2.5 Flash model analyzes headers & sample rows  
   - Maps to Postgres types with UUID primary keys and foreign-key relationships  
3. **Visual Schema Editor**  
   - Interactive graph (react-flow) showing tables, columns, PKs/FKs  
   - Drag-and-drop to create relations or rename columns  
4. **Migration Script Generation**  
   - Generates Supabase-compatible `.sql` declarative schema files  
   - One-click copy/download of migration script  
5. **Supabase OAuth & Project Setup**  
   - “Connect Supabase” button via supabase-management-js  
   - Onboard new project, create public.profiles table, storage bucket  
   - Deploy edge functions to handle large CSV imports  
6. **Local Testing**  
   - PGlite in-browser Postgres for offline preview (`@electric-sql/pglite`)  
7. **Theming & UI**  
   - Tailwind + Shadcn UI with Supabase black & green theme (via tweakcn)  
8. **Deployment**  
   - Works in Bolt.new web containers  
   - Static export & serverless functions on Netlify  

## Technical Architecture & Constraints
- **Front-end**  
  - Next.js 15.3 + React 19 in Bolt.new  
  - Tailwind CSS & Shadcn UI components (theme via `npx shadcn add …supabase.json`)  
  - React-flow for schema graph  
- **AI Processing**  
  - Call Gemini 2.5 Flash (`gemini-2.0-flash-preview-04-17`)  
  - Input: CSV header + sample rows JSON  
  - Output: JSON schema draft  
- **Back-end / Integration**  
  - Supabase OAuth2 using `supabase-management-js`  
  - Project creation → run migration `.sql` declarative schema  
  - Optional edge functions for large file parsing & storage uploads  
- **Local Mode**  
  - In-browser Postgres via PGlite for preview  
- **Security & Privacy**  
  - All CSV data processed client-side or in ephemeral containers  
  - OAuth tokens scoped minimally (project & storage admin)  
  - No CSV data persisted on our servers  
- **Deployment Targets**  
  - Bolt.new web containers (no custom npm installs)  
  - Netlify: static hosting + serverless functions  

## UI and UX Design Documentation
1. **Landing / Connect Screen**  
   - Hero banner: tool name, tagline, “Connect Supabase” CTA  
   - Highlight AI & visual editor benefits
2. **CSV Import Modal**  
   - Drag-and-drop area with file list preview  
   - Sample-rows toggle  
3. **Schema Canvas**  
   - Full-screen react-flow graph  
   - Sidebar: table/column properties panel  
   - Top toolbar: “Generate Migration,” “Reset,” “Export SQL”
4. **Migration Review**  
   - Split-view: SQL editor on left, preview on right  
   - Copy & Download buttons  
5. **Settings / Theme**  
   - Light/dark toggle (follows Supabase colors)  
   - OAuth account switcher  
6. **Mobile / Responsive**  
   - Collapse graph to list view on small screens  
   - Floating FAB for key actions (Import, Export, Connect)  
