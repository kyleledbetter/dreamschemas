import { 
  DatabaseSchema, 
  Table, 
  Column, 
  Relationship,
  SchemaValidationError,
  SchemaValidationResult 
} from '@/types/schema.types';
import { validateSchema as baseValidateSchema } from '@/lib/utils/validation';
import { isValidName } from '@/lib/utils/naming';
import { POSTGRES_RESERVED_WORDS, VALIDATION_RULES } from '@/lib/constants';

/**
 * Enhanced schema validator for the visual editor with real-time validation
 */
export class SchemaValidator {
  private schema: DatabaseSchema;
  private validationCache: Map<string, SchemaValidationResult> = new Map();

  constructor(schema: DatabaseSchema) {
    this.schema = schema;
  }

  /**
   * Validates the entire schema and returns detailed results
   */
  public validateSchema(): SchemaValidationResult {
    const cacheKey = this.getCacheKey();
    const cached = this.validationCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const errors: SchemaValidationError[] = [];
    const warnings: SchemaValidationError[] = [];

    // Use base validation first
    const baseResult = baseValidateSchema(this.schema);
    errors.push(...baseResult.errors);
    warnings.push(...baseResult.warnings);

    // Additional visual editor specific validations
    this.validateTablePositions(errors, warnings);
    this.validateRelationshipConsistency(errors);
    this.validateNamingConventions(errors, warnings);
    this.validateDataIntegrity(errors, warnings);

    const result: SchemaValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    this.validationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Validates a specific table in real-time
   */
  public validateTable(table: Table): SchemaValidationError[] {
    const errors: SchemaValidationError[] = [];

    // Table name validation
    if (!isValidName(table.name, 'table')) {
      errors.push({
        id: `table-name-${table.id}`,
        type: 'error',
        table: table.name,
        message: `Invalid table name: ${table.name}`,
        suggestion: 'Use lowercase letters, numbers, and underscores only. Start with a letter.',
        code: 'INVALID_TABLE_NAME'
      });
    }

    // Check for reserved words
    if (POSTGRES_RESERVED_WORDS.has(table.name.toLowerCase())) {
      errors.push({
        id: `table-reserved-${table.id}`,
        type: 'error',
        table: table.name,
        message: `Table name "${table.name}" is a PostgreSQL reserved word`,
        suggestion: 'Choose a different name or quote the identifier',
        code: 'RESERVED_WORD'
      });
    }

    // Validate columns
    table.columns.forEach(column => {
      errors.push(...this.validateColumn(column, table.name));
    });

    // Check for duplicate column names
    const columnNames = new Set<string>();
    table.columns.forEach(column => {
      if (columnNames.has(column.name)) {
        errors.push({
          id: `duplicate-column-${table.id}-${column.name}`,
          type: 'error',
          table: table.name,
          column: column.name,
          message: `Duplicate column name: ${column.name}`,
          code: 'DUPLICATE_COLUMN'
        });
      }
      columnNames.add(column.name);
    });

    return errors;
  }

  /**
   * Validates a specific column
   */
  public validateColumn(column: Column, tableName?: string): SchemaValidationError[] {
    const errors: SchemaValidationError[] = [];

    // Column name validation
    if (!isValidName(column.name, 'column')) {
      errors.push({
        id: `column-name-${column.id}`,
        type: 'error',
        ...(tableName ? { table: tableName } : {}),
        column: column.name,
        message: `Invalid column name: ${column.name}`,
        suggestion: 'Use lowercase letters, numbers, and underscores only. Start with a letter.',
        code: 'INVALID_COLUMN_NAME'
      });
    }

    // Check for reserved words
    if (POSTGRES_RESERVED_WORDS.has(column.name.toLowerCase())) {
      errors.push({
        id: `column-reserved-${column.id}`,
        type: 'error',
        ...(tableName ? { table: tableName } : {}),
        column: column.name,
        message: `Column name "${column.name}" is a PostgreSQL reserved word`,
        suggestion: 'Choose a different name or quote the identifier',
        code: 'RESERVED_WORD'
      });
    }

    // Type-specific validations
    switch (column.type) {
      case 'VARCHAR':
      case 'CHAR':
        if (!column.length || column.length < 1) {
          errors.push({
            id: `varchar-length-${column.id}`,
            type: 'error',
            ...(tableName ? { table: tableName } : {}),
            column: column.name,
            message: `${column.type} columns must specify a length`,
            suggestion: 'Add a length specification, e.g., VARCHAR(255)',
            code: 'MISSING_LENGTH'
          });
        } else if (column.length > VALIDATION_RULES.MAX_VARCHAR_LENGTH) {
          errors.push({
            id: `varchar-length-too-large-${column.id}`,
            type: 'error',
            ...(tableName ? { table: tableName } : {}),
            column: column.name,
            message: `${column.type} length (${column.length}) exceeds maximum (${VALIDATION_RULES.MAX_VARCHAR_LENGTH})`,
            suggestion: 'Use TEXT type for longer strings',
            code: 'LENGTH_TOO_LARGE'
          });
        }
        break;

      case 'NUMERIC':
      case 'DECIMAL':
        if (column.precision && column.scale && column.scale > column.precision) {
          errors.push({
            id: `numeric-scale-${column.id}`,
            type: 'error',
            ...(tableName ? { table: tableName } : {}),
            column: column.name,
            message: `Scale (${column.scale}) cannot be greater than precision (${column.precision})`,
            suggestion: 'Reduce scale or increase precision',
            code: 'INVALID_PRECISION_SCALE'
          });
        }
        break;
    }

    // Constraint validations
    const hasUnique = column.constraints.some(c => c.type === 'UNIQUE');
    const hasPrimaryKey = column.constraints.some(c => c.type === 'PRIMARY KEY');
    const hasNotNull = column.constraints.some(c => c.type === 'NOT NULL');

    if (hasPrimaryKey && column.nullable) {
      errors.push({
        id: `pk-nullable-${column.id}`,
        type: 'error',
        ...(tableName ? { table: tableName } : {}),
        column: column.name,
        message: 'Primary key columns cannot be nullable',
        suggestion: 'Set nullable to false for primary key columns',
        code: 'PK_NULLABLE'
      });
    }

    if (hasUnique && !hasNotNull && column.nullable) {
      // This is actually valid in PostgreSQL (multiple NULL values allowed in unique columns)
      // But might be worth a warning
    }

    return errors;
  }

  /**
   * Validates a specific relationship
   */
  public validateRelationship(relationship: Relationship): SchemaValidationError[] {
    const errors: SchemaValidationError[] = [];

    const sourceTable = this.schema.tables.find(t => t.name === relationship.sourceTable);
    const targetTable = this.schema.tables.find(t => t.name === relationship.targetTable);

    if (!sourceTable) {
      errors.push({
        id: `rel-source-table-${relationship.id}`,
        type: 'error',
        message: `Source table "${relationship.sourceTable}" not found`,
        code: 'MISSING_SOURCE_TABLE'
      });
    }

    if (!targetTable) {
      errors.push({
        id: `rel-target-table-${relationship.id}`,
        type: 'error',
        message: `Target table "${relationship.targetTable}" not found`,
        code: 'MISSING_TARGET_TABLE'
      });
    }

    if (sourceTable) {
      const sourceColumn = sourceTable.columns.find(c => c.name === relationship.sourceColumn);
      if (!sourceColumn) {
        errors.push({
          id: `rel-source-column-${relationship.id}`,
          type: 'error',
          table: relationship.sourceTable,
          message: `Source column "${relationship.sourceColumn}" not found`,
          code: 'MISSING_SOURCE_COLUMN'
        });
      }
    }

    if (targetTable) {
      const targetColumn = targetTable.columns.find(c => c.name === relationship.targetColumn);
      if (!targetColumn) {
        errors.push({
          id: `rel-target-column-${relationship.id}`,
          type: 'error',
          table: relationship.targetTable,
          message: `Target column "${relationship.targetColumn}" not found`,
          code: 'MISSING_TARGET_COLUMN'
        });
      } else {
        // Check if target column has appropriate constraints
        const hasUniqueOrPK = targetColumn.constraints.some(c => 
          c.type === 'PRIMARY KEY' || c.type === 'UNIQUE'
        );
        
        if (relationship.type === 'one-to-one' && !hasUniqueOrPK) {
          errors.push({
            id: `rel-one-to-one-${relationship.id}`,
            type: 'error',
            table: relationship.targetTable,
            column: relationship.targetColumn,
            message: 'One-to-one relationships require target column to be unique or primary key',
            suggestion: 'Add UNIQUE constraint to target column',
            code: 'ONE_TO_ONE_NOT_UNIQUE'
          });
        }
      }
    }

    // Check for self-referencing relationships
    if (relationship.sourceTable === relationship.targetTable) {
      if (relationship.sourceColumn === relationship.targetColumn) {
        errors.push({
          id: `rel-self-same-column-${relationship.id}`,
          type: 'error',
          message: 'Self-referencing relationship cannot use the same column',
          code: 'SELF_REF_SAME_COLUMN'
        });
      }
    }

    return errors;
  }

  /**
   * Gets errors for a specific element (table, column, or relationship)
   */
  public getErrorsForElement(elementId: string, elementType: 'table' | 'column' | 'relationship'): SchemaValidationError[] {
    const result = this.validateSchema();
    return result.errors.filter(error => {
      switch (elementType) {
        case 'table':
          return error.id.includes(`table-${elementId}`) || error.table === elementId;
        case 'column':
          return error.id.includes(`column-${elementId}`) || error.column === elementId;
        case 'relationship':
          return error.id.includes(`rel-${elementId}`);
        default:
          return false;
      }
    });
  }

  /**
   * Checks if a specific element has errors
   */
  public hasErrors(elementId: string, elementType: 'table' | 'column' | 'relationship'): boolean {
    return this.getErrorsForElement(elementId, elementType).length > 0;
  }

  /**
   * Private helper methods
   */
  private validateTablePositions(_errors: SchemaValidationError[], warnings: SchemaValidationError[]) {
    // Check for overlapping tables (visual validation)
    const positions = this.schema.tables
      .filter(table => table.position)
      .map(table => ({ id: table.id, name: table.name, ...table.position! }));

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const table1 = positions[i];
        const table2 = positions[j];
        
        // Simple overlap detection (assuming 280x200 table size)
        const overlap = (
          Math.abs(table1.x - table2.x) < 280 &&
          Math.abs(table1.y - table2.y) < 200
        );
        
        if (overlap) {
          warnings.push({
            id: `overlap-${table1.id}-${table2.id}`,
            type: 'warning',
            message: `Tables "${table1.name}" and "${table2.name}" may be overlapping`,
            suggestion: 'Rearrange tables for better visibility',
            code: 'TABLE_OVERLAP'
          });
        }
      }
    }
  }

  private validateRelationshipConsistency(errors: SchemaValidationError[]) {
    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (tableName: string): boolean => {
      if (recursionStack.has(tableName)) return true;
      if (visited.has(tableName)) return false;

      visited.add(tableName);
      recursionStack.add(tableName);

      const outgoingRels = this.schema.relationships.filter(r => r.sourceTable === tableName);
      for (const rel of outgoingRels) {
        if (hasCycle(rel.targetTable)) {
          return true;
        }
      }

      recursionStack.delete(tableName);
      return false;
    };

    for (const table of this.schema.tables) {
      if (hasCycle(table.name)) {
        errors.push({
          id: `circular-dependency-${table.name}`,
          type: 'error',
          table: table.name,
          message: `Circular dependency detected involving table "${table.name}"`,
          suggestion: 'Review and break circular references',
          code: 'CIRCULAR_DEPENDENCY'
        });
        break; // Only report once
      }
    }
  }

  private validateNamingConventions(_errors: SchemaValidationError[], warnings: SchemaValidationError[]) {
    // Check naming consistency
    const tableNames = this.schema.tables.map(t => t.name);
    const hasSnakeCase = tableNames.some(name => name.includes('_'));
    const hasCamelCase = tableNames.some(name => /[a-z][A-Z]/.test(name));

    if (hasSnakeCase && hasCamelCase) {
      warnings.push({
        id: 'naming-convention-mixed',
        type: 'warning',
        message: 'Mixed naming conventions detected (snake_case and camelCase)',
        suggestion: 'Use consistent naming convention throughout schema',
        code: 'MIXED_NAMING_CONVENTION'
      });
    }
  }

  private validateDataIntegrity(_errors: SchemaValidationError[], warnings: SchemaValidationError[]) {
    // Check for tables without primary keys
    this.schema.tables.forEach(table => {
      const hasPrimaryKey = table.columns.some(col =>
        col.constraints.some(constraint => constraint.type === 'PRIMARY KEY')
      );

      if (!hasPrimaryKey) {
        warnings.push({
          id: `no-primary-key-${table.id}`,
          type: 'warning',
          table: table.name,
          message: `Table "${table.name}" has no primary key`,
          suggestion: 'Add a primary key column for better data integrity',
          code: 'NO_PRIMARY_KEY'
        });
      }
    });

    // Check for orphaned foreign key relationships
    this.schema.relationships.forEach(rel => {
      const sourceTable = this.schema.tables.find(t => t.name === rel.sourceTable);
      const targetTable = this.schema.tables.find(t => t.name === rel.targetTable);

      if (sourceTable && targetTable) {
        const sourceColumn = sourceTable.columns.find(c => c.name === rel.sourceColumn);
        const targetColumn = targetTable.columns.find(c => c.name === rel.targetColumn);

        if (sourceColumn && targetColumn) {
          // Check type compatibility
          if (sourceColumn.type !== targetColumn.type) {
            warnings.push({
              id: `type-mismatch-${rel.id}`,
              type: 'warning',
              message: `Type mismatch in relationship: ${sourceColumn.type} → ${targetColumn.type}`,
              suggestion: 'Ensure related columns have compatible types',
              code: 'TYPE_MISMATCH'
            });
          }
        }
      }
    });
  }

  private getCacheKey(): string {
    // Simple cache key based on schema content
    const tablesKey = this.schema.tables
      .map(t => `${t.id}:${t.name}:${t.columns.length}`)
      .join(',');
    const relsKey = this.schema.relationships
      .map(r => `${r.id}:${r.sourceTable}:${r.targetTable}`)
      .join(',');
    
    return `${tablesKey}|${relsKey}`;
  }

  /**
   * Clear validation cache (call when schema changes)
   */
  public clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Update schema reference
   */
  public updateSchema(schema: DatabaseSchema): void {
    this.schema = schema;
    this.clearCache();
  }
}

/**
 * Create a validator instance for real-time validation
 */
export function createSchemaValidator(schema: DatabaseSchema): SchemaValidator {
  return new SchemaValidator(schema);
}

/**
 * Quick validation function for individual elements
 */
export function validateElement(
  element: Table | Column | Relationship,
  type: 'table' | 'column' | 'relationship',
  schema?: DatabaseSchema
): SchemaValidationError[] {
  if (type === 'table') {
    const validator = new SchemaValidator(schema || { 
      id: '', name: '', tables: [element as Table], relationships: [], 
      rlsPolicies: [], version: '', createdAt: new Date(), updatedAt: new Date() 
    });
    return validator.validateTable(element as Table);
  } else if (type === 'column') {
    const validator = new SchemaValidator(schema || { 
      id: '', name: '', tables: [], relationships: [], 
      rlsPolicies: [], version: '', createdAt: new Date(), updatedAt: new Date() 
    });
    return validator.validateColumn(element as Column);
  } else if (type === 'relationship') {
    const validator = new SchemaValidator(schema || { 
      id: '', name: '', tables: [], relationships: [element as Relationship], 
      rlsPolicies: [], version: '', createdAt: new Date(), updatedAt: new Date() 
    });
    return validator.validateRelationship(element as Relationship);
  }
  
  return [];
}