/**
 * Constants for Phase 10: Data Seeding & Large File Processing
 */

// Storage Configuration
export const STORAGE_CONFIG = {
  BUCKET_NAME: "csv-uploads",
  MAX_FILE_SIZE: 150 * 1024 * 1024, // 150MB
  ALLOWED_MIME_TYPES: ["text/csv", "application/csv", "text/plain"],
  CHUNK_SIZE: 5 * 1024 * 1024, // 5MB chunks
  RETENTION_DAYS: 7, // Keep files for 7 days
  ENABLE_COMPRESSION: true,
} as const;

// Processing Configuration
export const PROCESSING_CONFIG = {
  DEFAULT_BATCH_SIZE: 1000,
  MAX_BATCH_SIZE: 5000,
  MIN_BATCH_SIZE: 100,
  MAX_CONCURRENT_BATCHES: 3,
  MAX_ERRORS_PER_JOB: 1000,
  PROGRESS_UPDATE_INTERVAL: 2000, // 2 seconds
  TIMEOUT_SECONDS: 3600, // 1 hour
} as const;

// Validation Rules
export const TYPE_VALIDATORS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  INTEGER: /^-?\d+$/,
  DECIMAL: /^-?\d+(\.\d+)?$/,
  BOOLEAN: /^(true|false|yes|no|1|0|on|off)$/i,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  TIMESTAMP: /^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/,
  DATE: /^\d{4}-\d{2}-\d{2}$/,
  TIME: /^\d{2}:\d{2}:\d{2}$/,
} as const;

// Error Categories
export const ERROR_TYPES = {
  VALIDATION: "validation",
  TYPE_CONVERSION: "type_conversion", 
  CONSTRAINT: "constraint",
  FOREIGN_KEY: "foreign_key",
  DUPLICATE: "duplicate",
  OTHER: "other",
} as const;

// Seeding Modes
export const SEEDING_MODES = {
  APPEND: "append",
  OVERWRITE: "overwrite", 
  UPDATE: "update",
  SKIP_DUPLICATES: "skip_duplicates",
} as const;

// Processing Phases
export const PROCESSING_PHASES = {
  UPLOADING: "uploading",
  PARSING: "parsing",
  VALIDATING: "validating", 
  PROCESSING: "processing",
  COMPLETING: "completing",
} as const;

// Status Values
export const JOB_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const UPLOAD_STATUSES = {
  PENDING: "pending",
  UPLOADING: "uploading",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

// File Type Mappings for CSV inference
export const CSV_TYPE_INFERENCE = {
  patterns: {
    uuid: TYPE_VALIDATORS.UUID,
    email: TYPE_VALIDATORS.EMAIL,
    integer: TYPE_VALIDATORS.INTEGER,
    decimal: TYPE_VALIDATORS.DECIMAL,
    boolean: TYPE_VALIDATORS.BOOLEAN,
    timestamp: TYPE_VALIDATORS.TIMESTAMP,
    date: TYPE_VALIDATORS.DATE,
    time: TYPE_VALIDATORS.TIME,
  },
  postgresTypes: {
    uuid: "UUID",
    email: "VARCHAR(255)",
    integer: "INTEGER",
    decimal: "DECIMAL",
    boolean: "BOOLEAN", 
    timestamp: "TIMESTAMPTZ",
    date: "DATE",
    time: "TIME",
    text: "TEXT",
  },
} as const;

// API Response Codes
export const API_ERROR_CODES = {
  FILE_VALIDATION_FAILED: "FILE_VALIDATION_FAILED",
  STORAGE_INIT_FAILED: "STORAGE_INIT_FAILED",
  CHUNK_UPLOAD_FAILED: "CHUNK_UPLOAD_FAILED",
  FILE_UPLOAD_FAILED: "FILE_UPLOAD_FAILED",
  FILE_URL_FAILED: "FILE_URL_FAILED",
  FILE_DELETE_FAILED: "FILE_DELETE_FAILED",
  DATA_PROCESSING_FAILED: "DATA_PROCESSING_FAILED",
  SEEDING_JOB_FAILED: "SEEDING_JOB_FAILED",
  EDGE_FUNCTION_ERROR: "EDGE_FUNCTION_ERROR",
} as const;

// Memory Thresholds (in MB)
export const MEMORY_THRESHOLDS = {
  WARNING: 100,
  CRITICAL: 200,
  ABORT: 300,
} as const;

// Performance Metrics
export const PERFORMANCE_TARGETS = {
  MIN_ROWS_PER_SECOND: 50,
  TARGET_ROWS_PER_SECOND: 500,
  EXCELLENT_ROWS_PER_SECOND: 1000,
} as const;