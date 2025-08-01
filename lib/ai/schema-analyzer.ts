import { google } from '@ai-sdk/google';
import { generateObject, generateText, streamText } from 'ai';
import { z } from 'zod';
import type { 
  CSVParseResult,
  TypeInferenceResult
} from '../../types/csv.types';
import type { PostgresType, DatabaseSchema } from '../../types/schema.types';

// Confidence scoring thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.4,
} as const;

// Schema analysis response schema for structured generation
const SchemaAnalysisSchema = z.object({
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  tables: z.array(z.object({
    name: z.string(),
    columns: z.array(z.object({
      name: z.string(),
      type: z.enum([
        'UUID', 'VARCHAR', 'TEXT', 'CHAR', 'SMALLINT', 'INTEGER', 'BIGINT',
        'NUMERIC', 'DECIMAL', 'REAL', 'DOUBLE PRECISION', 'BOOLEAN',
        'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'JSONB',
        'JSON', 'ARRAY', 'ENUM'
      ]),
      nullable: z.boolean(),
      length: z.number().optional(),
      precision: z.number().optional(),
      scale: z.number().optional(),
      defaultValue: z.string().optional(),
      constraints: z.array(z.string()),
      reasoning: z.string(),
    }).refine((column) => {
      // MINIMAL VALIDATION - Only enforce absolute requirements, let post-processing fix everything else
      const name = column.name.toLowerCase();
      const type = column.type;
      
      // ONLY enforce the absolute minimum requirements that would break the system
      
      // 1. PRIMARY KEY id column MUST be UUID (non-negotiable for Supabase)
      if (name === 'id') {
        if (type !== 'UUID') {
          return false;
        }
      }
      
      // 2. Audit timestamps MUST be TIMESTAMPTZ (critical for audit functionality)
      if (name === 'created_at' || name === 'updated_at') {
        if (type !== 'TIMESTAMPTZ' && type !== 'TIMESTAMP') {
          return false;
        }
      }
      
      // Everything else is allowed - post-processing will fix it
      return true;
    }, {
      message: "Only critical constraints: Primary key 'id' must be UUID, audit timestamps 'created_at'/'updated_at' must be TIMESTAMPTZ"
    })).refine((columns) => {
      // More flexible primary key check - allow id column with UUID type
      const idColumn = columns.find(col => col.name === 'id');
      if (!idColumn) return false;
      
      // Allow UUID type and check for primary key constraint more flexibly
      const isUUID = idColumn.type === 'UUID';
      const hasPrimaryKey = idColumn.constraints.some(c => 
        c.includes('PRIMARY KEY') || 
        c.includes('primary key') || 
        c.includes('Primary Key')
      );
      
      return isUUID && hasPrimaryKey;
    }, { 
      message: "Table must have a UUID primary key column named 'id'"
    }).refine((columns) => {
      // More flexible timestamp validation - allow missing timestamps in some cases
      const hasCreatedAt = columns.some(col => 
        col.name === 'created_at' && 
        (col.type === 'TIMESTAMPTZ' || col.type === 'TIMESTAMP') && 
        !col.nullable
      );
      const hasUpdatedAt = columns.some(col => 
        col.name === 'updated_at' && 
        (col.type === 'TIMESTAMPTZ' || col.type === 'TIMESTAMP') && 
        !col.nullable
      );
      
      // Allow lookup/reference tables to skip timestamps if they're small
      const isLikelyLookupTable = columns.length <= 5 && 
        columns.some(col => col.name.includes('name') || col.name.includes('title'));
      
      return (hasCreatedAt && hasUpdatedAt) || isLikelyLookupTable;
    }, {
      message: "Table should have TIMESTAMPTZ columns 'created_at' and 'updated_at' (except for small lookup tables)"
    }),
    relationships: z.array(z.object({
      type: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
      targetTable: z.string(),
      sourceColumn: z.string(),
      targetColumn: z.string(),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    })),
    indexes: z.array(z.object({
      name: z.string(),
      columns: z.array(z.string()),
      unique: z.boolean(),
      reasoning: z.string(),
    })),
    comment: z.string().optional(),
    rlsPolicies: z.array(z.object({
      name: z.string(),
      operation: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
      definition: z.string(),
      using: z.string().optional(),
      with_check: z.string().optional(),
      reasoning: z.string(),
    }).refine((policy) => {
      // Validate RLS policy structure based on operation type
      if (policy.operation === 'INSERT') {
        // INSERT policies MUST have with_check and MUST NOT have using
        return policy.with_check && policy.with_check.trim() !== '' && !policy.using;
      } else if (policy.operation === 'UPDATE') {
        // UPDATE policies MUST have both using and with_check
        return policy.using && policy.using.trim() !== '' && 
               policy.with_check && policy.with_check.trim() !== '';
      } else {
        // SELECT and DELETE policies MUST have using and MUST NOT have with_check
        return policy.using && policy.using.trim() !== '' && !policy.with_check;
      }
    }, {
      message: "RLS policy structure invalid: INSERT needs with_check only, UPDATE needs both using and with_check, SELECT/DELETE need using only"
    })).optional().default([]),
  })),
  suggestions: z.array(z.object({
    type: z.enum(['optimization', 'normalization', 'data-quality', 'best-practice']),
    description: z.string(),
    impact: z.enum(['low', 'medium', 'high']),
    reasoning: z.string(),
    actionable: z.boolean(),
  })),
});

export type AISchemaAnalysis = z.infer<typeof SchemaAnalysisSchema>;

interface ColumnStatistics {
  uniqueCount: number;
  nullRatio: number;
  patterns: string[];
}

/**
 * Core AI Schema Analyzer using Google Gemini 2.0 Flash
 * 
 * RECENT CHANGES (Nullability Leniency):
 * - Updated system prompt to emphasize nullable columns by default
 * - Relaxed NOT NULL constraints to avoid data seeding issues
 * - Changed thresholds from 5% to 1% null tolerance
 * - Added guidance to only use NOT NULL for critical fields
 * - Made fallback analysis more permissive with nullability
 */
export class SchemaAnalyzer {
  private model;
  private readonly temperature = 0.3; // Consistent schema generation
  private readonly maxRetries = 3;
  private readonly maxSampleSize = 1000; // Limit sample size for large datasets

  constructor() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is required');
    }
    
    this.model = google('gemini-2.5-flash-preview-04-17');
  }

  /**
   * Analyze CSV data and generate PostgreSQL schema with AI assistance
   */
  async analyzeSchema(
    csvResults: CSVParseResult[], 
    options: {
      streaming?: boolean;
      includeOptimizations?: boolean;
      targetUseCase?: string;
    } = {}
  ): Promise<AISchemaAnalysis> {
    console.log(`🤖 Starting AI schema analysis for ${csvResults.length} CSV files`);
    console.log(`📊 Total columns across all files: ${csvResults.reduce((sum, csv) => sum + csv.columns.length, 0)}`);
    
    try {
      // Optimize data for analysis
      const optimizedResults = this.optimizeDataForAnalysis(csvResults);
      console.log(`✅ Data optimization complete`);
      
      // Build and chunk the prompt if needed
      const prompt = this.buildAnalysisPrompt(optimizedResults, options);
      console.log(`📝 Analysis prompt built (${prompt.length} characters)`);
      
      const result = await generateObject({
        model: this.model,
        schema: SchemaAnalysisSchema,
        system: this.buildSchemaGenerationSystemPrompt(),
        prompt,
        maxRetries: this.maxRetries,
        temperature: this.temperature,
      });

      console.log(`🎉 AI analysis successful! Generated ${result.object.tables.length} tables`);
      console.log(`📈 Confidence score: ${result.object.confidence}`);
      console.log(`🔗 Total relationships: ${result.object.tables.reduce((sum, t) => sum + t.relationships.length, 0)}`);

      // Log the full AI-generated JSON for debugging
/*       console.log('\n🔍 FULL AI-GENERATED SCHEMA JSON:');
      console.log('=====================================');
      console.log(JSON.stringify(result.object, null, 2));
      console.log('=====================================\n'); */

      // Additional validation for foreign key relationships (but don't fail on errors)
      try {
        this.validateForeignKeyRelationships(result.object);
        console.log(`✅ Foreign key validation passed`);
      } catch (validationError) {
        console.warn(`⚠️  Foreign key validation warning:`, validationError);
        // Don't fail the entire analysis for validation issues
      }

      return result.object;
    } catch (error) {
      console.error('❌ AI schema analysis failed:', error);
      
      // Log specific error details for debugging
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        if (error.stack) {
          console.error('Error stack:', error.stack.split('\n').slice(0, 5).join('\n'));
        }
      }
      
      // Try to extract more specific error information
      if (error && typeof error === 'object') {
        console.error('Error details:', JSON.stringify(error, null, 2));
      }
      
      console.log('🔄 Falling back to rule-based analysis...');
      return this.fallbackAnalysis(csvResults);
    }
  }

  /**
   * Optimize CSV data for analysis by limiting sample size and removing redundant data
   */
  private optimizeDataForAnalysis(csvResults: CSVParseResult[]): CSVParseResult[] {
    return csvResults.map(result => ({
      ...result,
      // Limit sample size while maintaining data distribution
      sampleData: this.getOptimalSample(result.data, this.maxSampleSize),
      columns: result.columns.map(col => ({
        ...col,
        // Optimize sample values
        sampleValues: Array.from(new Set(col.sampleValues))
          .filter(val => val !== null)
          .slice(0, 5),
        // Calculate statistics once
        statistics: this.calculateColumnStatistics(col),
      })),
    }));
  }

  /**
   * Get an optimal sample of rows that maintains data distribution
   */
  private getOptimalSample(data: (string | null)[][], maxSize: number): (string | null)[][] {
    if (data.length <= maxSize) return data;

    const step = Math.ceil(data.length / maxSize);
    return data.filter((_, index) => index % step === 0);
  }

  /**
   * Calculate column statistics for better type inference
   */
  private calculateColumnStatistics(column: { 
    sampleValues: (string | null)[]; 
    nullCount: number; 
    totalCount: number;
  }): ColumnStatistics {
    const values = column.sampleValues.filter((v): v is string => v !== null);
    return {
      uniqueCount: new Set(values).size,
      nullRatio: column.nullCount / column.totalCount,
      patterns: this.detectDataPatterns(values),
    };
  }

  /**
   * Detect common data patterns in column values
   */
  private detectDataPatterns(values: string[]): string[] {
    const patterns: string[] = [];
    
    // Date pattern
    if (values.some(v => !isNaN(Date.parse(v)))) {
      patterns.push('date');
    }
    
    // UUID pattern
    if (values.some(v => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v))) {
      patterns.push('uuid');
    }
    
    // Email pattern
    if (values.some(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) {
      patterns.push('email');
    }
    
    // URL pattern
    if (values.some(v => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v))) {
      patterns.push('url');
    }
    
    // JSON pattern
    if (values.some(v => {
      try {
        JSON.parse(v);
        return true;
      } catch {
        return false;
      }
    })) {
      patterns.push('json');
    }

    return patterns;
  }

  private cleanMarkdownFromJson(text: string): string {
    // Remove markdown code block syntax and any surrounding whitespace
    return text
      .replace(/^[\s\n]*```[a-z]*\n/g, '') // Remove opening code block
      .replace(/\n```[\s\n]*$/g, '')       // Remove closing code block
      .trim();
  }

  private buildSchemaGenerationSystemPrompt(): string {
    return `You are an expert PostgreSQL database architect that analyzes CSV data and designs normalized, production-ready schemas.

CORE PRINCIPLES:
1. NORMALIZE DATA: Split wide CSV tables into multiple related tables following 3NF principles
2. IDENTIFY ENTITIES: Look for distinct business entities that should be separate tables
3. CREATE RELATIONSHIPS: Use foreign keys to link related data between tables
4. AVOID REDUNDANCY: Move repeated data into lookup/reference tables
5. BE LENIENT WITH NULLABILITY: Design for easy data import and real-world data imperfections

WHEN TO SPLIT TABLES:
- Columns that represent different entities (e.g., user info + order info + product info)
- Repeated values that could be normalized (e.g., categories, statuses, locations)
- Large tables with >15-20 columns should usually be split
- One-to-many relationships (e.g., user has many orders)

NULLABILITY GUIDANCE:
- DEFAULT TO NULLABLE: Most columns should allow NULL values for easier data import
- ONLY use NOT NULL for:
  * Primary keys (id columns)
  * Audit columns (created_at, updated_at)
  * Absolutely essential business fields that are guaranteed to have values
- AVOID NOT NULL for user-provided data, optional fields, or any field that might be missing during import
- REMEMBER: It's easier to add NOT NULL later than to deal with import failures

TYPE SELECTION STRATEGY:
🎯 FOCUS ON STRUCTURE: The system automatically optimizes types after generation, so prioritize getting the schema structure and relationships right.

ONLY 2 REQUIREMENTS (everything else is flexible):
1. PRIMARY KEY 'id' MUST be UUID type with DEFAULT uuid_generate_v4()
2. AUDIT TIMESTAMPS 'created_at' and 'updated_at' MUST be TIMESTAMPTZ type

EVERYTHING ELSE: Use your best judgment, but TEXT is always safe!
- Foreign keys: TEXT, VARCHAR, or UUID - all work (system will optimize)
- Coordinates: TEXT, DECIMAL, or NUMERIC - all work (system will optimize)
- Years: TEXT, SMALLINT, or INTEGER - all work (system will optimize)  
- Booleans: TEXT or BOOLEAN - both work (system will optimize)
- Emails: TEXT or VARCHAR - both work (system will optimize)
- Numbers: TEXT, INTEGER, or DECIMAL - all work (system will optimize)

🚀 KEY INSIGHT: The post-processing system will automatically correct all column types based on naming patterns and data characteristics. Your job is to create the right table structure and relationships!

RLS POLICY REQUIREMENTS:
- Create policies for ALL operations: SELECT, INSERT, UPDATE, DELETE
- Use Supabase Auth patterns: auth.uid(), auth.role(), auth.jwt()
- Follow security best practices for multi-tenant applications
- Consider data ownership patterns (user_id columns)

RLS POLICY STRUCTURE (CRITICAL):
🚨 POLICY OPERATION RULES:
- INSERT policies: ONLY "with_check" field, NO "using" field
- UPDATE policies: BOTH "using" AND "with_check" fields  
- SELECT policies: ONLY "using" field, NO "with_check" field
- DELETE policies: ONLY "using" field, NO "with_check" field

RLS POLICY PATTERNS:
- User-owned data: auth.uid() = user_id
- Public read data: true (for SELECT only)
- Admin-only data: auth.role() = 'admin'
- Authenticated users: auth.uid() IS NOT NULL

OUTPUT FORMAT: Return ONLY valid JSON (no markdown, no backticks, no explanations).

Required JSON Structure:
{
  "confidence": number (0-1),
  "reasoning": "Explain your normalization decisions and nullability choices",
  "tables": [
    {
      "name": "table_name",
      "columns": [
        {
          "name": "id",
          "type": "UUID",
          "nullable": false,
          "constraints": ["PRIMARY KEY", "DEFAULT uuid_generate_v4()"],
          "reasoning": "Primary key"
        },
        {
          "name": "user_id",
          "type": "UUID",
          "nullable": true,
          "constraints": ["FOREIGN KEY REFERENCES auth.users(id)"],
          "reasoning": "Links record to user for RLS"
        },
        {
          "name": "column_name",
          "type": "VARCHAR|TEXT|INTEGER|DECIMAL|SMALLINT|etc",
          "nullable": true,  // DEFAULT TO TRUE for most columns
          "length": number (optional),
          "precision": number (optional),
          "scale": number (optional),
          "constraints": ["FOREIGN KEY", "UNIQUE", etc],
          "reasoning": "Why this column exists and why it's nullable/not nullable"
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "nullable": false,
          "constraints": ["DEFAULT NOW()"],
          "reasoning": "Audit timestamp"
        },
        {
          "name": "updated_at", 
          "type": "TIMESTAMPTZ",
          "nullable": false,
          "constraints": ["DEFAULT NOW()"],
          "reasoning": "Audit timestamp"
        }
      ],
      "relationships": [
        {
          "type": "one-to-many|many-to-one|many-to-many",
          "targetTable": "other_table",
          "sourceColumn": "foreign_key_column",
          "targetColumn": "id",
          "confidence": number,
          "reasoning": "Why this relationship exists"
        }
      ],
      "indexes": [
        {
          "name": "idx_table_column",
          "columns": ["column_name"],
          "unique": boolean,
          "reasoning": "Performance or uniqueness reason"
        }
      ],
      "rlsPolicies": [
        {
          "name": "table_select_policy",
          "operation": "SELECT",
          "using": "auth.uid() = user_id",
          "reasoning": "Users can read their own records"
        },
        {
          "name": "table_insert_policy", 
          "operation": "INSERT",
          "with_check": "auth.uid() = user_id",
          "reasoning": "Users can only insert their own records"
        },
        {
          "name": "table_update_policy",
          "operation": "UPDATE", 
          "using": "auth.uid() = user_id",
          "with_check": "auth.uid() = user_id",
          "reasoning": "Users can only update their own records"
        },
        {
          "name": "table_delete_policy",
          "operation": "DELETE",
          "using": "auth.uid() = user_id", 
          "reasoning": "Users can only delete their own records"
        }
      ]
    }
  ],
  "suggestions": [
    {
      "type": "normalization|optimization|data-quality|best-practice",
      "description": "Suggestion text",
      "impact": "low|medium|high",
      "reasoning": "Why this suggestion matters",
      "actionable": boolean
    }
  ]
}

CRITICAL REQUIREMENTS:
- Every table MUST have: id (UUID PRIMARY KEY), created_at, updated_at
- Include user_id (UUID) column when user ownership is needed for RLS
- Foreign keys MUST be UUID type and reference existing tables
- Use snake_case for all names
- Include ALL 4 RLS policies (SELECT, INSERT, UPDATE, DELETE) per table
- Use appropriate Supabase Auth patterns in RLS policies
- DEFAULT TO NULLABLE for most columns to avoid data import issues
- Use proper PostgreSQL types (UUID for IDs, TIMESTAMPTZ for timestamps, etc.)
- Provide clear reasoning for design decisions
- Output valid JSON only (no markdown formatting)`;
  }

  /**
   * Stream schema analysis for real-time feedback
   */
  async streamSchemaAnalysis(
    csvResults: CSVParseResult[],
    options: { targetUseCase?: string } = {}
  ) {
    const prompt = this.buildStreamingPrompt(csvResults, options);
    const cleanMarkdownFromJson = this.cleanMarkdownFromJson.bind(this);

    try {
      const stream = await streamText({
        model: this.model,
        system: this.buildSchemaGenerationSystemPrompt(),
        prompt,
        maxRetries: this.maxRetries,
        temperature: this.temperature,
      });

      // Create a transform stream that cleans markdown from the output
      const cleanStream = {
        textStream: {
          async *[Symbol.asyncIterator](): AsyncGenerator<string> {
            for await (const chunk of stream.textStream) {
              yield cleanMarkdownFromJson(chunk);
            }
          }
        },
        usage: stream.usage
      };

      return cleanStream;
    } catch (error) {
      console.error('AI streaming analysis failed:', error);
      throw error;
    }
  }

  /**
   * Refine schema based on natural language feedback
   */
  async refineSchema(
    currentSchema: DatabaseSchema,
    userFeedback: string,
    context?: { csvResults?: CSVParseResult[] }
  ): Promise<{
    refinedSchema: Partial<DatabaseSchema>;
    reasoning: string;
    confidence: number;
  }> {
    const prompt = this.buildRefinementPrompt(currentSchema, userFeedback, context);

    try {
      const result = await generateText({
        model: this.model,
        system: this.buildSchemaGenerationSystemPrompt(),
        prompt,
        maxRetries: this.maxRetries,
        temperature: this.temperature,
      });

      // Parse the refinement result
      return this.parseRefinementResult(result.text);
    } catch (error) {
      console.error('AI schema refinement failed:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive analysis prompt for structured generation
   */
  private buildAnalysisPrompt(
    csvResults: CSVParseResult[], 
    options: {
      includeOptimizations?: boolean;
      targetUseCase?: string;
    }
  ): string {
    const csvSummary = csvResults.map(result => ({
      fileName: result.fileName,
      columns: result.columns.map(col => ({
        name: col.name,
        sampleValues: col.sampleValues.slice(0, 5),
        inferredType: col.inferredType,
        nullCount: col.nullCount,
        totalCount: col.totalCount,
        uniqueRatio: col.sampleValues.length / Math.max(col.totalCount, 1),
      })),
      totalRows: result.totalRows,
      totalColumns: result.columns.length,
    }));

    const hasLargeTables = csvSummary.some(csv => csv.totalColumns > 10);
    const potentialEntities = csvSummary.flatMap(csv => 
      csv.columns
        .filter(col => col.name.includes('name') || col.name.includes('title') || col.name.includes('type'))
        .map(col => ({ table: csv.fileName, column: col.name, samples: col.sampleValues }))
    );

    return `
TASK: Analyze CSV data and create a NORMALIZED database schema with MULTIPLE RELATED TABLES.

CSV Data Analysis:
${JSON.stringify(csvSummary, null, 2)}

${hasLargeTables ? `
🔍 NORMALIZATION REQUIRED: Detected tables with ${csvSummary.find(c => c.totalColumns > 10)?.totalColumns}+ columns.
MUST split into multiple related tables following database normalization principles.
` : ''}

${potentialEntities.length > 0 ? `
🎯 DETECTED ENTITIES: Consider creating separate tables for:
${potentialEntities.map(e => `- ${e.column} (from ${e.table}): ${e.samples.slice(0, 3).join(', ')}`).join('\n')}
` : ''}

DESIGN STRATEGY:
1. 📊 ANALYZE: Look for distinct business entities in the data
2. 🔄 NORMALIZE: Split wide tables into focused, related tables  
3. 🔗 RELATE: Create foreign key relationships between tables
4. 🎯 OPTIMIZE: Design for the target use case: "${options.targetUseCase || 'General purpose application'}"

SPECIFIC INSTRUCTIONS:
- If a CSV has >10 columns, SPLIT it into 2-4 related tables
- Look for repeated values that should become lookup tables
- Identify entity relationships (user→orders, product→categories, etc.)
- Create foreign keys between related tables
- Each table gets: id (UUID PRIMARY KEY), created_at, updated_at
- Add meaningful indexes for common query patterns

${options.includeOptimizations ? `
OPTIMIZATION FOCUS:
- Performance indexes for foreign keys and frequently queried columns
- Consider partitioning for large datasets
- Suggest views for complex queries
` : ''}

OUTPUT: Valid JSON schema with multiple normalized tables and their relationships.
`.trim();
  }

  /**
   * Build streaming prompt for real-time analysis
   */
  private buildStreamingPrompt(
    csvResults: CSVParseResult[],
    options: { targetUseCase?: string }
  ): string {
    return `
Analyze the following CSV data step-by-step and provide real-time feedback on schema generation:

${JSON.stringify(csvResults.map(r => ({
  fileName: r.fileName,
  columns: r.columns.slice(0, 10), // Limit for streaming
  totalRows: r.totalRows,
})), null, 2)}

Target Use Case: ${options.targetUseCase || 'General purpose application'}

Please provide your analysis in the following format:
1. **Data Overview**: Brief summary of the CSV structure
2. **Table Design**: Proposed table structure with reasoning
3. **Relationships**: Identified relationships between tables
4. **Optimizations**: Performance and design recommendations
5. **Validation**: Data quality observations and suggestions

Be concise but thorough in your explanations.
    `.trim();
  }

  /**
   * Build refinement prompt for natural language feedback
   */
  private buildRefinementPrompt(
    currentSchema: DatabaseSchema,
    userFeedback: string,
    context?: { csvResults?: CSVParseResult[] }
  ): string {
    return `
Current Schema:
${JSON.stringify(currentSchema, null, 2)}

User Feedback: "${userFeedback}"

${context?.csvResults ? `
Original CSV Context:
${JSON.stringify(context.csvResults.map(r => ({
  fileName: r.fileName,
  columns: r.columns.map(c => ({ name: c.name, type: c.inferredType })),
})), null, 2)}
` : ''}

Please refine the schema based on the user's feedback. Provide:
1. Specific changes to make
2. Reasoning for each change
3. Confidence level (0-1) for the refinement
4. Any potential issues or trade-offs

Format your response as JSON with the following structure:
{
  "changes": [...],
  "reasoning": "...",
  "confidence": 0.0-1.0,
  "warnings": [...]
}
    `.trim();
  }

  /**
   * Parse refinement result from AI response
   */
  private parseRefinementResult(response: string): {
    refinedSchema: Partial<DatabaseSchema>;
    reasoning: string;
    confidence: number;
  } {
    try {
      // Extract JSON from response if it's embedded in text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        refinedSchema: parsed.changes || {},
        reasoning: parsed.reasoning || 'No specific reasoning provided',
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.error('Failed to parse refinement result:', error);
      return {
        refinedSchema: {},
        reasoning: 'Failed to parse AI response',
        confidence: 0.1,
      };
    }
  }

  /**
   * Fallback to rule-based analysis when AI fails
   */
  private fallbackAnalysis(csvResults: CSVParseResult[]): AISchemaAnalysis {
    console.warn('Using fallback rule-based analysis');
    
    const tables = csvResults.map(result => {
      const tableName = this.sanitizeTableName(result.fileName);
      
      return {
        name: tableName,
        columns: [
          // Always add UUID primary key
          {
            name: 'id',
            type: 'UUID' as const,
            nullable: false,
            constraints: ['PRIMARY KEY', 'DEFAULT uuid_generate_v4()'],
            reasoning: 'UUID primary key following PostgreSQL best practices',
          },
          // Add user_id for RLS if not present
          {
            name: 'user_id',
            type: 'UUID' as const,
            nullable: true,
            constraints: ['REFERENCES auth.users(id)'],
            reasoning: 'Links record to user for RLS policies and data ownership',
          },
                    // Map CSV columns with improved type detection
          ...result.columns
            .filter(col => {
              const colName = this.sanitizeColumnName(col.name);
              return colName !== 'id' && colName !== 'user_id';
            })
            .map(col => {
              const colName = this.sanitizeColumnName(col.name);
              
              // Improved type detection
              let type: PostgresType = 'TEXT';
              const constraints: string[] = [];
              let precision: number | undefined;
              let scale: number | undefined;
              let length: number | undefined;
              
              // Check for foreign key patterns
              const isForeignKey = colName.endsWith('_id') && colName !== 'user_id';
              
              if (isForeignKey) {
                type = 'UUID';
                constraints.push(`REFERENCES ${colName.replace('_id', '')}s(id)`);
              } else if (colName.includes('email')) {
                type = 'VARCHAR';
                length = 255;
              } else if (colName.includes('year') || colName.includes('count') || colName.includes('number')) {
                type = 'SMALLINT';
              } else if (colName.includes('latitude') || colName.includes('longitude')) {
                type = 'DECIMAL';
                precision = 10;
                scale = 6;
              } else if (colName.includes('price') || colName.includes('amount') || colName.includes('cost')) {
                type = 'NUMERIC';
                precision = 10;
                scale = 2;
              } else if (col.inferredType === 'INTEGER') {
                type = 'INTEGER';
              } else if (col.inferredType === 'BOOLEAN') {
                type = 'BOOLEAN';
              } else if (col.inferredType && col.inferredType !== 'TEXT') {
                type = col.inferredType as PostgresType;
              }
              
              return {
                name: colName,
                type,
                nullable: col.nullCount > 0 || col.nullCount / col.totalCount > 0.01,
                ...(length && { length }),
                ...(precision && { precision }),
                ...(scale && { scale }),
                constraints,
                reasoning: `Inferred from CSV data analysis. ${
                  isForeignKey 
                    ? 'Foreign key relationship detected.' 
                    : ''
                } Null rate: ${(col.nullCount / col.totalCount * 100).toFixed(1)}% - Made nullable for easier data import`,
              };
            }),
          // Add timestamps
          {
            name: 'created_at',
            type: 'TIMESTAMPTZ' as const,
            nullable: false,
            constraints: ['DEFAULT NOW()'],
            reasoning: 'Standard audit timestamp',
          },
          {
            name: 'updated_at',
            type: 'TIMESTAMPTZ' as const,
            nullable: false,
            constraints: ['DEFAULT NOW()'],
            reasoning: 'Standard audit timestamp',
          },
        ],
        relationships: [],
        indexes: [
          {
            name: `idx_${tableName}_user_id`,
            columns: ['user_id'],
            unique: false,
            reasoning: 'Performance index for user-based queries and RLS policies',
          },
          {
            name: `idx_${tableName}_created_at`,
            columns: ['created_at'],
            unique: false,
            reasoning: 'Common query pattern for timestamp-based filtering',
          },
        ],
        rlsPolicies: [
          {
            name: `${tableName}_select_policy`,
            operation: 'SELECT' as const,
            definition: 'auth.uid() = user_id',
            using: 'auth.uid() = user_id',
            reasoning: 'Users can read their own records',
          },
          {
            name: `${tableName}_insert_policy`,
            operation: 'INSERT' as const,
            definition: 'auth.uid() = user_id',
            with_check: 'auth.uid() = user_id',
            reasoning: 'Users can only insert their own records',
          },
          {
            name: `${tableName}_update_policy`,
            operation: 'UPDATE' as const,
            definition: 'auth.uid() = user_id',
            using: 'auth.uid() = user_id',
            with_check: 'auth.uid() = user_id',
            reasoning: 'Users can only update their own records',
          },
          {
            name: `${tableName}_delete_policy`,
            operation: 'DELETE' as const,
            definition: 'auth.uid() = user_id',
            using: 'auth.uid() = user_id',
            reasoning: 'Users can only delete their own records',
          },
        ],
        comment: `Generated from CSV file: ${result.fileName}`,
      };
    });

    return {
      confidence: 0.6,
      reasoning: 'FALLBACK: Rule-based analysis used due to AI service failure. Tables were not normalized or split. Added user_id columns and proper RLS policies for user ownership.',
      tables,
      suggestions: [
        {
          type: 'best-practice',
          description: 'Review and adjust data types based on your specific use case',
          impact: 'medium',
          reasoning: 'Rule-based inference may not capture all nuances of your data',
          actionable: true,
        },
        {
          type: 'data-quality',
          description: 'Validate nullable columns and add appropriate constraints',
          impact: 'high',
          reasoning: 'Data quality constraints ensure database integrity',
          actionable: true,
        },
        {
          type: 'normalization',
          description: 'Consider normalizing tables if they contain multiple entities',
          impact: 'high',
          reasoning: 'AI analysis was not available to perform automatic normalization',
          actionable: true,
        },
      ],
    };
  }

  /**
   * Sanitize table name for PostgreSQL
   */
  private sanitizeTableName(fileName: string): string {
    return fileName
      .replace(/\.[^.]+$/, '') // Remove extension
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&'); // Prefix numbers with underscore
  }

  /**
   * Sanitize column name for PostgreSQL
   */
  private sanitizeColumnName(columnName: string): string {
    return columnName
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&'); // Prefix numbers with underscore
  }

  // Add new validation method - now more lenient and informative
  private validateForeignKeyRelationships(analysis: AISchemaAnalysis) {
    // Build set of table names for quick lookup
    const tableNames = new Set(analysis.tables.map(t => t.name));
    const issues: string[] = [];
    
    for (const table of analysis.tables) {
      for (const rel of table.relationships) {
        // Skip validation for special Supabase schemas
        if (rel.targetTable.startsWith('auth.') || rel.targetTable.startsWith('storage.')) {
          continue;
        }
        
        // Check if target table exists
        if (!tableNames.has(rel.targetTable)) {
          issues.push(`Table "${table.name}": target table "${rel.targetTable}" does not exist in schema`);
          continue; // Skip further validation for this relationship
        }
        
        // Check if source column exists in current table
        const hasSourceColumn = table.columns.some(c => c.name === rel.sourceColumn);
        if (!hasSourceColumn) {
          issues.push(`Table "${table.name}": source column "${rel.sourceColumn}" does not exist`);
        }
        
        // Check if target column exists in target table
        const targetTable = analysis.tables.find(t => t.name === rel.targetTable);
        const hasTargetColumn = targetTable?.columns.some(c => c.name === rel.targetColumn);
        if (!hasTargetColumn) {
          issues.push(`Table "${table.name}": target column "${rel.targetColumn}" does not exist in table "${rel.targetTable}"`);
        }
      }
    }
    
    // Log issues but don't throw errors that would break the analysis
    if (issues.length > 0) {
      console.warn('🔍 Foreign key relationship issues found:');
      issues.forEach(issue => console.warn(`  - ${issue}`));
      
      // Only throw if there are critical issues that would break the schema
      const criticalIssues = issues.filter(issue => 
        issue.includes('does not exist in schema') || 
        issue.includes('source column') && issue.includes('does not exist')
      );
      
      if (criticalIssues.length > 3) { // Allow some flexibility
        throw new Error(`Too many critical foreign key issues: ${criticalIssues.join('; ')}`);
      }
    }
  }
}

/**
 * Calculate confidence score based on data quality metrics
 */
export function calculateConfidenceScore(
  typeInference: TypeInferenceResult,
  dataQuality: {
    nullPercentage: number;
    consistencyScore: number;
    sampleSize: number;
  }
): number {
  const typeConfidence = typeInference.confidence;
  const qualityScore = (1 - dataQuality.nullPercentage / 100) * dataQuality.consistencyScore;
  const sampleSizeScore = Math.min(dataQuality.sampleSize / 1000, 1); // Cap at 1000 samples
  
  return (typeConfidence * 0.5 + qualityScore * 0.3 + sampleSizeScore * 0.2);
}

/**
 * Validate AI analysis results
 */
export function validateAIAnalysis(analysis: AISchemaAnalysis): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check confidence scores
  if (analysis.confidence < CONFIDENCE_THRESHOLDS.LOW) {
    issues.push('Overall confidence score is too low');
  }

  // Validate table structure
  for (const table of analysis.tables) {
    if (!table.name || table.name.length === 0) {
      issues.push(`Table missing name`);
    }

    if (table.columns.length === 0) {
      issues.push(`Table ${table.name} has no columns`);
    }

    // Check for primary key
    const hasPrimaryKey = table.columns.some(col => 
      col.constraints.some(constraint => constraint.includes('PRIMARY KEY'))
    );
    if (!hasPrimaryKey) {
      issues.push(`Table ${table.name} missing primary key`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}