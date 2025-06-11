// PostgreSQL reserved keywords that should be avoided or quoted
export const POSTGRES_RESERVED_WORDS = new Set([
  'all', 'analyse', 'analyze', 'and', 'any', 'array', 'as', 'asc', 'asymmetric',
  'authorization', 'binary', 'both', 'case', 'cast', 'check', 'collate', 'collation',
  'column', 'concurrently', 'constraint', 'create', 'current_catalog', 'current_date',
  'current_role', 'current_schema', 'current_time', 'current_timestamp', 'current_user',
  'default', 'deferrable', 'desc', 'distinct', 'do', 'else', 'end', 'except', 'false',
  'fetch', 'for', 'foreign', 'freeze', 'from', 'full', 'grant', 'group', 'having',
  'ilike', 'in', 'initially', 'inner', 'intersect', 'into', 'is', 'isnull', 'join',
  'lateral', 'leading', 'left', 'like', 'limit', 'localtime', 'localtimestamp', 'natural',
  'not', 'notnull', 'null', 'offset', 'on', 'only', 'or', 'order', 'outer', 'overlaps',
  'placing', 'primary', 'references', 'returning', 'right', 'select', 'session_user',
  'similar', 'some', 'symmetric', 'table', 'tablesample', 'then', 'to', 'trailing',
  'true', 'union', 'unique', 'user', 'using', 'variadic', 'verbose', 'when', 'where',
  'window', 'with'
]);

// Common SQL data types and their PostgreSQL equivalents
export const TYPE_MAPPINGS = {
  string: 'VARCHAR',
  text: 'TEXT',
  integer: 'INTEGER',
  bigint: 'BIGINT',
  decimal: 'NUMERIC',
  float: 'REAL',
  double: 'DOUBLE PRECISION',
  boolean: 'BOOLEAN',
  date: 'DATE',
  datetime: 'TIMESTAMP',
  timestamptz: 'TIMESTAMPTZ',
  uuid: 'UUID',
  json: 'JSONB',
  array: 'ARRAY'
} as const;

// Default column configurations
export const DEFAULT_COLUMNS = {
  id: {
    name: 'id',
    type: 'UUID',
    nullable: false,
    defaultValue: 'gen_random_uuid()',
    constraints: ['PRIMARY KEY']
  },
  created_at: {
    name: 'created_at',
    type: 'TIMESTAMPTZ',
    nullable: false,
    defaultValue: 'NOW()'
  },
  updated_at: {
    name: 'updated_at',
    type: 'TIMESTAMPTZ',
    nullable: false,
    defaultValue: 'NOW()'
  },
  user_id: {
    name: 'user_id',
    type: 'UUID',
    nullable: true,
    constraints: ['REFERENCES auth.users(id) ON DELETE CASCADE']
  }
} as const;

// File size limits
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_TOTAL_SIZE: 200 * 1024 * 1024, // 200MB for all files
  CHUNK_SIZE: 1024 * 1024 // 1MB chunks for streaming
} as const;

// CSV parsing defaults
export const CSV_DEFAULTS = {
  SAMPLE_SIZE: 1000,
  MAX_PREVIEW_ROWS: 100,
  SUPPORTED_DELIMITERS: [',', ';', '\t', '|'] as const,
  SUPPORTED_ENCODINGS: ['UTF-8', 'UTF-16', 'ASCII', 'ISO-8859-1'] as const,
  AUTO_DETECT_THRESHOLD: 0.8 // Confidence threshold for auto-detection
} as const;

// Type inference patterns
export const TYPE_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  PHONE: /^\+?[\d\s\-\(\)]{7,}$/,
  DATE_ISO: /^\d{4}-\d{2}-\d{2}$/,
  DATETIME_ISO: /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/,
  INTEGER: /^-?\d+$/,
  DECIMAL: /^-?\d*\.\d+$/,
  BOOLEAN: /^(true|false|yes|no|1|0|y|n)$/i,
  JSON: /^[\[\{].+[\]\}]$/
} as const;

// AI model configuration
export const AI_CONFIG = {
  MODEL: 'gemini-2.0-flash-preview-04-17',
  TEMPERATURE: 0.3,
  MAX_TOKENS: 4096,
  TOP_P: 0.9,
  TOP_K: 40,
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3
} as const;

// Schema validation rules
export const VALIDATION_RULES = {
  MAX_TABLE_NAME_LENGTH: 63,
  MAX_COLUMN_NAME_LENGTH: 63,
  MAX_TABLES_PER_SCHEMA: 100,
  MAX_COLUMNS_PER_TABLE: 100,
  MIN_VARCHAR_LENGTH: 1,
  MAX_VARCHAR_LENGTH: 65535,
  DEFAULT_VARCHAR_LENGTH: 255
} as const;

// Naming conventions
export const NAMING_CONVENTIONS = {
  TABLE: /^[a-z][a-z0-9_]*[a-z0-9]$|^[a-z]$/,
  COLUMN: /^[a-z][a-z0-9_]*[a-z0-9]$|^[a-z]$/,
  INDEX: /^idx_[a-z][a-z0-9_]*$/,
  CONSTRAINT: /^(pk|fk|uk|ck)_[a-z][a-z0-9_]*$/
} as const;