import type { PostgresType } from './schema.types';

export type DelimiterType = ',' | ';' | '\t' | '|';

export type EncodingType = 'UTF-8' | 'UTF-16' | 'ASCII' | 'ISO-8859-1';

export interface CSVParseConfig {
  delimiter?: DelimiterType;
  encoding?: EncodingType;
  hasHeader: boolean;
  skipEmptyLines: boolean;
  trimWhitespace: boolean;
  sampleSize?: number; // Number of rows to sample for analysis
  maxFileSize?: number; // Max file size in bytes
}

export interface CSVFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  file: File;
}

export interface CSVColumn {
  index: number;
  name: string;
  originalName: string;
  sampleValues: (string | null)[];
  uniqueValues: Set<string>;
  nullCount: number;
  emptyCount: number;
  totalCount: number;
  inferredType?: PostgresType;
  typeConfidence?: number;
  suggestedConstraints?: string[];
  potentialIssues?: string[];
}

export interface CSVParseResult {
  id: string;
  fileName: string;
  headers: string[];
  data: (string | null)[][];
  totalRows: number;
  sampledRows: number;
  columns: CSVColumn[];
  config: CSVParseConfig;
  parseErrors: CSVParseError[];
  timestamp: Date;
}

export interface CSVParseError {
  row: number;
  column?: number;
  message: string;
  type: 'warning' | 'error';
  code: string;
}

export interface TypeInferenceResult {
  type: PostgresType;
  confidence: number;
  reasoning: string;
  suggestedLength?: number;
  suggestedPrecision?: number;
  suggestedScale?: number;
  constraints: string[];
  examples: string[];
}

export interface RelationshipHint {
  sourceColumn: string;
  targetTable?: string;
  targetColumn?: string;
  confidence: number;
  type: 'foreign-key' | 'many-to-many' | 'self-reference';
  reasoning: string;
}

export interface DataQualityIssue {
  column: string;
  type: 'inconsistent-format' | 'missing-values' | 'invalid-values' | 'duplicate-values' | 'outliers';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedRows: number[];
  suggestion: string;
}

export interface NormalizationSuggestion {
  type: 'split-column' | 'extract-table' | 'merge-columns' | 'create-enum';
  description: string;
  columns: string[];
  suggestedAction: string;
  benefit: string;
  complexity: 'low' | 'medium' | 'high';
}

export interface CSVAnalysisResult {
  parseResult: CSVParseResult;
  typeInference: Record<string, TypeInferenceResult>;
  relationshipHints: RelationshipHint[];
  dataQualityIssues: DataQualityIssue[];
  normalizationSuggestions: NormalizationSuggestion[];
  statistics: {
    totalFiles: number;
    totalRows: number;
    totalColumns: number;
    emptyColumns: number;
    duplicateRows: number;
  };
}

export interface CSVUploadProgress {
  fileId: string;
  fileName: string;
  status: 'pending' | 'parsing' | 'analyzing' | 'completed' | 'error';
  progress: number; // 0-100
  currentStep?: string;
  error?: string;
}