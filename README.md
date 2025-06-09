# Dreamschema - CSV to Supabase Schema Converter

<p align="center">
 Convert CSV files into production-ready Postgres database schemas for Supabase with AI-powered schema generation and visual editing.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#demo"><strong>Demo</strong></a> ·
  <a href="#clone-and-run-locally"><strong>Clone and run locally</strong></a> ·
  <a href="#feedback-and-issues"><strong>Feedback and issues</strong></a>
</p>
<br/>

## Features

- **AI-Powered Schema Generation**: Uses Gemini 2.5 Flash to analyze CSV files and generate intelligent Postgres schemas
- **Visual Schema Editor**: Interactive graph-based editor using React Flow for visualizing and editing table relationships
- **Supabase Integration**: Seamless OAuth integration with Supabase for project creation and schema deployment
- **Multi-CSV Support**: Process single or multiple CSV files to create comprehensive database schemas
- **Production-Ready**: Generates proper Postgres schemas with UUID primary keys, foreign key relationships, and best practices
- **Migration Scripts**: Generates Supabase-compatible SQL migration files for easy deployment
- Works across the entire [Next.js](https://nextjs.org) stack
  - App Router
  - Pages Router
  - Middleware
  - Client
  - Server
  - It just works!
- supabase-ssr. A package to configure Supabase Auth to use cookies
- Password-based authentication with [Supabase Auth](https://supabase.com/auth)
- Styling with [Tailwind CSS](https://tailwindcss.com) using Supabase's black and green theme
- Components with [shadcn/ui](https://ui.shadcn.com/)

## Demo

Coming soon! The application will be deployed and available for testing.

## Clone and run locally

1. You'll first need a Supabase project which can be made [via the Supabase dashboard](https://database.new)

2. Clone this repository

   ```bash
   git clone https://github.com/your-username/dreamschema.git
   cd dreamschema
   ```

3. Install dependencies

   ```bash
   npm install
   ```

4. Create a `.env.local` file and update the following:

   ```
   NEXT_PUBLIC_SUPABASE_URL=[INSERT SUPABASE PROJECT URL]
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[INSERT SUPABASE PROJECT API ANON KEY]
   GEMINI_API_KEY=[INSERT YOUR GEMINI API KEY]
   ```

   Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` can be found in [your Supabase project's API settings](https://supabase.com/dashboard/project/_?showConnect=true)

   Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

5. You can now run the Next.js local development server:

   ```bash
   npm run dev
   ```

   Dreamschema should now be running on [localhost:3000](http://localhost:3000/).

> Check out [the docs for Local Development](https://supabase.com/docs/guides/getting-started/local-development) to also run Supabase locally.

## How it works

1. **Upload CSV Files**: Upload one or multiple CSV files through the intuitive drag-and-drop interface
2. **AI Analysis**: Gemini 2.5 Flash analyzes your CSV headers and sample data to infer optimal database schema
3. **Visual Editing**: Use the interactive React Flow graph to visualize and edit table structures, relationships, and column types
4. **Schema Generation**: Generate production-ready Postgres migration scripts with proper UUID keys and relationships
5. **Supabase Integration**: Connect your Supabase account and deploy schemas directly to your projects

## Technology Stack

- **Frontend**: Next.js 15.3, React 19, TypeScript
- **Styling**: Tailwind CSS with Supabase theme, shadcn/ui components
- **AI**: Google Gemini 2.5 Flash for intelligent schema generation
- **Visualization**: React Flow for interactive schema diagrams
- **Database**: Supabase (Postgres) with OAuth integration
- **Deployment**: Netlify, Vercel, or any Node.js hosting platform

## Feedback and issues

Please file feedback and issues over on the [GitHub repository](https://github.com/your-username/dreamschema/issues/new).

## More Supabase examples

- [Next.js Subscription Payments Starter](https://github.com/vercel/nextjs-subscription-payments)
- [Cookie-based Auth and the Next.js 13 App Router (free course)](https://youtube.com/playlist?list=PL5S4mPUpp4OtMhpnp93EFSo42iQ40XjbF)
- [Supabase Auth and the Next.js App Router](https://github.com/supabase/supabase/tree/master/examples/auth/nextjs)