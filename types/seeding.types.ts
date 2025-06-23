/**
 * Type definitions for Phase 10: Data Seeding & Large File Processing
 * These types extend the existing schema without breaking compatibility
 */

import type { DatabaseSchema } from "./schema.types";

// File upload and chunking types
export interface FileChunk {
  id: string;
  fileId: string;
  chunkNumber: number;
  totalChunks: number;
  size: number;
  data: Blob;
  uploadStatus: "pending" | "uploading" | "completed" | "failed";
  uploadProgress: number;
  error?: string;
}

export interface FileUpload {
  id: string;
  userId: string;
  projectId: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  storagePath: string;
  uploadStatus: "pending" | "uploading" | "completed" | "failed";
  chunks: FileChunk[];
  totalChunks: number;
  completedChunks: number;
  uploadProgress: number;
  metadata: FileMetadata;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

export interface FileMetadata {
  headers: string[];
  totalRows: number;
  sampleRows: Record<string, unknown>[];
  estimatedTypes: Record<string, string>;
  encoding: string;
  delimiter: string;
  hasHeader: boolean;
  fileSize: number;
  checksums: {
    md5: string;
    sha256: string;
  };
}

// Data seeding types
export interface SeedingJob {
  id: string;
  userId: string;
  projectId: string;
  fileId: string;
  schemaId: string;
  schema: DatabaseSchema;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  currentTable?: string;
  currentBatch?: number;
  estimatedTimeRemaining?: number;
  processingSpeed?: number; // rows per second
  errors: DataError[];
  warnings: DataWarning[];
  statistics: SeedingStatistics;
  configuration: SeedingConfiguration;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  fileUpload?: FileUpload;
}

export interface DataError {
  id: string;
  row: number;
  column?: string;
  table?: string;
  errorType: "validation" | "constraint" | "type_conversion" | "foreign_key" | "duplicate" | "other";
  message: string;
  originalValue?: unknown;
  suggestedFix?: string;
  severity: "critical" | "high" | "medium" | "low";
  canAutoFix: boolean;
}

export interface DataWarning {
  id: string;
  row?: number;
  column?: string;
  table?: string;
  warningType: "data_quality" | "type_mismatch" | "missing_value" | "unusual_value";
  message: string;
  originalValue?: unknown;
  suggestedValue?: unknown;
}

export interface SeedingStatistics {
  totalFiles: number;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  duplicatesFound: number;
  duplicatesResolved: number;
  tablesProcessed: string[];
  averageRowsPerSecond: number;
  peakRowsPerSecond: number;
  memoryUsage: {
    peak: number;
    average: number;
    current: number;
  };
  processingTime: {
    total: number;
    parsing: number;
    validation: number;
    insertion: number;
  };
  currentTable?: string;
}

export interface SeedingConfiguration {
  mode: "append" | "overwrite" | "update" | "skip_duplicates";
  batchSize: number;
  maxErrors: number;
  skipOnError: boolean;
  validateForeignKeys: boolean;
  handleDuplicates: "skip" | "overwrite" | "error";
  dataTransformations: ColumnMapping[];
  customValidations: ValidationRule[];
  parallelProcessing: boolean;
  maxConcurrency: number;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
  targetTable: string;
  transformation?: {
    type: "cast" | "format" | "calculate" | "lookup" | "default";
    expression: string;
    defaultValue?: unknown;
  };
  validation?: {
    required: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    allowedValues?: unknown[];
  };
}

export interface ValidationRule {
  id: string;
  name: string;
  table: string;
  column?: string;
  type: "custom" | "business_logic" | "data_quality";
  expression: string;
  errorMessage: string;
  severity: "critical" | "high" | "medium" | "low";
}

// Progress tracking types
export interface SeedingProgress {
  jobId: string;
  status: SeedingJob["status"];
  overallProgress: number;
  currentPhase: "uploading" | "parsing" | "validating" | "processing" | "completing";
  currentTable?: string;
  currentBatch?: number;
  totalBatches?: number;
  rowsPerSecond?: number;
  estimatedTimeRemaining?: number;
  statistics: Partial<SeedingStatistics>;
  errors: DataError[];
  warnings: DataWarning[];
  lastUpdate: Date;
  needsContinuation?: boolean;
  continuationData?: {
    processedRows: number;
    totalRows: number;
    nextChunkIndex: number;
  };
}

// Storage types
export interface StorageConfig {
  bucketName: string;
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  chunkSize: number; // in bytes
  retentionDays: number;
  enableCompression: boolean;
}

// Edge function types
export interface SeedDataRequest {
  fileId: string;
  jobId: string;
  configuration: SeedingConfiguration;
  schema: DatabaseSchema;
  projectConfig: {
    projectId: string;
    databaseUrl: string;
    apiKey: string;
  };
}

export interface SeedDataResponse {
  success: boolean;
  jobId: string;
  message: string;
  statistics?: SeedingStatistics;
  errors?: DataError[];
  warnings?: DataWarning[];
}

// Event types for real-time updates
export interface SeedingEvent {
  type: "progress" | "error" | "warning" | "completed" | "failed";
  jobId: string;
  timestamp: Date;
  data: SeedingProgress | DataError | DataWarning | SeedingStatistics;
}

// API response types
export interface SeedingAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    requestId: string;
    timestamp: Date;
    version: string;
  };
}

// Utility types
export type SeedingStatus = SeedingJob["status"];
export type ErrorType = DataError["errorType"];
export type WarningType = DataWarning["warningType"];
export type SeedingMode = SeedingConfiguration["mode"];
export type ProcessingPhase = SeedingProgress["currentPhase"];