## Core Architecture & Constraints

### Technical Stack
- **Framework**: Next.js 15.3 (App Router) with React 19.0.0
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS with Supabase theme (black/green)
- **UI Components**: Shadcn UI with Supabase color scheme
- **AI Integration**: Vercel AI SDK with Gemini 2.5 Flash (gemini-2.5-flash)
- **Visualization**: React Flow for schema diagram
- **CSV Parsing**: PapaParse
- **Local Testing**: PGLite (@electric-sql/pglite)
- **File Handling**: react-dropzone

## Application Structure

### Tentative File Organization
```
/app
  /(auth)
    /login/page.tsx - OAuth login page
  /(dashboard)
    /page.tsx - Main dashboard with CSV upload
    /schema/[id]/page.tsx - Schema editor view
  /api
    /auth/callback/route.ts - Supabase OAuth callback
    /schema/validate/route.ts - Schema validation endpoint
/components
  /csv
    /csv-dropzone.tsx - Multi-file upload with drag-drop
    /csv-preview.tsx - Show parsed data sample
    /column-analyzer.tsx - Display inferred types
  /schema
    /schema-visualizer.tsx - React Flow diagram
    /table-node.tsx - Custom table node component
    /relationship-edge.tsx - Custom edge component
    /schema-editor-panel.tsx - Properties editor
  /migration
    /migration-preview.tsx - SQL preview with syntax highlighting
    /export-options.tsx - Download/copy options
  /supabase
    /connect-button.tsx - OAuth connection flow
    /project-creator.tsx - New project setup
/lib
  /csv
    /parser.ts - PapaParse wrapper with sampling
    /type-inference.ts - Smart type detection
    /relationship-detector.ts - Foreign key detection
  /schema
    /generator.ts - Convert CSV to schema
    /postgres-types.ts - Type mapping logic
    /normalizer.ts - Data normalization helpers
    /validator.ts - Schema validation rules
  /supabase
    /client.ts - Supabase client setup
    /management.ts - Project management API
    /migration-formatter.ts - SQL generation
  /db
    /pglite-instance.ts - Local Postgres testing
    /test-queries.ts - Validation queries
/types
  /schema.types.ts - Schema type definitions
  /csv.types.ts - CSV parsing types
  /supabase.types.ts - Supabase API types
/utils
  /file-utils.ts - File size/type validation
  /string-utils.ts - Naming convention helpers
```

## AI-Powered Analysis with Vercel AI SDK

### LLM Integration Architecture
```typescript
// lib/ai/schema-analyzer.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google'

// Requires GOOGLE_GENERATIVE_AI_API_KEY in .env.local
model: google('gemini-2.5-flash-preview-04-17')

interface AIAnalysisRequest {
  csvHeaders: string[]
  sampleRows: string[][]
  fileName: string
  userContext?: string
}

interface AIAnalysisResponse {
  tables: AITableSuggestion[]
  relationships: AIRelationshipSuggestion[]
  normalizationSuggestions: NormalizationHint[]
  dataQualityIssues: DataQualityIssue[]
  migrationScript: string
  confidence: number
}
```

### AI Analysis Pipeline
1. **Initial CSV Scan** - Send headers and sample rows to LLM
2. **Schema Generation** - LLM creates optimal table structure
3. **Relationship Detection** - AI identifies complex relationships
4. **Normalization Analysis** - Suggests data normalization
5. **Migration Generation** - Creates production-ready SQL
6. **Quality Assessment** - Identifies data issues and improvements

### Prompt Engineering for Schema Analysis
```typescript
const analyzeCSVPrompt = (data: AIAnalysisRequest) => `
You are an expert database architect specializing in PostgreSQL and Supabase.
Analyze this CSV data and create an optimal database schema.

CSV File: ${data.fileName}
Headers: ${data.csvHeaders.join(', ')}

Sample Data (first 10 rows):
${data.sampleRows.map(row => row.join(', ')).join('\n')}

Requirements:
1. Use UUID primary keys (id UUID DEFAULT uuid_generate_v4() PRIMARY KEY)
2. Add created_at and updated_at timestamps
3. Include user_id references to auth.users where appropriate
4. Detect and suggest relationships between data
5. Normalize data where beneficial
6. Follow PostgreSQL best practices
7. Include RLS policies for Supabase
8. Suggest appropriate indexes
9. Identify data quality issues

Output as JSON with:
- tables: Array of table definitions
- relationships: Foreign key relationships
- normalizationSuggestions: Ways to improve data structure
- dataQualityIssues: Problems found in the data
- migrationScript: Complete SQL migration
- confidence: 0-1 score for analysis confidence
`

### Streaming AI Responses
```typescript
// components/ai/ai-analysis-stream.tsx
import { useCompletion } from 'ai/react'

export const AIAnalysisStream = ({ csvData, onComplete }) => {
  const { completion, isLoading, error, complete } = useCompletion({
    api: '/api/ai/analyze',
    onFinish: (result) => {
      const analysis = JSON.parse(result)
      onComplete(analysis)
    }
  })
  
  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" />
          <span>AI is analyzing your CSV structure...</span>
        </div>
      )}
      
      {completion && (
        <div className="bg-muted p-4 rounded-lg">
          <pre className="whitespace-pre-wrap">{completion}</pre>
        </div>
      )}
    </div>
  )
}
```

### AI-Enhanced Features

#### 1. Intelligent Type Detection
```typescript
const aiTypeDetection = async (column: ColumnData) => {
  const response = await google.generateContent({
    model: 'gemini-2.5-flash',
    messages: [{
      role: 'user',
      content: `Analyze these values and suggest the best PostgreSQL data type:
        Column: ${column.name}
        Sample values: ${column.values.slice(0, 100).join(', ')}
        
        Consider: VARCHAR, TEXT, INTEGER, BIGINT, NUMERIC, BOOLEAN, DATE, TIMESTAMP, UUID, JSONB
        Also suggest constraints: NOT NULL, UNIQUE, CHECK, DEFAULT
        
        Return JSON: { type: string, constraints: string[], reasoning: string }`
    }]
  })
  
  return JSON.parse(response.text())
}
```

#### 2. Smart Relationship Discovery
```typescript
const aiRelationshipDetection = async (tables: Table[]) => {
  const response = await google.generateContent({
    model: 'gemini-2.5-flash',
    messages: [{
      role: 'user',
      content: `Analyze these tables and identify relationships:
        
        Tables:
        ${tables.map(t => `${t.name}: ${t.columns.map(c => c.name).join(', ')}`).join('\n')}
        
        Identify:
        1. One-to-many relationships
        2. Many-to-many relationships (suggest junction tables)
        3. Self-referential relationships
        4. Polymorphic relationships
        
        Return JSON with relationship definitions and confidence scores`
    }]
  })
  
  return JSON.parse(response.text())
}
```

#### 3. Data Normalization Suggestions
```typescript
const aiNormalizationAnalysis = async (table: Table, sampleData: any[]) => {
  const response = await google.generateContent({
    model: 'gemini-2.5-flash',
    messages: [{
      role: 'user',
      content: `Analyze this table for normalization opportunities:
        
        Table: ${table.name}
        Columns: ${table.columns.map(c => `${c.name} (${c.type})`).join(', ')}
        Sample data: ${JSON.stringify(sampleData.slice(0, 20), null, 2)}
        
        Suggest:
        1. Columns that should be split into separate tables
        2. Repeated data that indicates need for normalization
        3. JSON columns that should be relational
        4. Recommended table structure improvements
        
        Return practical suggestions with example SQL`
    }]
  })
  
  return JSON.parse(response.text())
}
```

### API Routes for AI Processing

#### /api/ai/analyze/route.ts
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleGenerativeAIStream, StreamingTextResponse } from 'ai'

export async function POST(req: Request) {
  const { csvHeaders, sampleRows, fileName, context } = await req.json()
  
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3, // Lower temperature for more consistent schema generation
      topP: 0.9,
      topK: 40,
    }
  })
  
  const prompt = generateSchemaAnalysisPrompt({ csvHeaders, sampleRows, fileName, context })
  
  const result = await model.generateContentStream(prompt)
  const stream = GoogleGenerativeAIStream(result)
  
  return new StreamingTextResponse(stream)
}
```

### AI-Powered Workflow

1. **Upload CSV** → Parse headers and sample rows
2. **AI Analysis** → Send to Gemini for intelligent analysis
3. **Stream Results** → Show analysis in real-time
4. **Interactive Refinement** → User can ask AI to adjust
5. **Generate Schema** → AI creates complete PostgreSQL schema
6. **Validate Locally** → Test with PGLite
7. **Deploy to Supabase** → Apply migration

### Error Handling for AI Failures
```typescript
const analyzeWithFallback = async (csvData: CSVData) => {
  try {
    // Try AI analysis first
    const aiResult = await analyzeWithAI(csvData)
    return { ...aiResult, method: 'ai' }
  } catch (error) {
    console.error('AI analysis failed, falling back to rules-based', error)
    
    // Fall back to deterministic analysis
    const rulesResult = await analyzeWithRules(csvData)
    return { ...rulesResult, method: 'rules-based', aiError: error.message }
  }
}
```

## Feature Implementation Details

### 1. CSV Import & Analysis System

#### Smart Sampling Strategy
- Read first 1000 rows for type inference (configurable)
- Detect file encoding automatically
- Support multiple delimiters (comma, tab, pipe, semicolon)
- Handle quoted values and escape characters properly

#### Type Inference Engine
```typescript
interface TypeInference {
  detectInteger(values: string[]): boolean
  detectDecimal(values: string[]): boolean
  detectBoolean(values: string[]): boolean
  detectDate(values: string[]): DateFormat | null
  detectEmail(values: string[]): boolean
  detectURL(values: string[]): boolean
  detectUUID(values: string[]): boolean
  detectJSON(values: string[]): boolean
  detectEnum(values: string[]): string[] | null // Returns possible values if enum
}
```

#### Relationship Detection Patterns
- Look for columns ending with `_id`
- Match column names across tables (e.g., `user_id` in multiple tables)
- Detect potential many-to-many relationships
- Identify self-referential patterns (e.g., `parent_id`)
- Find composite key candidates

### 2. Schema Generation Logic

#### Table Creation Rules
```typescript
interface TableSchema {
  // Always include these fields
  id: 'UUID DEFAULT uuid_generate_v4() PRIMARY KEY'
  created_at: 'TIMESTAMPTZ DEFAULT NOW()'
  updated_at: 'TIMESTAMPTZ DEFAULT NOW()'
  
  // Add user_id if auth is detected
  user_id?: 'UUID REFERENCES auth.users(id) ON DELETE CASCADE'
  
  // Generated columns from CSV
  [columnName: string]: PostgresType
}
```

#### Data Type Mapping
- **Strings**: VARCHAR(n) for consistent length, TEXT for variable
- **Numbers**: SMALLINT, INTEGER, BIGINT based on range, NUMERIC for decimals
- **Dates**: DATE, TIMESTAMP, TIMESTAMPTZ with format detection
- **Booleans**: BOOLEAN with fuzzy matching (yes/no, true/false, 1/0)
- **Special Types**: 
  - Email → VARCHAR(255) with CHECK constraint
  - URL → TEXT with CHECK constraint
  - JSON → JSONB for detected JSON strings
  - Enum → Custom TYPE for columns with <10 unique values

#### Naming Conventions
- Convert to snake_case automatically
- Pluralize table names
- Add `_at` suffix for timestamps
- Add `_id` suffix for foreign keys
- Preserve meaningful prefixes/suffixes

### 3. Visual Schema Designer (React Flow)

#### Node Components
```typescript
interface TableNode {
  id: string
  type: 'table'
  position: { x: number; y: number }
  data: {
    tableName: string
    columns: Column[]
    isSelected: boolean
    hasError: boolean
  }
}
```

#### Interactive Features
- Drag tables to reposition
- Click columns to edit properties
- Right-click for context menu (delete, duplicate)
- Double-click to rename inline
- Highlight related tables on hover
- Auto-layout algorithm for initial positioning

#### Relationship Visualization
- Different edge styles for relationship types
- Labels showing foreign key names
- Animated edges during editing
- Color coding for relationship validity

### 4. Schema Editor Panel

#### Editing Capabilities
- Table Operations:
  - Rename table
  - Add/remove columns
  - Reorder columns
  - Delete table
  - Duplicate table
  
- Column Operations:
  - Change name
  - Change data type
  - Set nullable/not null
  - Add default value
  - Add check constraints
  - Create indexes
  
- Relationship Operations:
  - Create foreign keys
  - Set cascade rules
  - Create junction tables
  - Remove relationships

#### Quick Actions Toolbar
- "Normalize Table" - Split denormalized data
- "Add Auth" - Add user_id and RLS policies
- "Add Timestamps" - Add created_at/updated_at
- "Add Soft Delete" - Add deleted_at column
- "Generate Types" - Export TypeScript interfaces

### 5. Migration Generator

#### SQL Output Formats
1. **Migration Format** (Up/Down)
```sql
-- Up Migration
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  -- ... columns
);

-- Down Migration  
DROP TABLE IF EXISTS public.users;
```

2. **Declarative Format** (Supabase style)
```sql
-- schema.sql
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  -- ... columns
);
```

#### RLS Policy Templates
```sql
-- Basic RLS policies for each table
ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;

-- User can read own data
CREATE POLICY "Users can view own {table_name}" 
ON public.{table_name} FOR SELECT 
USING (auth.uid() = user_id);

-- User can insert own data
CREATE POLICY "Users can insert own {table_name}"
ON public.{table_name} FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

#### Export Options
- Copy to clipboard (with success toast)
- Download as .sql file
- Download as .zip with multiple files
- Generate TypeScript types
- Generate Prisma schema (bonus)

### 6. PGLite Integration

#### Local Validation Flow
```typescript
interface ValidationResult {
  success: boolean
  errors: SchemaError[]
  warnings: SchemaWarning[]
  testQueries: TestQuery[]
}
```

#### Test Scenarios
- Create all tables and relationships
- Insert sample data
- Run basic SELECT queries
- Test foreign key constraints
- Validate check constraints
- Test RLS policies (simulated)

### 7. Supabase Integration

#### OAuth2 Flow
- "Connect Supabase" button in header
- Redirect to Supabase OAuth
- Handle callback and store tokens
- Show connected status with user info

#### Project Management
- List existing projects
- Create new project with generated schema
- Create storage bucket for CSV archives
- Apply migrations directly
- Generate Edge Functions (future)

### 8. Error Handling & Validation

#### File Validation
- Check file extension (.csv, .tsv)
- Validate MIME type
- Check file size (<50MB for client)
- Detect and handle BOM
- Validate UTF-8 encoding

#### Schema Validation
- Check for reserved keywords
- Validate column name uniqueness
- Ensure relationship integrity
- Detect circular dependencies
- Validate data type compatibility

#### User-Friendly Errors
- "This looks like an Excel file. Please export as CSV first."
- "Column 'user' conflicts with a Postgres reserved word. Renamed to 'user_name'."
- "Detected circular relationship between tables. Please review."
- "Some date values couldn't be parsed. Check row 5, column 'date'."

### 9. Performance Optimizations

#### Large File Handling
- Stream parsing for files >10MB
- Virtual scrolling for data preview
- Pagination for schema visualization (>50 tables)
- Debounced validation during editing
- Web Worker for type inference

#### React Optimizations
- Memoize expensive computations
- Virtualize long lists
- Lazy load schema editor panels
- Use React.memo for node components
- Implement undo/redo with patches

### 10. Advanced Features

#### Smart Suggestions
- Column name improvements using common patterns
- Index suggestions based on foreign keys
- Relationship naming based on table names
- Data normalization opportunities
- Performance optimization hints

#### Batch Operations
- Apply changes to multiple columns
- Bulk rename with patterns
- Global type changes
- Mass relationship creation
- Template application

## State Management

Use React Context for global state:
```typescript
interface AppState {
  csvFiles: ParsedCSV[]
  schema: DatabaseSchema
  selectedTable: string | null
  validationResults: ValidationResult[]
  supabaseConnection: SupabaseConnection | null
  editorHistory: HistoryStack
}
```

## Component Examples

### CSV Dropzone Component
- Show upload progress
- Display file previews
- Support multiple files
- Show parsing status
- Handle errors gracefully

### Schema Visualizer Component
- Use React Flow with custom nodes
- Implement mini-map for large schemas
- Add zoom controls
- Support full-screen mode
- Export as image (PNG/SVG)

### Migration Preview Component
- Syntax highlighting with Prism
- Line numbers
- Copy button per section
- Diff view for changes
- Search functionality

## Complete User Flow with AI Integration

### 1. Initial Upload
- User drags CSV file(s) to dropzone
- System parses headers and first 1000 rows
- Shows data preview with detected types

### 2. AI Analysis Phase
- Automatic AI analysis begins with visual streaming
- Shows "AI thinking" animation with live progress
- Displays streaming analysis text in real-time
- Analysis completes with confidence score

### 3. Review AI Results
- Display proposed schema with table structure
- Show detected relationships visually
- List data quality issues found
- Present normalization suggestions
- Show generated SQL preview

### 4. Interactive Refinement
- User can ask questions or request changes in natural language
- "Make the email column unique and add an index"
- "Split the address into separate columns"
- "This should be a many-to-many relationship"
- AI processes refinements and updates schema

### 5. Visual Editing
- Open React Flow diagram with AI-generated schema
- Drag to reposition tables
- Click to edit properties
- AI suggestions appear as overlay cards
- Apply or dismiss individual suggestions

### 6. Local Validation
- Test schema with PGLite in browser
- Run sample queries
- Validate constraints
- Show any errors with fixes

### 7. Migration Export
- AI-optimized SQL generation
- Multiple export formats (migration, declarative)
- TypeScript types generation
- Copy or download options

### 8. Supabase Deployment (Optional)
- OAuth connection flow
- Create new project or select existing
- Apply migration directly
- Set up storage bucket for CSV archive

### Error States & Fallbacks
- If AI fails → Automatic fallback to rule-based analysis
- If rate limited → Show cooldown timer with manual option
- If invalid response → Retry with simplified prompt
- Always maintain user control and manual override options

## Accessibility Requirements
- Keyboard navigation for all features
- Screen reader friendly
- High contrast mode support
- Focus indicators
- Error announcements
- Loading states with aria-live

## Security Considerations
- Client-side only processing by default
- No data persistence without consent
- Sanitize all user inputs
- Validate SQL generation
- Secure OAuth token storage
- Content Security Policy headers
- 