'use client';

import { SchemaAnalyzer, type AISchemaAnalysis } from './schema-analyzer';
import type { CSVValidationResult } from '../csv/validator';
import type { CSVParseResult } from '../../types/csv.types';
import type { DatabaseSchema, PostgresType, ConstraintType, RLSPolicy } from '../../types/schema.types';
import { generateId } from '../utils/index';

export interface OptimizationSuggestion {
  id: string;
  type: 'performance' | 'normalization' | 'data-quality' | 'security' | 'best-practice';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  autoApplicable: boolean;
  confidence: number;
  category: string;
  technicalDetails: {
    reasoning: string;
    implementation: string;
    beforeAfter?: {
      before: string;
      after: string;
    };
    relatedTables?: string[];
    estimatedImpact?: {
      performance: number; // 0-100
      storage: number; // 0-100
      maintenance: number; // 0-100
    };
  };
  code?: {
    sql: string;
    explanation: string;
  };
}

export interface SchemaOptimizationResult {
  originalSchema: DatabaseSchema;
  optimizedSchema: DatabaseSchema;
  suggestions: OptimizationSuggestion[];
  summary: {
    totalSuggestions: number;
    criticalIssues: number;
    autoApplicableCount: number;
    estimatedPerformanceGain: number;
    confidenceScore: number;
  };
  aiAnalysis: AISchemaAnalysis;
}

export interface OptimizationOptions {
  includePerformance?: boolean;
  includeNormalization?: boolean;
  includeSecurity?: boolean;
  includeBestPractices?: boolean;
  targetUseCase?: 'web-app' | 'analytics' | 'api' | 'general';
  performanceProfile?: 'read-heavy' | 'write-heavy' | 'balanced';
  expectedScale?: 'small' | 'medium' | 'large' | 'enterprise';
  customConstraints?: {
    maxTableCount?: number;
    requireAuditFields?: boolean;
    enforceNamingConventions?: boolean;
  };
}

interface AISuggestion {
  type: 'optimization' | 'normalization' | 'data-quality' | 'best-practice';
  description: string;
  impact: 'low' | 'medium' | 'high';
  reasoning: string;
  actionable: boolean;
}

interface SchemaRefinementResult {
  refinedSchema: Partial<DatabaseSchema>;
  reasoning: string;
  confidence: number;
}

/**
 * Advanced schema optimizer that uses AI analysis and rule-based optimization
 */
export class SchemaOptimizer {
  private analyzer: SchemaAnalyzer;

  constructor() {
    this.analyzer = new SchemaAnalyzer();
  }

  /**
   * Optimize schema based on CSV validation results and AI analysis
   */
  async optimizeSchema(
    validationResults: CSVValidationResult[],
    options: OptimizationOptions = {}
  ): Promise<SchemaOptimizationResult> {
    // Convert CSV validation results to format expected by AI analyzer
    const csvParseResults = this.convertValidationToParseResults(validationResults);

    // Get AI analysis
    const aiAnalysis = await this.analyzer.analyzeSchema(csvParseResults, {
      includeOptimizations: true,
      targetUseCase: this.getUseCaseDescription(options),
    });

    // Convert AI analysis to our schema format
    const originalSchema = this.convertAIAnalysisToSchema(aiAnalysis);

    // Generate optimization suggestions
    const suggestions = await this.generateOptimizationSuggestions(
      originalSchema,
      aiAnalysis,
      validationResults,
      options
    );

    // Apply auto-applicable optimizations
    const optimizedSchema = this.applyAutoOptimizations(originalSchema, suggestions);

    // Calculate summary metrics
    const summary = this.calculateOptimizationSummary(suggestions);

    return {
      originalSchema,
      optimizedSchema,
      suggestions,
      summary,
      aiAnalysis,
    };
  }

  /**
   * Refine schema based on user feedback
   */
  async refineSchema(
    currentSchema: DatabaseSchema,
    userFeedback: string,
    context?: {
      validationResults?: CSVValidationResult[];
      previousSuggestions?: OptimizationSuggestion[];
    }
  ): Promise<{
    refinedSchema: DatabaseSchema;
    newSuggestions: OptimizationSuggestion[];
    reasoning: string;
    confidence: number;
  }> {
    const csvContext = context?.validationResults 
      ? this.convertValidationToParseResults(context.validationResults)
      : undefined;

    const refinementResult = await this.analyzer.refineSchema(
      currentSchema,
      userFeedback,
      csvContext ? { csvResults: csvContext } : undefined
    );

    // Apply refinements to schema
    const refinedSchema = this.applySchemaRefinements(
      currentSchema,
      refinementResult.refinedSchema
    );

    // Generate new suggestions based on refinements
    const newSuggestions = await this.generateRefinementSuggestions(
      refinedSchema,
      userFeedback,
      refinementResult
    );

    return {
      refinedSchema,
      newSuggestions,
      reasoning: refinementResult.reasoning,
      confidence: refinementResult.confidence,
    };
  }

  /**
   * Generate comprehensive optimization suggestions
   */
  private async generateOptimizationSuggestions(
    schema: DatabaseSchema,
    aiAnalysis: AISchemaAnalysis,
    validationResults: CSVValidationResult[],
    options: OptimizationOptions
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Performance optimizations
    if (options.includePerformance !== false) {
      suggestions.push(...this.generatePerformanceSuggestions(schema, aiAnalysis, options));
    }

    // Normalization suggestions
    if (options.includeNormalization !== false) {
      suggestions.push(...this.generateNormalizationSuggestions(schema));
    }

    // Security suggestions
    if (options.includeSecurity !== false) {
      suggestions.push(...this.generateSecuritySuggestions(schema));
    }

    // Best practice suggestions
    if (options.includeBestPractices !== false) {
      suggestions.push(...this.generateBestPracticeSuggestions(schema));
    }

    // Data quality suggestions from validation results
    suggestions.push(...this.generateDataQualitySuggestions(validationResults));

    // AI-specific suggestions
    suggestions.push(...this.convertAISuggestions(aiAnalysis.suggestions));

    return suggestions.sort((a, b) => {
      // Sort by priority and confidence
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return b.confidence - a.confidence;
    });
  }

  /**
   * Generate performance optimization suggestions
   */
  private generatePerformanceSuggestions(
    schema: DatabaseSchema,
    aiAnalysis: AISchemaAnalysis,
    options: OptimizationOptions
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    schema.tables.forEach(table => {
      // Index suggestions
      const potentialIndexColumns = table.columns.filter(col => 
        col.name.includes('id') ||
        col.name.includes('email') ||
        col.name.includes('username') ||
        col.name.includes('status') ||
        col.type === 'TIMESTAMPTZ'
      );

      potentialIndexColumns.forEach(col => {
        if (!table.indexes.some(idx => idx.columns.includes(col.name))) {
          suggestions.push({
            id: generateId(),
            type: 'performance',
            priority: col.name.includes('id') ? 'high' : 'medium',
            title: `Add index on ${table.name}.${col.name}`,
            description: `Create an index to improve query performance for ${col.name} lookups`,
            impact: 'Faster queries when filtering or sorting by this column',
            effort: 'low',
            autoApplicable: true,
            confidence: 0.8,
            category: 'Indexing',
            technicalDetails: {
              reasoning: `Column ${col.name} appears to be frequently queried based on naming patterns`,
              implementation: `CREATE INDEX idx_${table.name}_${col.name} ON ${table.name} (${col.name});`,
              estimatedImpact: {
                performance: 70,
                storage: -5, // Slight storage increase
                maintenance: 5, // Slight maintenance increase
              },
            },
            code: {
              sql: `CREATE INDEX idx_${table.name}_${col.name} ON ${table.name} (${col.name});`,
              explanation: `This index will speed up queries that filter or sort by ${col.name}`,
            },
          });
        }
      });

      // Composite index suggestions for foreign key relationships
      if (schema.relationships) {
        schema.relationships
          .filter(rel => rel.sourceTable === table.name)
          .forEach(rel => {
            const hasCompositeIndex = table.indexes.some(idx => 
              idx.columns.includes(rel.sourceColumn) && idx.columns.length > 1
            );

            if (!hasCompositeIndex) {
              suggestions.push({
                id: generateId(),
                type: 'performance',
                priority: 'medium',
                title: `Consider composite index for ${table.name}`,
                description: `Add composite index including ${rel.sourceColumn} and frequently queried columns`,
                impact: 'Improved performance for complex queries involving relationships',
                effort: 'low',
                autoApplicable: false,
                confidence: 0.6,
                category: 'Indexing',
                technicalDetails: {
                  reasoning: 'Foreign key columns often benefit from composite indexes',
                  implementation: 'Analyze query patterns to determine optimal column combination',
                  relatedTables: [rel.targetTable],
                },
              });
            }
          });
      }

      // Partitioning suggestions for large tables
      if (options.expectedScale === 'large' || options.expectedScale === 'enterprise') {
        const hasDateColumn = table.columns.some(col => 
          col.type === 'TIMESTAMPTZ' && (col.name.includes('created') || col.name.includes('date'))
        );

        if (hasDateColumn) {
          suggestions.push({
            id: generateId(),
            type: 'performance',
            priority: 'medium',
            title: `Consider partitioning ${table.name}`,
            description: 'Implement time-based partitioning for better performance at scale',
            impact: 'Significant performance improvement for time-range queries on large datasets',
            effort: 'high',
            autoApplicable: false,
            confidence: 0.7,
            category: 'Partitioning',
            technicalDetails: {
              reasoning: 'Large tables with time-based data benefit from partitioning',
              implementation: 'Set up monthly or yearly partitions based on created_at column',
              estimatedImpact: {
                performance: 60,
                storage: 0,
                maintenance: 20,
              },
            },
          });
        }
      }
    });

    return suggestions;
  }

  /**
   * Generate normalization suggestions
   */
  private generateNormalizationSuggestions(
    schema: DatabaseSchema
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    schema.tables.forEach(table => {
      // Look for potential enum columns
      const categoricalColumns = table.columns.filter(col => 
        col.type === 'VARCHAR' && 
        col.name.includes('status') || 
        col.name.includes('type') ||
        col.name.includes('category')
      );

      categoricalColumns.forEach(col => {
        suggestions.push({
          id: generateId(),
          type: 'normalization',
          priority: 'low',
          title: `Consider ENUM for ${table.name}.${col.name}`,
          description: `Convert ${col.name} to ENUM type if it has limited values`,
          impact: 'Better data validation and potential storage savings',
          effort: 'medium',
          autoApplicable: false,
          confidence: 0.5,
          category: 'Data Types',
          technicalDetails: {
            reasoning: 'Categorical data with limited values is better represented as ENUMs',
            implementation: 'Analyze actual data values to determine if ENUM is appropriate',
            beforeAfter: {
              before: `${col.name} ${col.type}`,
              after: `${col.name} status_enum`,
            },
          },
        });
      });

      // Suggest normalization for repeated data patterns
      const longTextColumns = table.columns.filter(col => 
        col.type === 'TEXT' || (col.type === 'VARCHAR' && col.length && col.length > 100)
      );

      if (longTextColumns.length > 1) {
        suggestions.push({
          id: generateId(),
          type: 'normalization',
          priority: 'medium',
          title: `Review normalization for ${table.name}`,
          description: 'Consider splitting large text fields into separate tables if they contain structured data',
          impact: 'Better data organization and reduced redundancy',
          effort: 'high',
          autoApplicable: false,
          confidence: 0.4,
          category: 'Table Structure',
          technicalDetails: {
            reasoning: 'Tables with multiple large text fields may benefit from normalization',
            implementation: 'Analyze text content to identify extractable structured data',
          },
        });
      }
    });

    return suggestions;
  }

  /**
   * Generate security suggestions
   */
  private generateSecuritySuggestions(
    schema: DatabaseSchema
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    schema.tables.forEach(table => {
      // Row Level Security suggestion
      suggestions.push({
        id: generateId(),
        type: 'security',
        priority: 'high',
        title: `Enable RLS for ${table.name}`,
        description: 'Implement Row Level Security policies for data access control',
        impact: 'Enhanced security by controlling row-level access',
        effort: 'medium',
        autoApplicable: true,
        confidence: 0.9,
        category: 'Access Control',
        technicalDetails: {
          reasoning: 'RLS provides fine-grained access control for multi-tenant applications',
          implementation: 'Enable RLS and create appropriate policies',
        },
        code: {
          sql: `ALTER TABLE ${table.name} ENABLE ROW LEVEL SECURITY;`,
          explanation: 'This enables row-level security. You\'ll need to add specific policies based on your access requirements.',
        },
      });

      // Sensitive data identification
      const sensitiveColumns = table.columns.filter(col =>
        col.name.includes('password') ||
        col.name.includes('ssn') ||
        col.name.includes('social') ||
        col.name.includes('credit') ||
        col.name.includes('personal')
      );

      sensitiveColumns.forEach(col => {
        suggestions.push({
          id: generateId(),
          type: 'security',
          priority: 'critical',
          title: `Secure sensitive data in ${table.name}.${col.name}`,
          description: 'Implement encryption or hashing for sensitive personal data',
          impact: 'Critical security improvement for personal data protection',
          effort: 'high',
          autoApplicable: false,
          confidence: 0.95,
          category: 'Data Protection',
          technicalDetails: {
            reasoning: 'Sensitive personal data requires special security measures',
            implementation: 'Use pgcrypto extension for encryption or implement application-level hashing',
          },
        });
      });
    });

    return suggestions;
  }

  /**
   * Generate best practice suggestions
   */
  private generateBestPracticeSuggestions(
    schema: DatabaseSchema
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    schema.tables.forEach(table => {
      // Check for missing audit fields
      const hasCreatedAt = table.columns.some(col => col.name === 'created_at');
      const hasUpdatedAt = table.columns.some(col => col.name === 'updated_at');

      if (!hasCreatedAt || !hasUpdatedAt) {
        suggestions.push({
          id: generateId(),
          type: 'best-practice',
          priority: 'medium',
          title: `Add audit timestamps to ${table.name}`,
          description: 'Include created_at and updated_at columns for audit trails',
          impact: 'Better data tracking and debugging capabilities',
          effort: 'low',
          autoApplicable: true,
          confidence: 0.9,
          category: 'Audit Trail',
          technicalDetails: {
            reasoning: 'Audit timestamps are essential for data tracking and debugging',
            implementation: 'Add TIMESTAMPTZ columns with appropriate defaults',
          },
          code: {
            sql: `
ALTER TABLE ${table.name} 
ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
            `.trim(),
            explanation: 'These columns will automatically track when records are created and last modified',
          },
        });
      }

      // Check for missing constraints
      const emailColumns = table.columns.filter(col => col.name.includes('email'));
      emailColumns.forEach(col => {
        const hasEmailConstraint = col.constraints?.some(constraint =>
          constraint.type === 'CHECK' && constraint.value?.includes('@')
        );

        if (!hasEmailConstraint) {
          suggestions.push({
            id: generateId(),
            type: 'best-practice',
            priority: 'medium',
            title: `Add email validation for ${table.name}.${col.name}`,
            description: 'Add CHECK constraint to validate email format',
            impact: 'Better data quality and validation',
            effort: 'low',
            autoApplicable: true,
            confidence: 0.8,
            category: 'Data Validation',
            technicalDetails: {
              reasoning: 'Email columns should have format validation',
              implementation: 'Add CHECK constraint with email regex pattern',
            },
            code: {
              sql: `ALTER TABLE ${table.name} ADD CONSTRAINT chk_${table.name}_${col.name}_format CHECK (${col.name} ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$');`,
              explanation: 'This constraint ensures only valid email formats are stored',
            },
          });
        }
      });
    });

    return suggestions;
  }

  /**
   * Generate data quality suggestions from validation results
   */
  private generateDataQualitySuggestions(
    validationResults: CSVValidationResult[]
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    validationResults.forEach(result => {
      // High missing data warnings
      Object.entries(result.metadata.estimatedTypes).forEach(([columnName]) => {
        const sampleData = result.sampleData;
        
        const missingCount = sampleData.filter(row => 
          !row[columnName] || row[columnName] === '' || row[columnName] === null
        ).length;
        
        const missingPercentage = (missingCount / sampleData.length) * 100;

        if (missingPercentage > 20) {
          suggestions.push({
            id: generateId(),
            type: 'data-quality',
            priority: missingPercentage > 50 ? 'high' : 'medium',
            title: `High missing data in ${columnName}`,
            description: `${missingPercentage.toFixed(1)}% of values are missing in ${columnName}`,
            impact: 'May affect data integrity and query results',
            effort: 'medium',
            autoApplicable: false,
            confidence: 0.9,
            category: 'Data Completeness',
            technicalDetails: {
              reasoning: `Column has ${missingPercentage.toFixed(1)}% missing values, which may indicate data quality issues`,
              implementation: 'Consider adding default values, making column nullable, or improving data collection',
            },
          });
        }
      });

      // Validation errors
      result.errors.forEach(error => {
        if (error.autoFixable) {
          suggestions.push({
            id: generateId(),
            type: 'data-quality',
            priority: 'high',
            title: `Fix: ${error.message}`,
            description: error.suggestion || 'Apply automatic fix for this data quality issue',
            impact: 'Improves data consistency and schema reliability',
            effort: 'low',
            autoApplicable: true,
            confidence: 0.8,
            category: 'Data Validation',
            technicalDetails: {
              reasoning: error.message,
              implementation: error.suggestion || 'Automatic fix available',
            },
          });
        }
      });
    });

    return suggestions;
  }

  /**
   * Convert AI suggestions to our format
   */
  private convertAISuggestions(aiSuggestions: AISuggestion[]): OptimizationSuggestion[] {
    return aiSuggestions.map(suggestion => ({
      id: generateId(),
      type: suggestion.type as OptimizationSuggestion['type'],
      priority: suggestion.impact === 'high' ? 'high' : suggestion.impact === 'medium' ? 'medium' : 'low',
      title: suggestion.description,
      description: suggestion.description,
      impact: suggestion.reasoning,
      effort: 'medium',
      autoApplicable: suggestion.actionable,
      confidence: 0.7,
      category: 'AI Recommendation',
      technicalDetails: {
        reasoning: suggestion.reasoning,
        implementation: suggestion.description,
      },
    }));
  }

  /**
   * Helper methods for data conversion
   */
  private convertValidationToParseResults(validationResults: CSVValidationResult[]): CSVParseResult[] {
    return validationResults.map(result => ({
      id: generateId(),
      fileName: 'uploaded_file.csv',
      headers: result.metadata.headers,
      data: result.sampleData.map(row => 
        result.metadata.headers.map(header => 
          row[header] !== undefined ? String(row[header]) : null
        )
      ),
      totalRows: result.metadata.totalRows,
      sampledRows: result.sampleData.length,
      columns: result.metadata.headers.map(header => ({
        index: result.metadata.headers.indexOf(header),
        name: header,
        originalName: header,
        sampleValues: result.sampleData.slice(0, 5).map(row => row[header] !== undefined ? String(row[header]) : null),
        uniqueValues: new Set(result.sampleData.map(row => row[header]).filter((val): val is string => val !== null && val !== undefined).map(String)),
        nullCount: result.sampleData.filter(row => !row[header]).length,
        emptyCount: result.sampleData.filter(row => row[header] === '').length,
        totalCount: result.sampleData.length,
        inferredType: result.metadata.estimatedTypes[header] as PostgresType || 'TEXT',
      })),
      config: {
        hasHeader: true,
        skipEmptyLines: true,
        trimWhitespace: true,
      },
      parseErrors: [],
      timestamp: new Date(),
    }));
  }

  private convertAIAnalysisToSchema(aiAnalysis: AISchemaAnalysis): DatabaseSchema {
    return {
      id: generateId(),
      name: 'AI Generated Schema',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tables: aiAnalysis.tables.map(table => ({
        id: generateId(),
        name: table.name,
        ...(table.comment && { comment: table.comment }),
        position: { x: 0, y: 0 },
        columns: table.columns.map(col => ({
          id: generateId(),
          name: col.name,
          type: col.type as PostgresType,
          nullable: col.nullable,
          ...(col.length !== undefined && { length: col.length }),
          ...(col.precision !== undefined && { precision: col.precision }),
          ...(col.scale !== undefined && { scale: col.scale }),
          ...(col.defaultValue !== undefined && { defaultValue: col.defaultValue }),
          constraints: col.constraints.map(c => {
            // Handle foreign key references in simplified format
            if (c.startsWith('references ')) {
              const [, targetTable] = c.split('references ');
              return {
                type: 'FOREIGN KEY' as ConstraintType,
                referencedTable: targetTable.split('(')[0].trim(),
                referencedColumn: targetTable.split('(')[1].split(')')[0].trim()
              };
            }
            return { type: c as ConstraintType };
          }),
          ...(col.reasoning && { comment: col.reasoning }),
        })),
        indexes: table.indexes.map(idx => ({
          id: generateId(),
          name: idx.name,
          columns: idx.columns,
          unique: idx.unique,
        })),
      })),
      relationships: [],
      rlsPolicies: aiAnalysis.tables.flatMap(table => 
        table.rlsPolicies.map(policy => {
          const rlsPolicy: RLSPolicy = {
            id: generateId(),
            tableName: table.name,
            name: policy.name,
            command: policy.operation,
            roles: ['authenticated']
          };
          
          // Handle different policy operations correctly - SIMPLIFIED LOGIC
          if (policy.operation === 'INSERT') {
            // INSERT policies can only have WITH CHECK, not USING
            rlsPolicy.withCheck = policy.with_check || 'auth.uid() IS NOT NULL';
          } else if (policy.operation === 'UPDATE') {
            // UPDATE policies can have both USING and WITH CHECK
            rlsPolicy.using = policy.using || 'auth.uid() IS NOT NULL';
            rlsPolicy.withCheck = policy.with_check || 'auth.uid() IS NOT NULL';
          } else {
            // SELECT and DELETE policies can only have USING
            rlsPolicy.using = policy.using || 'auth.uid() IS NOT NULL';
          }
          
          return rlsPolicy;
        })
      ),
    };
  }

  private getUseCaseDescription(options: OptimizationOptions): string {
    const useCases = {
      'web-app': 'Web application with user interactions',
      'analytics': 'Analytics and reporting system',
      'api': 'API backend service',
      'general': 'General purpose application',
    };
    return useCases[options.targetUseCase || 'general'];
  }

  private applyAutoOptimizations(
    schema: DatabaseSchema,
    suggestions: OptimizationSuggestion[]
  ): DatabaseSchema {
    // Clone the schema
    const optimizedSchema = JSON.parse(JSON.stringify(schema));

    // Apply auto-applicable suggestions
    const autoSuggestions = suggestions.filter(s => s.autoApplicable);

    autoSuggestions.forEach(suggestion => {
      // Apply simple optimizations that can be automated
      if (suggestion.category === 'Indexing' && suggestion.code?.sql) {
        // Index suggestions would be applied during migration generation
      }
      
      if (suggestion.category === 'Audit Trail' && suggestion.code?.sql) {
        // Audit field additions would be applied during schema generation
      }
    });

    return optimizedSchema;
  }

  private applySchemaRefinements(
    currentSchema: DatabaseSchema,
    refinements: Partial<DatabaseSchema>
  ): DatabaseSchema {
    // Deep merge refinements into current schema
    const refined = JSON.parse(JSON.stringify(currentSchema));
    
    // Apply refinements (this would be more sophisticated in a real implementation)
    if (refinements.tables) {
      refined.tables = refinements.tables;
    }
    
    if (refinements.relationships) {
      refined.relationships = refinements.relationships;
    }
    
    refined.updatedAt = new Date();
    
    return refined;
  }

  private async generateRefinementSuggestions(
    refinedSchema: DatabaseSchema,
    userFeedback: string,
    refinementResult: SchemaRefinementResult
  ): Promise<OptimizationSuggestion[]> {
    // Generate new suggestions based on the refinement
    return [{
      id: generateId(),
      type: 'best-practice',
      priority: 'medium',
      title: 'Schema refined based on feedback',
      description: `Applied refinements: ${userFeedback}`,
      impact: refinementResult.reasoning,
      effort: 'low',
      autoApplicable: false,
      confidence: refinementResult.confidence,
      category: 'User Feedback',
      technicalDetails: {
        reasoning: refinementResult.reasoning,
        implementation: 'Changes have been applied to the schema',
      },
    }];
  }

  private calculateOptimizationSummary(
    suggestions: OptimizationSuggestion[]
  ) {
    const criticalIssues = suggestions.filter(s => s.priority === 'critical').length;
    const autoApplicableCount = suggestions.filter(s => s.autoApplicable).length;
    
    const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length || 0;
    
    // Estimate performance gain based on performance suggestions
    const performanceSuggestions = suggestions.filter(s => s.type === 'performance');
    const estimatedPerformanceGain = performanceSuggestions.reduce((sum, s) => 
      sum + (s.technicalDetails.estimatedImpact?.performance || 0), 0
    ) / performanceSuggestions.length || 0;

    return {
      totalSuggestions: suggestions.length,
      criticalIssues,
      autoApplicableCount,
      estimatedPerformanceGain: Math.round(estimatedPerformanceGain),
      confidenceScore: Math.round(avgConfidence * 100),
    };
  }
}