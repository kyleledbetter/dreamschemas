import { VALIDATION_RULES, FILE_SIZE_LIMITS } from '@/lib/constants';
import type { 
  SchemaValidationError, 
  SchemaValidationResult, 
  DatabaseSchema, 
  Table, 
  Column 
} from '@/types/schema.types';
import { isValidName } from './naming';

/**
 * Validates file upload constraints
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(FILE_SIZE_LIMITS.MAX_FILE_SIZE)})`
    };
  }
  
  // Check file type
  const allowedTypes = ['text/csv', 'application/csv', 'text/plain'];
  const allowedExtensions = ['.csv', '.tsv', '.txt'];
  
  const hasValidType = allowedTypes.includes(file.type);
  const hasValidExtension = allowedExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  );
  
  if (!hasValidType && !hasValidExtension) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a CSV, TSV, or TXT file.'
    };
  }
  
  return { valid: true };
}

/**
 * Validates multiple files for batch upload
 */
export function validateFiles(files: File[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let totalSize = 0;
  
  for (const file of files) {
    const validation = validateFile(file);
    if (!validation.valid && validation.error) {
      errors.push(`${file.name}: ${validation.error}`);
    }
    totalSize += file.size;
  }
  
  // Check total size
  if (totalSize > FILE_SIZE_LIMITS.MAX_TOTAL_SIZE) {
    errors.push(
      `Total file size (${formatFileSize(totalSize)}) exceeds maximum allowed (${formatFileSize(FILE_SIZE_LIMITS.MAX_TOTAL_SIZE)})`
    );
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates a complete database schema
 */
export function validateSchema(schema: DatabaseSchema): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  
  // Check schema-level constraints
  if (schema.tables.length === 0) {
    errors.push({
      id: 'schema-no-tables',
      type: 'error',
      message: 'Schema must contain at least one table',
      code: 'SCHEMA_EMPTY'
    });
  }
  
  if (schema.tables.length > VALIDATION_RULES.MAX_TABLES_PER_SCHEMA) {
    errors.push({
      id: 'schema-too-many-tables',
      type: 'error',
      message: `Schema contains too many tables (${schema.tables.length}). Maximum allowed: ${VALIDATION_RULES.MAX_TABLES_PER_SCHEMA}`,
      code: 'SCHEMA_TOO_MANY_TABLES'
    });
  }
  
  // Validate each table
  const tableNames = new Set<string>();
  for (const table of schema.tables) {
    const tableValidation = validateTable(table);
    errors.push(...tableValidation.errors);
    warnings.push(...tableValidation.warnings);
    
    // Check for duplicate table names
    if (tableNames.has(table.name)) {
      errors.push({
        id: `table-duplicate-${table.name}`,
        type: 'error',
        table: table.name,
        message: `Duplicate table name: ${table.name}`,
        code: 'TABLE_DUPLICATE_NAME'
      });
    }
    tableNames.add(table.name);
  }
  
  // Validate relationships
  for (const relationship of schema.relationships) {
    const sourceTable = schema.tables.find(t => t.name === relationship.sourceTable);
    const targetTable = schema.tables.find(t => t.name === relationship.targetTable);
    
    if (!sourceTable) {
      errors.push({
        id: `relationship-invalid-source-${relationship.id}`,
        type: 'error',
        message: `Relationship references non-existent source table: ${relationship.sourceTable}`,
        code: 'RELATIONSHIP_INVALID_SOURCE'
      });
    }
    
    if (!targetTable) {
      errors.push({
        id: `relationship-invalid-target-${relationship.id}`,
        type: 'error',
        message: `Relationship references non-existent target table: ${relationship.targetTable}`,
        code: 'RELATIONSHIP_INVALID_TARGET'
      });
    }
    
    if (sourceTable && !sourceTable.columns.find(c => c.name === relationship.sourceColumn)) {
      errors.push({
        id: `relationship-invalid-source-column-${relationship.id}`,
        type: 'error',
        table: relationship.sourceTable,
        column: relationship.sourceColumn,
        message: `Relationship references non-existent source column: ${relationship.sourceColumn}`,
        code: 'RELATIONSHIP_INVALID_SOURCE_COLUMN'
      });
    }
    
    if (targetTable && !targetTable.columns.find(c => c.name === relationship.targetColumn)) {
      errors.push({
        id: `relationship-invalid-target-column-${relationship.id}`,
        type: 'error',
        table: relationship.targetTable,
        column: relationship.targetColumn,
        message: `Relationship references non-existent target column: ${relationship.targetColumn}`,
        code: 'RELATIONSHIP_INVALID_TARGET_COLUMN'
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a single table
 */
export function validateTable(table: Table): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  
  // Validate table name
  if (!isValidName(table.name, 'table')) {
    errors.push({
      id: `table-invalid-name-${table.name}`,
      type: 'error',
      table: table.name,
      message: `Invalid table name: ${table.name}`,
      suggestion: 'Table names must be lowercase, start with a letter, and contain only letters, numbers, and underscores',
      code: 'TABLE_INVALID_NAME'
    });
  }
  
  if (table.name.length > VALIDATION_RULES.MAX_TABLE_NAME_LENGTH) {
    errors.push({
      id: `table-name-too-long-${table.name}`,
      type: 'error',
      table: table.name,
      message: `Table name too long (${table.name.length} characters). Maximum: ${VALIDATION_RULES.MAX_TABLE_NAME_LENGTH}`,
      code: 'TABLE_NAME_TOO_LONG'
    });
  }
  
  // Validate column count
  if (table.columns.length === 0) {
    errors.push({
      id: `table-no-columns-${table.name}`,
      type: 'error',
      table: table.name,
      message: 'Table must contain at least one column',
      code: 'TABLE_NO_COLUMNS'
    });
  }
  
  if (table.columns.length > VALIDATION_RULES.MAX_COLUMNS_PER_TABLE) {
    errors.push({
      id: `table-too-many-columns-${table.name}`,
      type: 'error',
      table: table.name,
      message: `Table contains too many columns (${table.columns.length}). Maximum: ${VALIDATION_RULES.MAX_COLUMNS_PER_TABLE}`,
      code: 'TABLE_TOO_MANY_COLUMNS'
    });
  }
  
  // Validate columns
  const columnNames = new Set<string>();
  let hasPrimaryKey = false;
  
  for (const column of table.columns) {
    const columnValidation = validateColumn(column, table.name);
    errors.push(...columnValidation.errors);
    warnings.push(...columnValidation.warnings);
    
    // Check for duplicate column names
    if (columnNames.has(column.name)) {
      errors.push({
        id: `column-duplicate-${table.name}-${column.name}`,
        type: 'error',
        table: table.name,
        column: column.name,
        message: `Duplicate column name: ${column.name}`,
        code: 'COLUMN_DUPLICATE_NAME'
      });
    }
    columnNames.add(column.name);
    
    // Check for primary key
    if (column.constraints.some(c => c.type === 'PRIMARY KEY')) {
      if (hasPrimaryKey) {
        errors.push({
          id: `table-multiple-primary-keys-${table.name}`,
          type: 'error',
          table: table.name,
          column: column.name,
          message: 'Table cannot have multiple primary keys',
          code: 'TABLE_MULTIPLE_PRIMARY_KEYS'
        });
      }
      hasPrimaryKey = true;
    }
  }
  
  // Warn if no primary key
  if (!hasPrimaryKey) {
    warnings.push({
      id: `table-no-primary-key-${table.name}`,
      type: 'warning',
      table: table.name,
      message: 'Table does not have a primary key',
      suggestion: 'Consider adding a primary key column for better performance and data integrity',
      code: 'TABLE_NO_PRIMARY_KEY'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a single column
 */
export function validateColumn(column: Column, tableName: string): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  
  // Validate column name
  if (!isValidName(column.name, 'column')) {
    errors.push({
      id: `column-invalid-name-${tableName}-${column.name}`,
      type: 'error',
      table: tableName,
      column: column.name,
      message: `Invalid column name: ${column.name}`,
      suggestion: 'Column names must be lowercase, start with a letter, and contain only letters, numbers, and underscores',
      code: 'COLUMN_INVALID_NAME'
    });
  }
  
  if (column.name.length > VALIDATION_RULES.MAX_COLUMN_NAME_LENGTH) {
    errors.push({
      id: `column-name-too-long-${tableName}-${column.name}`,
      type: 'error',
      table: tableName,
      column: column.name,
      message: `Column name too long (${column.name.length} characters). Maximum: ${VALIDATION_RULES.MAX_COLUMN_NAME_LENGTH}`,
      code: 'COLUMN_NAME_TOO_LONG'
    });
  }
  
  // Validate VARCHAR length
  if (column.type === 'VARCHAR') {
    if (!column.length) {
      warnings.push({
        id: `column-varchar-no-length-${tableName}-${column.name}`,
        type: 'warning',
        table: tableName,
        column: column.name,
        message: 'VARCHAR column without explicit length will use default',
        suggestion: `Consider specifying a length (e.g., VARCHAR(${VALIDATION_RULES.DEFAULT_VARCHAR_LENGTH}))`,
        code: 'COLUMN_VARCHAR_NO_LENGTH'
      });
    } else if (column.length < VALIDATION_RULES.MIN_VARCHAR_LENGTH) {
      errors.push({
        id: `column-varchar-length-too-small-${tableName}-${column.name}`,
        type: 'error',
        table: tableName,
        column: column.name,
        message: `VARCHAR length too small (${column.length}). Minimum: ${VALIDATION_RULES.MIN_VARCHAR_LENGTH}`,
        code: 'COLUMN_VARCHAR_LENGTH_TOO_SMALL'
      });
    } else if (column.length > VALIDATION_RULES.MAX_VARCHAR_LENGTH) {
      errors.push({
        id: `column-varchar-length-too-large-${tableName}-${column.name}`,
        type: 'error',
        table: tableName,
        column: column.name,
        message: `VARCHAR length too large (${column.length}). Maximum: ${VALIDATION_RULES.MAX_VARCHAR_LENGTH}`,
        suggestion: 'Consider using TEXT type for very long strings',
        code: 'COLUMN_VARCHAR_LENGTH_TOO_LARGE'
      });
    }
  }
  
  // Validate NUMERIC precision and scale
  if (column.type === 'NUMERIC' || column.type === 'DECIMAL') {
    if (column.precision && column.scale && column.scale > column.precision) {
      errors.push({
        id: `column-numeric-invalid-scale-${tableName}-${column.name}`,
        type: 'error',
        table: tableName,
        column: column.name,
        message: `NUMERIC scale (${column.scale}) cannot be greater than precision (${column.precision})`,
        code: 'COLUMN_NUMERIC_INVALID_SCALE'
      });
    }
  }
  
  // Validate constraints
  const constraintTypes = column.constraints.map(c => c.type);
  if (constraintTypes.includes('PRIMARY KEY') && column.nullable) {
    errors.push({
      id: `column-pk-nullable-${tableName}-${column.name}`,
      type: 'error',
      table: tableName,
      column: column.name,
      message: 'Primary key column cannot be nullable',
      code: 'COLUMN_PK_NULLABLE'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Checks if a string is a valid PostgreSQL identifier
 */
export function isValidPostgresIdentifier(name: string): boolean {
  // PostgreSQL identifiers must:
  // - Start with a letter or underscore
  // - Contain only letters, digits, underscores, and dollar signs
  // - Be 63 characters or less
  // - Not be a reserved word (checked separately)
  
  if (!name || name.length === 0 || name.length > 63) {
    return false;
  }
  
  return /^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(name);
}