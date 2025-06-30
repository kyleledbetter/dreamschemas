/**
 * AI Route: Generate Dynamic Seeding Logic
 * Takes a database schema and generates TypeScript seeding logic for edge functions
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { DatabaseSchema } from "@/types/schema.types";

interface CSVMetadata {
  headers: string[];
  sampleData: Record<string, unknown>[];
  totalRows: number;
}

interface GenerateSeedingLogicRequest {
  schema: DatabaseSchema;
  csvMetadata?: CSVMetadata[];
  targetBatchSize?: number;
  optimizationLevel?: 'fast' | 'balanced' | 'thorough';
}

interface SeedingLogicResponse {
  success: boolean;
  seedingLogic: {
    tableProcessors: string;
    columnMappers: string;
    relationshipResolvers: string;
    validationRules: string;
    constants: string;
  };
  metadata: {
    tablesCount: number;
    complexityScore: number;
    estimatedPerformance: string;
    recommendedBatchSize: number;
  };
  error?: string;
}

// Zod schema for structured AI output
const SeedingLogicSchema = z.object({
  constants: z.string().describe("TypeScript constants and configuration"),
  tableProcessors: z.string().describe("Table processing order and filtering logic"),
  columnMappers: z.string().describe("CSV to database column mapping with type conversion"),
  relationshipResolvers: z.string().describe("Foreign key resolution and relationship handling"),
  validationRules: z.string().describe("Data validation and error handling logic"),
  metadata: z.object({
    complexity: z.number(),
    estimatedRows: z.number(),
    optimizations: z.array(z.string()),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body: GenerateSeedingLogicRequest = await request.json();
    const { schema } = body;

    if (!schema || !schema.tables || schema.tables.length === 0) {
      return NextResponse.json(
        { error: "Valid database schema is required" },
        { status: 400 }
      );
    }

    // Analyze schema complexity
    const complexityScore = calculateSchemaComplexity(schema);
    const recommendedBatchSize = Math.max(10, Math.min(200, Math.floor(1000 / complexityScore)));

    // Try to generate AI-powered seeding logic
    let generatedCode: string;
    
    try {
      generatedCode = await generateAISeeding(schema, body.csvMetadata || [], recommendedBatchSize, body.optimizationLevel || 'balanced');
      console.log("✅ AI seeding logic generated successfully");
    } catch (aiError) {
      console.warn("❌ AI generation failed, falling back to mock logic:", aiError);
      generatedCode = generateMockSeedingLogic(schema);
    }

    // Parse the generated code into components
    const seedingLogic = parseSeedingLogicResponse(generatedCode);

    return NextResponse.json({
      success: true,
      seedingLogic,
      metadata: {
        tablesCount: schema.tables.length,
        complexityScore,
        estimatedPerformance: getPerformanceEstimate(complexityScore, schema.tables.length),
        recommendedBatchSize,
      },
    } satisfies SeedingLogicResponse);

  } catch (error) {
    console.error("Error generating seeding logic:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to generate seeding logic",
        success: false 
      },
      { status: 500 }
    );
  }
}

/**
 * Generate AI-powered seeding logic using Google Generative AI
 */
async function generateAISeeding(
  schema: DatabaseSchema,
  csvMetadata: CSVMetadata[],
  batchSize: number,
  optimizationLevel: string
): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable not set");
  }
  
  console.log("🔑 API key found:", apiKey ? "✅ YES" : "❌ NO");

  console.log("🤖 Generating AI seeding logic with Gemini...");

  try {
    const prompt = buildSeedingLogicPrompt(schema, csvMetadata, batchSize, optimizationLevel);
    console.log(`📝 Generated prompt length: ${prompt.length} characters`);
    console.log(`🔍 Prompt preview: ${prompt.substring(0, 500)}...`);
    
    console.log("🚀 Calling Gemini API...");
    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      prompt,
      schema: SeedingLogicSchema,
    });
    
    console.log("✅ Gemini API response received");
    console.log(`📊 Generated constants length: ${result.object.constants?.length || 0}`);
    console.log(`📊 Generated column mappers length: ${result.object.columnMappers?.length || 0}`);

    // Convert structured output back to the expected format
    const sections = [
      "## 1. CONSTANTS",
      "```typescript",
      result.object.constants,
      "```",
      "",
      "## 2. TABLE_PROCESSORS", 
      "```typescript",
      result.object.tableProcessors,
      "```",
      "",
      "## 3. COLUMN_MAPPERS",
      "```typescript", 
      result.object.columnMappers,
      "```",
      "",
      "## 4. RELATIONSHIP_RESOLVERS",
      "```typescript",
      result.object.relationshipResolvers, 
      "```",
      "",
      "## 5. VALIDATION_RULES",
      "```typescript",
      result.object.validationRules,
      "```"
    ];

    return sections.join("\n");
    
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function calculateSchemaComplexity(schema: DatabaseSchema): number {
  let complexity = 0;
  
  // Base complexity per table
  complexity += schema.tables.length * 2;
  
  // Column complexity
  schema.tables.forEach(table => {
    complexity += table.columns.length;
    
    // FK columns add more complexity
    const fkColumns = table.columns.filter(col => 
      col.constraints.some(c => c.type === 'FOREIGN KEY')
    );
    complexity += fkColumns.length * 3;
    
    // Complex types add complexity
    table.columns.forEach(col => {
      if (['JSONB', 'JSON', 'ARRAY'].includes(col.type)) {
        complexity += 2;
      }
    });
  });
  
  // Relationship complexity
  complexity += schema.relationships.length * 2;
  
  // Many-to-many relationships are more complex
  const manyToManyCount = schema.relationships.filter(rel => 
    rel.type === 'many-to-many'
  ).length;
  complexity += manyToManyCount * 3;
  
  return Math.max(1, complexity);
}

function generateMockSeedingLogic(schema: DatabaseSchema): string {
  // Generate a realistic mock response based on the schema
  const tableNames = schema.tables.map(t => t.name);
  const relationships = schema.relationships;
  
  return `
## 1. TABLE_PROCESSORS
\`\`\`typescript
// Table processing order based on dependencies
const TABLE_PROCESSING_ORDER = ${JSON.stringify(tableNames)};

const filterDataForTable = (data: any[], tableName: string): any[] => {
  console.log(\`Filtering \${data.length} rows for table: \${tableName}\`);
  
  // Filter data based on table-specific logic
  switch (tableName) {
    ${tableNames.map(tableName => `
    case '${tableName}':
      return data.filter(row => {
        // Basic validation for ${tableName}
        return row && typeof row === 'object';
      });`).join('')}
    default:
      return data;
  }
};
\`\`\`

## 2. COLUMN_MAPPERS
\`\`\`typescript
const mapCSVToTableColumns = (csvRow: any, tableName: string): any => {
  const mapped: any = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Table-specific mapping logic
  switch (tableName) {
    ${schema.tables.map(table => `
    case '${table.name}':
      ${table.columns.filter(col => !['id', 'created_at', 'updated_at'].includes(col.name))
        .map(col => `
      mapped.${col.name} = convertValue(csvRow['${col.name}'] || csvRow['${col.name.toUpperCase()}'], '${col.name}', '${col.type}');`)
        .join('')}
      break;`).join('')}
  }
  
  return mapped;
};

const convertValue = (value: any, columnName: string, columnType: string): any => {
  if (value === null || value === undefined || value === '') return null;
  
  const str = String(value).trim();
  const type = columnType.toLowerCase();
  
  if (type.includes('int')) {
    const num = parseInt(str);
    return isNaN(num) ? null : num;
  }
  if (type.includes('numeric') || type.includes('decimal')) {
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }
  if (type.includes('bool')) {
    return ['true', '1', 'yes', 'y'].includes(str.toLowerCase());
  }
  if (type.includes('timestamp') || type.includes('date')) {
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  
  return str;
};
\`\`\`

## 3. RELATIONSHIP_RESOLVERS
\`\`\`typescript
class ForeignKeyResolver {
  private cache = new Map<string, string>();
  
  async resolveFK(tableName: string, value: any): Promise<string | null> {
    if (!value) return null;
    
    const cacheKey = \`\${tableName}:\${value}\`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Add actual FK resolution logic here
    return null;
  }
}

const resolveForeignKeys = async (data: any[], tableName: string): Promise<any[]> => {
  const resolver = new ForeignKeyResolver();
  
  // Handle relationships for each table
  ${relationships.map(rel => `
  if (tableName === '${rel.sourceTable}') {
    // Resolve FK for ${rel.sourceColumn} -> ${rel.targetTable}.${rel.targetColumn}
    for (const row of data) {
      if (row.${rel.sourceColumn}) {
        row.${rel.sourceColumn} = await resolver.resolveFK('${rel.targetTable}', row.${rel.sourceColumn});
      }
    }
  }`).join('')}
  
  return data;
};
\`\`\`

## 4. VALIDATION_RULES
\`\`\`typescript
const validateRowForTable = (row: any, tableName: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Table-specific validation
  switch (tableName) {
    ${schema.tables.map(table => `
    case '${table.name}':
      ${table.columns.filter(col => !col.nullable && !['id', 'created_at', 'updated_at'].includes(col.name))
        .map(col => `
      if (!row.${col.name}) {
        errors.push('Missing required field: ${col.name}');
      }`).join('')}
      break;`).join('')}
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateBatch = (batch: any[], tableName: string): { validRows: any[]; invalidRows: any[] } => {
  const validRows: any[] = [];
  const invalidRows: any[] = [];
  
  batch.forEach(row => {
    const validation = validateRowForTable(row, tableName);
    if (validation.isValid) {
      validRows.push(row);
    } else {
      invalidRows.push({ row, errors: validation.errors });
    }
  });
  
  return { validRows, invalidRows };
};
\`\`\`

## 5. CONSTANTS
\`\`\`typescript
const SCHEMA_CONFIG = {
  batchSize: 100,
  maxRetries: 3,
  timeoutMs: 1400,
  tables: ${JSON.stringify(tableNames)},
  relationships: ${JSON.stringify(relationships.map(r => ({ source: r.sourceTable, target: r.targetTable })))}
};

const PERFORMANCE_CONFIG = {
  enableCaching: true,
  logLevel: 'info',
  validateData: true,
  complexityScore: ${schema.tables.length * 2 + schema.relationships.length}
};
\`\`\`
  `;
}

function getPerformanceEstimate(complexity: number, tableCount: number): string {
  if (complexity < 20 && tableCount < 5) return "Excellent";
  if (complexity < 50 && tableCount < 10) return "Good";
  if (complexity < 100 && tableCount < 20) return "Moderate";
  return "Complex - Consider optimization";
}

function buildSeedingLogicPrompt(
  schema: DatabaseSchema, 
  csvMetadata: CSVMetadata[] = [], 
  batchSize: number,
  optimizationLevel: string
): string {
  const tableDetails = schema.tables.map(table => ({
    name: table.name,
    columns: table.columns.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
      constraints: col.constraints.map(c => c.type),
      isFK: col.constraints.some(c => c.type === 'FOREIGN KEY'),
      referencedTable: col.constraints.find(c => c.type === 'FOREIGN KEY')?.referencedTable,
    })),
    comment: table.comment,
  }));

  const relationships = schema.relationships.map(rel => ({
    type: rel.type,
    sourceTable: rel.sourceTable,
    sourceColumn: rel.sourceColumn,
    targetTable: rel.targetTable,
    targetColumn: rel.targetColumn,
  }));

  return `You are an expert TypeScript developer specializing in Supabase Edge Functions and database seeding.

TASK: Generate optimized TypeScript code for seeding CSV data into a PostgreSQL database with the following schema.

SCHEMA INFORMATION:
Tables: ${JSON.stringify(tableDetails, null, 2)}
Relationships: ${JSON.stringify(relationships, null, 2)}

CSV METADATA:
${csvMetadata.length > 0 ? JSON.stringify(csvMetadata, null, 2) : "No CSV metadata provided - generate flexible mapping logic"}

REQUIREMENTS:
1. **Batch Size**: ${batchSize} rows per chunk
2. **Optimization Level**: ${optimizationLevel}
3. **Performance**: Must work within Supabase Edge Function CPU/memory limits
4. **Error Handling**: Graceful degradation with detailed logging
5. **FK Resolution**: Dynamic foreign key relationship handling
6. **Data Validation**: Type-safe data conversion and validation

GENERATE 5 CODE SECTIONS:

## 1. TABLE_PROCESSORS
Generate a table processing order and filtering logic:
\`\`\`typescript
// Table processing order based on dependencies
const TABLE_PROCESSING_ORDER = [...];

// Table-specific data filtering
const filterDataForTable = (data: any[], tableName: string): any[] => {
  // Implementation here
};
\`\`\`

## 2. COLUMN_MAPPERS
Generate intelligent column mapping with fuzzy matching:
\`\`\`typescript
// Column mapping with semantic understanding
const mapCSVToTableColumns = (csvRow: any, tableName: string): any => {
  // Implementation here
};

// Type conversion with validation
const convertValue = (value: any, columnName: string, columnType: string): any => {
  // Implementation here
};
\`\`\`

## 3. RELATIONSHIP_RESOLVERS
Generate FK resolution logic:
\`\`\`typescript
// Foreign key resolution cache
class ForeignKeyResolver {
  // Implementation here
}

// Relationship dependency tracking
const resolveForeignKeys = async (data: any[], tableName: string): Promise<any[]> => {
  // Implementation here
};
\`\`\`

## 4. VALIDATION_RULES
Generate data validation and error handling:
\`\`\`typescript
// Table-specific validation rules
const validateRowForTable = (row: any, tableName: string): { isValid: boolean; errors: string[] } => {
  // Implementation here
};

// Batch validation
const validateBatch = (batch: any[], tableName: string): { validRows: any[]; invalidRows: any[] } => {
  // Implementation here
};
\`\`\`

## 5. CONSTANTS
Generate configuration constants:
\`\`\`typescript
// Schema-specific constants
const SCHEMA_CONFIG = {
  // Implementation here
};

// Performance tuning constants
const PERFORMANCE_CONFIG = {
  // Implementation here
};
\`\`\`

IMPORTANT:
- Use modern TypeScript with proper typing
- Include extensive error handling and logging
- Optimize for Edge Function constraints
- Handle duplicate data gracefully
- Support streaming/chunked processing
- Include progress tracking capabilities
- Make the code maintainable and well-documented

Focus on creating production-ready, efficient code that can handle real-world data seeding scenarios.`;
}

function parseSeedingLogicResponse(generatedCode: string): {
  tableProcessors: string;
  columnMappers: string;
  relationshipResolvers: string;
  validationRules: string;
  constants: string;
} {
  // Extract code sections using regex patterns
  const sections = {
    tableProcessors: extractCodeSection(generatedCode, 'TABLE_PROCESSORS'),
    columnMappers: extractCodeSection(generatedCode, 'COLUMN_MAPPERS'),
    relationshipResolvers: extractCodeSection(generatedCode, 'RELATIONSHIP_RESOLVERS'),
    validationRules: extractCodeSection(generatedCode, 'VALIDATION_RULES'),
    constants: extractCodeSection(generatedCode, 'CONSTANTS'),
  };

  // Validate that we got all sections
  Object.entries(sections).forEach(([key, value]) => {
    if (!value || value.trim().length < 50) {
      console.warn(`Generated ${key} section is too short or missing`);
      sections[key as keyof typeof sections] = getDefaultSection(key);
    }
  });

  return sections;
}

function extractCodeSection(code: string, sectionName: string): string {
  // Look for section headers and extract the TypeScript code blocks
  const sectionRegex = new RegExp(
    `## \\d+\\. ${sectionName}[\\s\\S]*?\`\`\`typescript([\\s\\S]*?)\`\`\``,
    'i'
  );
  
  const match = code.match(sectionRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Fallback: look for just the section name
  const fallbackRegex = new RegExp(
    `${sectionName}[\\s\\S]*?\`\`\`typescript([\\s\\S]*?)\`\`\``,
    'i'
  );
  
  const fallbackMatch = code.match(fallbackRegex);
  if (fallbackMatch && fallbackMatch[1]) {
    return fallbackMatch[1].trim();
  }

  return '';
}

function getDefaultSection(sectionName: string): string {
  const defaults = {
    tableProcessors: `
// Default table processing order
const TABLE_PROCESSING_ORDER = ['properties', 'users', 'categories'];

const filterDataForTable = (data: any[], tableName: string): any[] => {
  console.log(\`Filtering \${data.length} rows for table: \${tableName}\`);
  return data; // Pass through all data by default
};`,

    columnMappers: `
const mapCSVToTableColumns = (csvRow: any, tableName: string): any => {
  const mapped: any = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Basic field mapping
  Object.keys(csvRow).forEach(key => {
    const cleanKey = key.toLowerCase().replace(/\\s+/g, '_');
    if (csvRow[key] !== null && csvRow[key] !== undefined) {
      mapped[cleanKey] = csvRow[key];
    }
  });
  
  return mapped;
};

const convertValue = (value: any, columnName: string, columnType: string): any => {
  if (value === null || value === undefined || value === '') return null;
  
  const str = String(value).trim();
  const type = columnType.toLowerCase();
  
  if (type.includes('int')) {
    const num = parseInt(str);
    return isNaN(num) ? null : num;
  }
  if (type.includes('numeric') || type.includes('decimal')) {
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }
  if (type.includes('bool')) {
    return ['true', '1', 'yes', 'y'].includes(str.toLowerCase());
  }
  if (type.includes('timestamp') || type.includes('date')) {
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  
  return str;
};`,

    relationshipResolvers: `
class ForeignKeyResolver {
  private cache = new Map<string, string>();
  
  async resolveFK(tableName: string, value: any): Promise<string | null> {
    if (!value) return null;
    
    const cacheKey = \`\${tableName}:\${value}\`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // For now, return null - implement actual FK resolution
    return null;
  }
}

const resolveForeignKeys = async (data: any[], tableName: string): Promise<any[]> => {
  const resolver = new ForeignKeyResolver();
  return data; // Pass through for now
};`,

    validationRules: `
const validateRowForTable = (row: any, tableName: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Basic validation
  if (!row.id) {
    errors.push('Missing required id field');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateBatch = (batch: any[], tableName: string): { validRows: any[]; invalidRows: any[] } => {
  const validRows: any[] = [];
  const invalidRows: any[] = [];
  
  batch.forEach(row => {
    const validation = validateRowForTable(row, tableName);
    if (validation.isValid) {
      validRows.push(row);
    } else {
      invalidRows.push({ row, errors: validation.errors });
    }
  });
  
  return { validRows, invalidRows };
};`,

    constants: `
const SCHEMA_CONFIG = {
  batchSize: 100,
  maxRetries: 3,
  timeoutMs: 1400
};

const PERFORMANCE_CONFIG = {
  enableCaching: true,
  logLevel: 'info',
  validateData: true
};`
  };

  return defaults[sectionName as keyof typeof defaults] || '// Default implementation needed';
} 