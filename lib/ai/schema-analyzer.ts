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
        'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'UUID', 'JSONB',
        'JSON', 'ARRAY', 'ENUM'
      ]),
      nullable: z.boolean(),
      length: z.number().optional(),
      precision: z.number().optional(),
      scale: z.number().optional(),
      defaultValue: z.string().optional(),
      constraints: z.array(z.string()),
      reasoning: z.string(),
    })).refine((columns) => {
      // Check for UUID primary key named 'id'
      const idColumn = columns.find(col => col.name === 'id');
      return idColumn && 
             idColumn.type === 'UUID' && 
             idColumn.constraints.some(c => 
               c === 'PRIMARY KEY' || 
               c.includes('PRIMARY KEY') || 
               c.toLowerCase().includes('primary key')
             );
    }, { 
      message: "Table must have a UUID primary key column named 'id'"
    }).refine((columns) => {
      // Check for created_at and updated_at timestamps
      const hasCreatedAt = columns.some(col => 
        col.name === 'created_at' && 
        col.type === 'TIMESTAMPTZ' && 
        !col.nullable
      );
      const hasUpdatedAt = columns.some(col => 
        col.name === 'updated_at' && 
        col.type === 'TIMESTAMPTZ' && 
        !col.nullable
      );
      return hasCreatedAt && hasUpdatedAt;
    }, {
      message: "Table must have non-nullable TIMESTAMPTZ columns 'created_at' and 'updated_at'"
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
    })).min(1, "Each table must have at least one RLS policy"),
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
    try {
      // Optimize data for analysis
      const optimizedResults = this.optimizeDataForAnalysis(csvResults);
      
      // Build and chunk the prompt if needed
      const prompt = this.buildAnalysisPrompt(optimizedResults, options);
      
      const result = await generateObject({
        model: this.model,
        schema: SchemaAnalysisSchema,
        system: this.buildSchemaGenerationSystemPrompt(),
        prompt,
        maxRetries: this.maxRetries,
        temperature: this.temperature,
      });

      // Additional validation for foreign key relationships
      this.validateForeignKeyRelationships(result.object);

      return result.object;
    } catch (error) {
      console.error('AI schema analysis failed:', error);
      // Fallback to rule-based analysis
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
    return `You are a PostgreSQL schema generation system that MUST output ONLY RAW JSON.
DO NOT wrap the output in markdown code blocks.
DO NOT include \`\`\`json or \`\`\` markers.
DO NOT include any explanatory text.
ONLY output the raw JSON object.

Required JSON Structure:
{
  "tables": [
    {
      "name": string,
      "columns": [
        {
          "name": string,
          "type": string,
          "nullable": boolean,
          "constraints": string[],
          "reasoning": string
        }
      ],
      "indexes": [
        {
          "name": string,
          "columns": string[],
          "unique": boolean
        }
      ],
      "rlsPolicies": [
        {
          "name": string,
          "operation": string,
          "definition": string,
          "with_check": string
        }
      ]
    }
  ],
  "relationships": [],
  "confidence": number,
  "reasoning": string
}

CRITICAL REQUIREMENTS:
1. Output MUST be valid JSON
2. DO NOT include markdown formatting
3. DO NOT include backticks or code block markers
4. Every table MUST have these columns in order:
   - id (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
   - created_at (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
   - updated_at (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
5. Every table MUST have RLS policies
6. Every foreign key MUST be UUID type
7. Use snake_case for all names
8. Include confidence score (0-1)
9. Include reasoning as string`;
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
      })),
      totalRows: result.totalRows,
    }));

    return `
Analyze the following CSV data and generate a production-ready database schema.

CRITICAL: Every table MUST start with these EXACT columns in this order:
{
  name: "id",
  type: "UUID",
  nullable: false,
  constraints: ["PRIMARY KEY", "DEFAULT gen_random_uuid()"]
},
{
  name: "created_at",
  type: "TIMESTAMPTZ",
  nullable: false,
  constraints: ["DEFAULT NOW()"]
},
{
  name: "updated_at",
  type: "TIMESTAMPTZ",
  nullable: false,
  constraints: ["DEFAULT NOW()"]
}

CSV Data Summary:
${JSON.stringify(csvSummary, null, 2)}

Target Use Case: ${options.targetUseCase || 'General purpose application'}

${options.includeOptimizations ? `
Additional Requirements:
- Suggest performance optimizations
- Identify normalization opportunities
- Recommend partitioning strategies if applicable
` : ''}

IMPORTANT: Return a valid schema object that matches the required structure exactly.
Each table MUST have:
1. UUID primary key column named 'id'
2. TIMESTAMPTZ columns 'created_at' and 'updated_at'
3. Foreign keys as UUID type with proper references
4. RLS policies with auth.uid() checks
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
            constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'],
            reasoning: 'UUID primary key following PostgreSQL best practices',
          },
          // Map CSV columns
          ...result.columns.map(col => {
            const colName = this.sanitizeColumnName(col.name);
            // Handle special foreign key cases
            const isForeignKey = colName.endsWith('_id');
            const isAuthUserRef = colName === 'user_id';
            
            return {
              name: colName,
              type: isForeignKey ? 'UUID' as const : (col.inferredType || 'TEXT') as PostgresType,
              nullable: col.nullCount > 0,
              constraints: isAuthUserRef 
                ? ['REFERENCES auth.users(id)']
                : isForeignKey && !isAuthUserRef 
                  ? [`REFERENCES ${colName.replace('_id', '')}s(id)`] 
                  : [],
              reasoning: `Inferred from CSV data analysis. ${
                isAuthUserRef 
                  ? 'Supabase auth user reference detected.' 
                  : isForeignKey 
                    ? 'Foreign key relationship detected.' 
                    : ''
              } Null rate: ${(col.nullCount / col.totalCount * 100).toFixed(1)}%`,
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
            definition: 'true',
            reasoning: 'Allow public read access',
          },
          {
            name: `${tableName}_insert_policy`,
            operation: 'INSERT' as const,
            definition: 'auth.uid() IS NOT NULL',
            with_check: 'auth.uid() = user_id',
            reasoning: 'Users can only insert their own records',
          },
          {
            name: `${tableName}_update_policy`,
            operation: 'UPDATE' as const,
            definition: 'auth.uid() = user_id',
            with_check: 'auth.uid() = user_id',
            reasoning: 'Users can only update their own records',
          },
          {
            name: `${tableName}_delete_policy`,
            operation: 'DELETE' as const,
            definition: 'auth.uid() = user_id',
            reasoning: 'Users can only delete their own records',
          },
        ],
        comment: `Generated from CSV file: ${result.fileName}`,
      };
    });

    return {
      confidence: 0.6,
      reasoning: 'Fallback rule-based analysis used due to AI service unavailability',
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

  // Add new validation method
  private validateForeignKeyRelationships(analysis: AISchemaAnalysis) {
    // Build set of table names for quick lookup
    const tableNames = new Set(analysis.tables.map(t => t.name));
    
    for (const table of analysis.tables) {
      for (const rel of table.relationships) {
        // Skip validation for special Supabase schemas
        if (rel.targetTable.startsWith('auth.') || rel.targetTable.startsWith('storage.')) {
          continue;
        }
        
        // Ensure target table exists
        if (!tableNames.has(rel.targetTable)) {
          throw new Error(`Invalid foreign key relationship: target table "${rel.targetTable}" does not exist`);
        }
        
        // Ensure source column exists in current table
        const hasSourceColumn = table.columns.some(c => c.name === rel.sourceColumn);
        if (!hasSourceColumn) {
          throw new Error(`Invalid foreign key relationship: source column "${rel.sourceColumn}" does not exist in table "${table.name}"`);
        }
        
        // Ensure target column exists in target table
        const targetTable = analysis.tables.find(t => t.name === rel.targetTable);
        const hasTargetColumn = targetTable?.columns.some(c => c.name === rel.targetColumn);
        if (!hasTargetColumn) {
          throw new Error(`Invalid foreign key relationship: target column "${rel.targetColumn}" does not exist in table "${rel.targetTable}"`);
        }
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