import type { 
  DatabaseSchema, 
  Table, 
  Column, 
  Relationship, 
  Index,
  RLSPolicy,
  SchemaExportOptions,
  SchemaExportResult,
  PostgresType,
  ColumnConstraint 
} from '../../types/schema.types';
import type { 
  CSVParseResult
} from '../../types/csv.types';
import type { AISchemaAnalysis } from '../ai/schema-analyzer';
import { v4 as uuidv4 } from 'uuid';

/**
 * PostgreSQL Schema Generator with AI Integration
 * Converts CSV analysis results into production-ready PostgreSQL schemas
 */
export class SchemaGenerator {
  private readonly conventions = {
    tableName: (name: string) => this.toSnakeCase(name),
    columnName: (name: string) => this.toSnakeCase(name),
    indexName: (table: string, columns: string[]) => 
      `idx_${table}_${columns.join('_')}`,
    constraintName: (table: string, column: string, type: string) =>
      `${table}_${column}_${type}`,
  };

  /**
   * Generate complete database schema from CSV analysis and AI suggestions
   */
  async generateSchema(
    csvResults: CSVParseResult[],
    aiAnalysis?: AISchemaAnalysis,
    options: {
      includeAuditColumns?: boolean;
      includeRLS?: boolean;
      optimizeForPerformance?: boolean;
      targetWorkload?: 'oltp' | 'olap' | 'mixed';
    } = {}
  ): Promise<DatabaseSchema> {
    const schema: DatabaseSchema = {
      id: uuidv4(),
      name: this.generateSchemaName(csvResults),
      tables: [],
      relationships: [],
      rlsPolicies: [],
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Generate tables from CSV results
    const tables = await this.generateTables(csvResults, aiAnalysis, options);
    schema.tables = tables;

    // Generate relationships
    const relationships = this.generateRelationships(tables, aiAnalysis);
    schema.relationships = relationships;

    // Generate RLS policies if requested
    if (options.includeRLS) {
      const rlsPolicies = this.generateRLSPolicies(tables);
      schema.rlsPolicies = rlsPolicies;
    }

    return schema;
  }

  /**
   * Generate tables from CSV results with AI enhancement
   */
  private async generateTables(
    csvResults: CSVParseResult[],
    aiAnalysis?: AISchemaAnalysis,
    options: {
      includeAuditColumns?: boolean;
      optimizeForPerformance?: boolean;
      targetWorkload?: 'oltp' | 'olap' | 'mixed';
    } = {}
  ): Promise<Table[]> {
    const tables: Table[] = [];

    for (const csvResult of csvResults) {
      const tableName = this.conventions.tableName(
        csvResult.fileName.replace(/\.[^.]+$/, '') // Remove extension
      );

      // Find AI suggestions for this table
      const aiTable = aiAnalysis?.tables.find(t => 
        this.conventions.tableName(t.name) === tableName
      );

      const table: Table = {
        id: uuidv4(),
        name: tableName,
        columns: [],
        indexes: [],
        comment: aiTable?.comment || `Generated from CSV file: ${csvResult.fileName}`,
      };

      // Generate primary key column (UUID)
      table.columns.push(this.createPrimaryKeyColumn());

      // Generate columns from CSV data
      for (const csvColumn of csvResult.columns) {
        const column = this.generateColumn(csvColumn, aiTable?.columns?.find(c => 
          this.conventions.columnName(c.name) === this.conventions.columnName(csvColumn.name)
        ));
        table.columns.push(column);
      }

      // Add audit columns if requested
      if (options.includeAuditColumns !== false) {
        table.columns.push(...this.createAuditColumns());
      }

      // Generate indexes
      table.indexes = this.generateIndexes(table, aiTable, options);

      tables.push(table);
    }

    return tables;
  }

  /**
   * Generate a column from CSV column data with AI enhancement
   */
  private generateColumn(
    csvColumn: {
      name: string;
      inferredType?: PostgresType;
      nullCount: number;
      totalCount: number;
      sampleValues: (string | null)[];
      uniqueValues?: Set<string>;
    },
    aiColumn?: {
      name: string;
      type: PostgresType;
      nullable: boolean;
      length?: number | undefined;
      precision?: number | undefined;
      scale?: number | undefined;
      defaultValue?: string | undefined;
      constraints: string[];
      reasoning: string;
    }
  ): Column {
    const columnName = this.conventions.columnName(csvColumn.name);

    const column: Column = {
      id: uuidv4(),
      name: columnName,
      type: this.mapToPostgresType(csvColumn, aiColumn ? { type: aiColumn.type } : undefined),
      nullable: this.determineNullability(csvColumn, aiColumn ? { nullable: aiColumn.nullable } : undefined),
      constraints: [],
      originalCSVColumn: csvColumn.name,
    };

    // Set length/precision based on data analysis
    if (this.needsLength(column.type)) {
      column.length = this.calculateOptimalLength(csvColumn, aiColumn?.length !== undefined ? { length: aiColumn.length } : undefined);
    }

    if (this.needsPrecision(column.type)) {
      const { precision, scale } = this.calculatePrecisionScale(csvColumn, 
        (aiColumn?.precision !== undefined && aiColumn?.scale !== undefined) ? 
          { precision: aiColumn.precision, scale: aiColumn.scale } : undefined
      );
      column.precision = precision;
      column.scale = scale;
    }

    // Add constraints
    column.constraints = this.generateColumnConstraints(csvColumn, aiColumn ? { constraints: aiColumn.constraints } : undefined);

    // Add default value if suggested
    if (aiColumn?.defaultValue) {
      column.defaultValue = aiColumn.defaultValue;
    }

    // Add comment
    if (aiColumn?.reasoning) {
      column.comment = aiColumn.reasoning;
    }

    return column;
  }

  /**
   * Map CSV column type to PostgreSQL type with AI enhancement
   */
  private mapToPostgresType(
    csvColumn: {
      inferredType?: PostgresType;
      sampleValues: (string | null)[];
    }, 
    aiColumn?: {
      type: PostgresType;
    }
  ): PostgresType {
    // Use AI suggestion if available and confident
    if (aiColumn?.type && this.isValidPostgresType(aiColumn.type)) {
      return aiColumn.type;
    }

    // Fall back to CSV inference
    if (csvColumn.inferredType) {
      return csvColumn.inferredType;
    }

    // Default mapping based on sample values
    const sampleValues = csvColumn.sampleValues?.filter(Boolean) || [];
    
    if (sampleValues.length === 0) {
      return 'TEXT';
    }

    // Analyze sample values
    const allNumbers = sampleValues.every(v => !isNaN(Number(v)));
    const allIntegers = allNumbers && sampleValues.every(v => Number.isInteger(Number(v)));
    const allDates = sampleValues.every(v => !isNaN(Date.parse(String(v))));
    const allBooleans = sampleValues.every(v => 
      ['true', 'false', '1', '0', 'yes', 'no'].includes(String(v).toLowerCase())
    );

    if (allBooleans) return 'BOOLEAN';
    if (allDates) return 'TIMESTAMP';
    if (allIntegers) return 'INTEGER';
    if (allNumbers) return 'NUMERIC';

    // Check for enum-like data
    const uniqueValues = new Set(sampleValues);
    if (uniqueValues.size <= 10 && sampleValues.length > uniqueValues.size * 2) {
      return 'VARCHAR'; // Could be enum, but use VARCHAR for flexibility
    }

    return 'TEXT';
  }

  /**
   * Generate column constraints based on data analysis
   */
  private generateColumnConstraints(
    csvColumn: {
      nullable?: boolean;
      nullCount: number;
      totalCount: number;
      uniqueValues?: Set<string>;
    }, 
    aiColumn?: {
      constraints: string[];
    }
  ): ColumnConstraint[] {
    const constraints: ColumnConstraint[] = [];

    // Use AI suggestions if available
    if (aiColumn?.constraints) {
      for (const constraintStr of aiColumn.constraints) {
        const constraint = this.parseConstraintString(constraintStr);
        if (constraint) {
          constraints.push(constraint);
        }
      }
    }

    // Add NOT NULL if low null percentage
    if (!csvColumn.nullable && csvColumn.nullCount / csvColumn.totalCount < 0.1) {
      constraints.push({ type: 'NOT NULL' });
    }

    // Add UNIQUE if high uniqueness
    if (csvColumn.uniqueValues) {
      const uniqueness = csvColumn.uniqueValues.size / csvColumn.totalCount;
      if (uniqueness > 0.95) {
        constraints.push({ type: 'UNIQUE' });
      }
    }

    return constraints;
  }

  /**
   * Generate relationships from AI analysis and naming patterns
   */
  private generateRelationships(tables: Table[], aiAnalysis?: AISchemaAnalysis): Relationship[] {
    const relationships: Relationship[] = [];

    if (aiAnalysis?.tables) {
      for (const aiTable of aiAnalysis.tables) {
        for (const aiRelationship of aiTable.relationships || []) {
          const sourceTable = tables.find(t => 
            this.conventions.tableName(t.name) === this.conventions.tableName(aiTable.name)
          );
          const targetTable = tables.find(t => 
            this.conventions.tableName(t.name) === this.conventions.tableName(aiRelationship.targetTable)
          );

          if (sourceTable && targetTable) {
            const relationship: Relationship = {
              id: uuidv4(),
              name: `fk_${sourceTable.name}_${aiRelationship.sourceColumn}`,
              sourceTable: sourceTable.id,
              sourceColumn: aiRelationship.sourceColumn,
              targetTable: targetTable.id,
              targetColumn: aiRelationship.targetColumn,
              type: aiRelationship.type,
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            };

            relationships.push(relationship);
          }
        }
      }
    }

    // Also detect relationships from naming patterns
    const patternBasedRelationships = this.detectRelationshipsByPattern(tables);
    relationships.push(...patternBasedRelationships);

    return relationships;
  }

  /**
   * Generate indexes for optimal performance
   */
  private generateIndexes(
    table: Table,
    aiTable?: {
      indexes: Array<{
        name: string;
        columns: string[];
        unique: boolean;
      }>;
    },
    options: {
      optimizeForPerformance?: boolean;
      targetWorkload?: 'oltp' | 'olap' | 'mixed';
    } = {}
  ): Index[] {
    const indexes: Index[] = [];

    // Use AI suggestions
    if (aiTable?.indexes) {
      for (const aiIndex of aiTable.indexes) {
        indexes.push({
          id: uuidv4(),
          name: aiIndex.name,
          columns: aiIndex.columns,
          unique: aiIndex.unique,
          type: 'BTREE',
        });
      }
    }

    // Add standard indexes
    if (options.optimizeForPerformance) {
      // Index on created_at for time-based queries
      const createdAtColumn = table.columns.find(c => c.name === 'created_at');
      if (createdAtColumn) {
        indexes.push({
          id: uuidv4(),
          name: this.conventions.indexName(table.name, ['created_at']),
          columns: ['created_at'],
          unique: false,
          type: 'BTREE',
        });
      }

      // Index on foreign key columns
      for (const column of table.columns) {
        if (column.name.endsWith('_id') && column.name !== 'id') {
          indexes.push({
            id: uuidv4(),
            name: this.conventions.indexName(table.name, [column.name]),
            columns: [column.name],
            unique: false,
            type: 'BTREE',
          });
        }
      }
    }

    return indexes;
  }

  /**
   * Generate RLS policies for security
   */
  private generateRLSPolicies(tables: Table[]): RLSPolicy[] {
    const policies: RLSPolicy[] = [];

    for (const table of tables) {
      // Basic RLS policy for authenticated users
      policies.push({
        id: uuidv4(),
        tableName: table.name,
        name: `${table.name}_policy`,
        command: 'ALL',
        using: 'auth.uid() IS NOT NULL',
        roles: ['authenticated'],
      });
    }

    return policies;
  }

  /**
   * Export schema to various formats
   */
  exportSchema(schema: DatabaseSchema, options: SchemaExportOptions): SchemaExportResult {
    switch (options.format) {
      case 'migration':
        return this.exportAsMigration(schema, options);
      case 'declarative':
        return this.exportAsDeclarative(schema);
      case 'prisma':
        return this.exportAsPrisma(schema);
      case 'typescript':
        return this.exportAsTypeScript(schema);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export as SQL migration
   */
  private exportAsMigration(schema: DatabaseSchema, options: SchemaExportOptions): SchemaExportResult {
    const sql: string[] = [];
    
    // Header comment
    sql.push(`-- Migration: ${schema.name}`);
    sql.push(`-- Generated: ${new Date().toISOString()}`);
    sql.push(`-- Tables: ${schema.tables.length}`);
    sql.push('');

    // Enable UUID extension
    sql.push('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    sql.push('');

    // Create tables
    for (const table of schema.tables) {
      sql.push(this.generateCreateTableSQL(table));
      sql.push('');
    }

    // Create indexes
    if (options.includeIndexes) {
      for (const table of schema.tables) {
        for (const index of table.indexes) {
          sql.push(this.generateCreateIndexSQL(table, index));
        }
      }
      sql.push('');
    }

    // Create relationships
    for (const relationship of schema.relationships) {
      sql.push(this.generateAddForeignKeySQL(relationship, schema));
    }

    // Enable RLS
    if (options.includeRLS && schema.rlsPolicies.length > 0) {
      sql.push('');
      sql.push('-- Enable RLS');
      for (const table of schema.tables) {
        sql.push(`ALTER TABLE ${table.name} ENABLE ROW LEVEL SECURITY;`);
      }
      
      // Create policies
      for (const policy of schema.rlsPolicies) {
        sql.push(this.generateCreatePolicySQL(policy));
      }
    }

    return {
      content: sql.join('\n'),
      filename: `${schema.name.replace(/[^a-zA-Z0-9]/g, '_')}_migration.sql`,
      type: 'application/sql',
    };
  }

  /**
   * Helper methods for SQL generation
   */
  private generateCreateTableSQL(table: Table): string {
    const columns = table.columns.map(col => {
      let columnDef = `  ${col.name} ${col.type}`;
      
      if (col.length) {
        columnDef += `(${col.length})`;
      } else if (col.precision && col.scale) {
        columnDef += `(${col.precision}, ${col.scale})`;
      } else if (col.precision) {
        columnDef += `(${col.precision})`;
      }

      for (const constraint of col.constraints) {
        if (constraint.type === 'NOT NULL') {
          columnDef += ' NOT NULL';
        } else if (constraint.type === 'UNIQUE') {
          columnDef += ' UNIQUE';
        } else if (constraint.type === 'PRIMARY KEY') {
          columnDef += ' PRIMARY KEY';
        } else if (constraint.type === 'DEFAULT' && col.defaultValue) {
          columnDef += ` DEFAULT ${col.defaultValue}`;
        }
      }

      return columnDef;
    }).join(',\n');

    let sql = `CREATE TABLE ${table.name} (\n${columns}\n)`;
    
    if (table.comment) {
      sql += `;\nCOMMENT ON TABLE ${table.name} IS '${table.comment}';`;
    }

    return sql + ';';
  }

  private generateCreateIndexSQL(table: Table, index: Index): string {
    const unique = index.unique ? 'UNIQUE ' : '';
    const type = index.type ? ` USING ${index.type}` : '';
    const columns = index.columns.join(', ');
    
    return `CREATE ${unique}INDEX ${index.name} ON ${table.name}${type} (${columns});`;
  }

  private generateAddForeignKeySQL(relationship: Relationship, schema: DatabaseSchema): string {
    const sourceTable = schema.tables.find(t => t.id === relationship.sourceTable);
    const targetTable = schema.tables.find(t => t.id === relationship.targetTable);
    
    if (!sourceTable || !targetTable) {
      return '-- Error: Could not find source or target table';
    }

    const onDelete = relationship.onDelete ? ` ON DELETE ${relationship.onDelete}` : '';
    const onUpdate = relationship.onUpdate ? ` ON UPDATE ${relationship.onUpdate}` : '';
    
    return `ALTER TABLE ${sourceTable.name} ADD CONSTRAINT ${relationship.name} FOREIGN KEY (${relationship.sourceColumn}) REFERENCES ${targetTable.name}(${relationship.targetColumn})${onDelete}${onUpdate};`;
  }

  private generateCreatePolicySQL(policy: RLSPolicy): string {
    let sql = `CREATE POLICY ${policy.name} ON ${policy.tableName}`;
    
    if (policy.command !== 'ALL') {
      sql += ` FOR ${policy.command}`;
    }
    
    if (policy.roles) {
      sql += ` TO ${policy.roles.join(', ')}`;
    }
    
    if (policy.using) {
      sql += ` USING (${policy.using})`;
    }
    
    if (policy.withCheck) {
      sql += ` WITH CHECK (${policy.withCheck})`;
    }
    
    return sql + ';';
  }

  // Utility methods
  private createPrimaryKeyColumn(): Column {
    return {
      id: uuidv4(),
      name: 'id',
      type: 'UUID',
      nullable: false,
      constraints: [
        { type: 'PRIMARY KEY' },
        { type: 'DEFAULT', value: 'gen_random_uuid()' }
      ],
      comment: 'Primary key (UUID)',
    };
  }

  private createAuditColumns(): Column[] {
    return [
      {
        id: uuidv4(),
        name: 'created_at',
        type: 'TIMESTAMPTZ',
        nullable: false,
        constraints: [{ type: 'DEFAULT', value: 'NOW()' }],
        comment: 'Record creation timestamp',
      },
      {
        id: uuidv4(),
        name: 'updated_at',
        type: 'TIMESTAMPTZ',
        nullable: false,
        constraints: [{ type: 'DEFAULT', value: 'NOW()' }],
        comment: 'Record last update timestamp',
      },
    ];
  }

  private generateSchemaName(csvResults: CSVParseResult[]): string {
    if (csvResults.length === 1) {
      return csvResults[0].fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
    }
    return `multi_table_schema_${Date.now()}`;
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private determineNullability(
    csvColumn: { nullCount: number; totalCount: number }, 
    aiColumn?: { nullable?: boolean }
  ): boolean {
    if (aiColumn?.nullable !== undefined) {
      return aiColumn.nullable;
    }
    
    // Allow nulls if more than 5% of values are null
    return csvColumn.nullCount / csvColumn.totalCount > 0.05;
  }

  private needsLength(type: PostgresType): boolean {
    return ['VARCHAR', 'CHAR'].includes(type);
  }

  private needsPrecision(type: PostgresType): boolean {
    return ['NUMERIC', 'DECIMAL'].includes(type);
  }

  private calculateOptimalLength(
    csvColumn: { sampleValues: (string | null)[] }, 
    aiColumn?: { length?: number }
  ): number {
    if (aiColumn?.length) {
      return aiColumn.length;
    }

    // Calculate based on sample values
    const maxLength = Math.max(
      ...csvColumn.sampleValues
        .filter(Boolean)
        .map(v => String(v).length)
    );

    // Add 20% buffer, minimum 50, maximum 255
    return Math.min(Math.max(Math.ceil(maxLength * 1.2), 50), 255);
  }

  private calculatePrecisionScale(
    csvColumn: { sampleValues: (string | null)[] }, 
    aiColumn?: { precision?: number; scale?: number }
  ): { precision: number; scale: number } {
    if (aiColumn?.precision && aiColumn?.scale) {
      return { precision: aiColumn.precision, scale: aiColumn.scale };
    }

    // Analyze decimal values
    const decimalValues = csvColumn.sampleValues
      .filter(Boolean)
      .map(v => String(v))
      .filter((v: string) => v.includes('.'));

    if (decimalValues.length === 0) {
      return { precision: 10, scale: 2 }; // Default
    }

    const maxScale = Math.max(...decimalValues.map(v => v.split('.')[1]?.length || 0));
    const maxPrecision = Math.max(...decimalValues.map(v => v.replace('.', '').length));

    return {
      precision: Math.min(maxPrecision + 2, 19), // Add buffer, cap at 19
      scale: Math.min(maxScale, 4), // Cap scale at 4
    };
  }

  private isValidPostgresType(type: string): type is PostgresType {
    const validTypes: PostgresType[] = [
      'VARCHAR', 'TEXT', 'CHAR', 'SMALLINT', 'INTEGER', 'BIGINT',
      'NUMERIC', 'DECIMAL', 'REAL', 'DOUBLE PRECISION', 'BOOLEAN',
      'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'UUID', 'JSONB',
      'JSON', 'ARRAY', 'ENUM'
    ];
    return validTypes.includes(type as PostgresType);
  }

  private parseConstraintString(constraintStr: string): ColumnConstraint | null {
    const str = constraintStr.toUpperCase().trim();
    
    if (str === 'NOT NULL') {
      return { type: 'NOT NULL' };
    } else if (str === 'UNIQUE') {
      return { type: 'UNIQUE' };
    } else if (str === 'PRIMARY KEY') {
      return { type: 'PRIMARY KEY' };
    } else if (str.startsWith('DEFAULT ')) {
      return { type: 'DEFAULT', value: str.substring(8) };
    }
    
    return null;
  }

  private detectRelationshipsByPattern(tables: Table[]): Relationship[] {
    const relationships: Relationship[] = [];
    
    // Look for foreign key patterns (columns ending with _id)
    for (const table of tables) {
      for (const column of table.columns) {
        if (column.name.endsWith('_id') && column.name !== 'id') {
          const referencedTableName = column.name.slice(0, -3); // Remove '_id'
          const referencedTable = tables.find(t => 
            t.name === referencedTableName || 
            t.name === `${referencedTableName}s` ||
            t.name === `${referencedTableName}es`
          );
          
          if (referencedTable) {
            relationships.push({
              id: uuidv4(),
              name: `fk_${table.name}_${column.name}`,
              sourceTable: table.id,
              sourceColumn: column.name,
              targetTable: referencedTable.id,
              targetColumn: 'id',
              type: 'one-to-many',
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            });
          }
        }
      }
    }
    
    return relationships;
  }

  private exportAsDeclarative(schema: DatabaseSchema): SchemaExportResult {
    // Implement declarative export (e.g., for tools like Supabase CLI)
    return {
      content: JSON.stringify(schema, null, 2),
      filename: `${schema.name}_schema.json`,
      type: 'application/json',
    };
  }

  private exportAsPrisma(schema: DatabaseSchema): SchemaExportResult {
    // Implement Prisma schema export
    const prismaSchema = this.generatePrismaSchema(schema);
    return {
      content: prismaSchema,
      filename: 'schema.prisma',
      type: 'text/plain',
    };
  }

  private exportAsTypeScript(schema: DatabaseSchema): SchemaExportResult {
    // Implement TypeScript type definitions export
    const typeDefinitions = this.generateTypeDefinitions(schema);
    return {
      content: typeDefinitions,
      filename: 'database.types.ts',
      type: 'text/plain',
    };
  }

  private generatePrismaSchema(schema: DatabaseSchema): string {
    // Placeholder for Prisma schema generation
    return `// Prisma schema for ${schema.name}\n// TODO: Implement Prisma export`;
  }

  private generateTypeDefinitions(schema: DatabaseSchema): string {
    // Placeholder for TypeScript definitions generation
    return `// TypeScript definitions for ${schema.name}\n// TODO: Implement TypeScript export`;
  }
}