import type { DatabaseSchema } from './schema.types';
import type { DataQualityIssue, NormalizationSuggestion } from './csv.types';

export interface AIAnalysisRequest {
  csvHeaders: string[];
  sampleRows: (string | null)[][];
  fileName: string;
  userContext?: string;
  analysisType?: 'full' | 'quick' | 'relationships-only' | 'types-only';
  existingSchema?: DatabaseSchema;
}

export interface AITableSuggestion {
  name: string;
  originalName?: string;
  columns: AIColumnSuggestion[];
  reasoning: string;
  confidence: number;
  suggestedIndexes?: string[];
  comment?: string;
}

export interface AIColumnSuggestion {
  name: string;
  originalName: string;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  constraints: string[];
  defaultValue?: string;
  reasoning: string;
  confidence: number;
  examples: string[];
}

export interface AIRelationshipSuggestion {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  confidence: number;
  reasoning: string;
  cascadeRules?: {
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
}

export interface AIAnalysisResponse {
  tables: AITableSuggestion[];
  relationships: AIRelationshipSuggestion[];
  normalizationSuggestions: NormalizationSuggestion[];
  dataQualityIssues: DataQualityIssue[];
  migrationScript: string;
  rlsPolicies?: string[];
  indexSuggestions?: string[];
  performanceRecommendations?: string[];
  confidence: number;
  reasoning: string;
  alternativeApproaches?: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface AIRefinementRequest {
  currentSchema: DatabaseSchema;
  userQuery: string;
  context?: 'table' | 'column' | 'relationship' | 'general';
  targetTable?: string;
  targetColumn?: string;
}

export interface AIRefinementResponse {
  modifiedSchema?: DatabaseSchema;
  suggestedChanges: AISchemaChange[];
  explanation: string;
  confidence: number;
  requiresUserConfirmation: boolean;
}

export interface AISchemaChange {
  type: 'add-table' | 'modify-table' | 'delete-table' | 'add-column' | 'modify-column' | 'delete-column' | 'add-relationship' | 'modify-relationship' | 'delete-relationship';
  target: string; // table name, column name, etc.
  details: Record<string, unknown>;
  reasoning: string;
  impact: 'low' | 'medium' | 'high';
}

export interface AIStreamingResponse {
  type: 'progress' | 'partial' | 'complete' | 'error';
  step?: string;
  progress?: number; // 0-100
  partialResult?: Partial<AIAnalysisResponse>;
  finalResult?: AIAnalysisResponse;
  error?: {
    message: string;
    code: string;
    retry: boolean;
  };
}

export interface AIModelConfig {
  model: string;
  temperature: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

export interface AIPromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'analysis' | 'refinement' | 'validation' | 'export';
}

export interface AIAnalysisContext {
  sessionId: string;
  analysisHistory: AIAnalysisResponse[];
  userPreferences?: {
    namingConvention?: 'snake_case' | 'camelCase' | 'PascalCase';
    includeTimestamps?: boolean;
    includeUserAuth?: boolean;
    defaultStringLength?: number;
    preferEnums?: boolean;
  };
  fallbackMode?: boolean;
  rateLimitInfo?: {
    requestsRemaining: number;
    resetTime: Date;
  };
}

export interface AIFallbackStrategy {
  trigger: 'rate-limit' | 'error' | 'timeout' | 'invalid-response';
  strategy: 'rule-based' | 'cached' | 'simplified-prompt' | 'user-input';
  confidence: number;
  limitations: string[];
}