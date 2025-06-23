import type { 
  DatabaseSchema, 
  Table, 
  Column, 
  Relationship, 
  Index,
  RLSPolicy 
} from '@/types/schema.types';

export interface MigrationOptions {
  format: 'migration' | 'declarative' | 'prisma';
  includeDropStatements?: boolean;
  includeComments?: boolean;
  includeRLS?: boolean;
  includeIndexes?: boolean;
  includeSampleData?: boolean;
  timestampPrefix?: boolean;
}

export interface GeneratedMigration {
  filename: string;
  content: string;
  description: string;
  type: 'sql' | 'prisma' | 'typescript';
}

/**
 * Formats a database schema into various migration formats
 */
export class MigrationFormatter {
  private schema: DatabaseSchema;
  private options: MigrationOptions;

  constructor(schema: DatabaseSchema, options: Partial<MigrationOptions> = {}) {
    this.schema = schema;
    this.options = {
      format: 'migration',
      includeDropStatements: false,
      includeComments: true,
      includeRLS: true,
      includeIndexes: true,
      includeSampleData: false,
      timestampPrefix: true,
      ...options
    };
  }

  /**
   * Generate migration files based on the configured format
   */
  generateMigration(): GeneratedMigration[] {
    switch (this.options.format) {
      case 'migration':
        return this.generateSupabaseMigration();
      case 'declarative':
        return this.generateDeclarativeSQL();
      case 'prisma':
        return this.generatePrismaSchema();
      default:
        throw new Error(`Unsupported format: ${this.options.format}`);
    }
  }

  /**
   * Generate Supabase migration format
   */
  private generateSupabaseMigration(): GeneratedMigration[] {
    const migrations: GeneratedMigration[] = [];
    const timestamp = this.options.timestampPrefix 
      ? new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)
      : '';

    // Main migration file
    const mainMigration = this.generateMainMigration();
    migrations.push({
      filename: `${timestamp}_create_${this.schema.name.toLowerCase().replace(/\s+/g, '_')}_schema.sql`,
      content: mainMigration,
      description: `Create ${this.schema.name} database schema`,
      type: 'sql'
    });

    // RLS policies if enabled
    if (this.options.includeRLS && this.schema.rlsPolicies.length > 0) {
      const rlsMigration = this.generateRLSMigration();
      migrations.push({
        filename: `${timestamp}_setup_rls_policies.sql`,
        content: rlsMigration,
        description: 'Setup Row Level Security policies',
        type: 'sql'
      });
    }

    return migrations;
  }

  /**
   * Generate declarative SQL (single file)
   */
  private generateDeclarativeSQL(): GeneratedMigration[] {
    const content = this.generateCompleteSchema();
    return [{
      filename: `${this.schema.name.toLowerCase().replace(/\s+/g, '_')}_schema.sql`,
      content,
      description: `Complete ${this.schema.name} database schema`,
      type: 'sql'
    }];
  }

  /**
   * Generate Prisma schema
   */
  private generatePrismaSchema(): GeneratedMigration[] {
    const content = this.generatePrismaContent();
    return [{
      filename: 'schema.prisma',
      content,
      description: 'Prisma schema configuration',
      type: 'prisma'
    }];
  }

  /**
   * Generate main migration content
   */
  private generateMainMigration(): string {
    const parts: string[] = [];

    // Header comment
    if (this.options.includeComments) {
      parts.push(this.generateMigrationHeader());
    }

    // Drop statements (if enabled)
    if (this.options.includeDropStatements) {
      parts.push(this.generateDropStatements());
    }

    // Create tables
    parts.push(this.generateCreateTables());

    // Add relationships (foreign keys)
    if (this.schema.relationships.length > 0) {
      parts.push(this.generateRelationships());
    }

    // Create indexes
    if (this.options.includeIndexes) {
      parts.push(this.generateIndexes());
    }

    // Include RLS in main migration to ensure it's executed together
    if (this.options.includeRLS && this.schema.rlsPolicies.length > 0) {
      parts.push(this.generateRLSMigration());
    }

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Generate complete schema (declarative)
   */
  private generateCompleteSchema(): string {
    const parts: string[] = [];

    if (this.options.includeComments) {
      parts.push(this.generateSchemaHeader());
    }

    // Extensions
    parts.push(this.generateExtensions());

    // Tables
    parts.push(this.generateCreateTables());

    // Relationships
    if (this.schema.relationships.length > 0) {
      parts.push(this.generateRelationships());
    }

    // Indexes
    if (this.options.includeIndexes) {
      parts.push(this.generateIndexes());
    }

    // RLS
    if (this.options.includeRLS) {
      parts.push(this.generateRLSMigration());
    }

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Generate migration header comment
   */
  private generateMigrationHeader(): string {
    return `-- Migration: Create ${this.schema.name} Schema
-- Generated on: ${new Date().toISOString()}
-- Tables: ${this.schema.tables.length}
-- Relationships: ${this.schema.relationships.length}
-- Indexes: ${this.schema.tables.reduce((acc, table) => acc + table.indexes.length, 0)}
-- RLS Policies: ${this.schema.rlsPolicies.length}`;
  }

  /**
   * Generate schema header comment
   */
  private generateSchemaHeader(): string {
    return `-- ${this.schema.name} Database Schema
-- Generated by Dreamschema
-- 
-- This file contains the complete database schema including:
-- • Table definitions with constraints
-- • Relationships and foreign keys
-- • Indexes for performance optimization
-- • Row Level Security (RLS) policies
-- 
-- Generated on: ${new Date().toISOString()}`;
  }

  /**
   * Generate drop statements
   */
  private generateDropStatements(): string {
    const drops: string[] = [];

    // Drop tables in reverse dependency order
    const orderedTables = this.getTablesInDependencyOrder().reverse();
    
    drops.push('-- Drop existing tables (in dependency order)');
    orderedTables.forEach(table => {
      drops.push(`DROP TABLE IF EXISTS "${table.name}" CASCADE;`);
    });

    return drops.join('\n');
  }

  /**
   * Generate extensions
   */
  private generateExtensions(): string {
    const extensions: string[] = [];
    
    extensions.push('-- Enable required extensions');
    extensions.push('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // Check if we need pgcrypto for any encrypted columns
    const needsCrypto = this.schema.tables.some(table =>
      table.columns.some(col => col.type === 'UUID' && col.defaultValue?.includes('uuid_generate_v4'))
    );
    
    if (needsCrypto) {
      extensions.push('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    }

    return extensions.join('\n');
  }

  /**
   * Generate table creation statements
   */
  private generateCreateTables(): string {
    const tables: string[] = [];
    
    tables.push('-- Create tables');
    
    // Create tables in dependency order
    const orderedTables = this.getTablesInDependencyOrder();
    
    orderedTables.forEach(table => {
      tables.push(this.generateCreateTable(table));
    });

    return tables.join('\n\n');
  }

  /**
   * Generate single table creation statement
   */
  private generateCreateTable(table: Table): string {
    const lines: string[] = [];
    
    if (this.options.includeComments && table.comment) {
      lines.push(`-- ${table.comment}`);
    }
    
    lines.push(`CREATE TABLE "${table.name}" (`);
    
    // Columns
    const columnDefs = table.columns.map(col => this.generateColumnDefinition(col));
    lines.push('  ' + columnDefs.join(',\n  '));
    
    lines.push(');');

    // Add table comment
    if (this.options.includeComments && table.comment) {
      lines.push(`COMMENT ON TABLE "${table.name}" IS '${table.comment.replace(/'/g, "''")}';`);
    }

    // Add column comments
    if (this.options.includeComments) {
      table.columns.forEach(col => {
        if (col.comment) {
          lines.push(`COMMENT ON COLUMN "${table.name}"."${col.name}" IS '${col.comment.replace(/'/g, "''")}';`);
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Generate column definition
   */
  private generateColumnDefinition(column: Column): string {
    let definition = `"${column.name}" ${this.getPostgresType(column)}`;

    // Add constraints
    const constraints = column.constraints
      .filter(c => c.type !== 'FOREIGN KEY') // Foreign keys handled separately
      .map(c => this.formatConstraint(c))
      .filter(Boolean);

    if (constraints.length > 0) {
      definition += ` ${constraints.join(' ')}`;
    }

    // Add NOT NULL if specified
    if (!column.nullable && !column.constraints.some(c => c.type === 'NOT NULL')) {
      definition += ' NOT NULL';
    }

    // Add default value
    if (column.defaultValue && !column.constraints.some(c => c.type === 'DEFAULT')) {
      definition += ` DEFAULT ${column.defaultValue}`;
    }

    return definition;
  }

  /**
   * Get PostgreSQL type for column
   */
  private getPostgresType(column: Column): string {
    switch (column.type) {
      case 'VARCHAR':
        return `VARCHAR(${column.length || 255})`;
      case 'CHAR':
        return `CHAR(${column.length || 1})`;
      case 'NUMERIC':
      case 'DECIMAL':
        if (column.precision && column.scale) {
          return `${column.type}(${column.precision},${column.scale})`;
        } else if (column.precision) {
          return `${column.type}(${column.precision})`;
        }
        return column.type;
      default:
        return column.type;
    }
  }

  /**
   * Format constraint for SQL
   */
  private formatConstraint(constraint: Column['constraints'][0]): string {
    switch (constraint.type) {
      case 'PRIMARY KEY':
        return 'PRIMARY KEY';
      case 'UNIQUE':
        return 'UNIQUE';
      case 'NOT NULL':
        return 'NOT NULL';
      case 'DEFAULT':
        return `DEFAULT ${constraint.value}`;
      case 'CHECK':
        return `CHECK (${constraint.value})`;
      default:
        return '';
    }
  }

  /**
   * Generate relationship (foreign key) statements
   */
  private generateRelationships(): string {
    const relationships: string[] = [];
    
    relationships.push('-- Add foreign key constraints');
    
    this.schema.relationships.forEach(rel => {
      relationships.push(this.generateForeignKey(rel));
    });

    return relationships.join('\n');
  }

  /**
   * Generate foreign key statement
   */
  private generateForeignKey(relationship: Relationship): string {
    const constraintName = `fk_${relationship.sourceTable}_${relationship.sourceColumn}`;
    
    let sql = `ALTER TABLE "${relationship.sourceTable}" ADD CONSTRAINT "${constraintName}" `;
    sql += `FOREIGN KEY ("${relationship.sourceColumn}") `;
    sql += `REFERENCES "${relationship.targetTable}"("${relationship.targetColumn}")`;
    
    if (relationship.onDelete) {
      sql += ` ON DELETE ${relationship.onDelete}`;
    }
    
    if (relationship.onUpdate) {
      sql += ` ON UPDATE ${relationship.onUpdate}`;
    }
    
    sql += ';';
    
    return sql;
  }

  /**
   * Generate index statements
   */
  private generateIndexes(): string {
    const indexes: string[] = [];
    
    indexes.push('-- Create indexes');
    
    this.schema.tables.forEach(table => {
      table.indexes.forEach(index => {
        indexes.push(this.generateIndex(table.name, index));
      });
    });

    return indexes.join('\n');
  }

  /**
   * Generate single index statement
   */
  private generateIndex(tableName: string, index: Index): string {
    const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
    const indexType = index.type ? ` USING ${index.type}` : '';
    const columns = index.columns.map(col => `"${col}"`).join(', ');
    
    return `CREATE ${uniqueKeyword}INDEX "${index.name}" ON "${tableName}"${indexType} (${columns});`;
  }

  /**
   * Generate RLS migration
   */
  private generateRLSMigration(): string {
    if (this.schema.rlsPolicies.length === 0) {
      return '';
    }

    const rls: string[] = [];
    
    rls.push('-- Enable Row Level Security');
    
    // Get unique table names
    const tableNames = [...new Set(this.schema.rlsPolicies.map(p => p.tableName))];
    
    // Enable RLS on tables
    tableNames.forEach(tableName => {
      rls.push(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`);
    });

    rls.push('');
    rls.push('-- Create RLS policies');
    
    // Create policies
    this.schema.rlsPolicies.forEach(policy => {
      rls.push(this.generateRLSPolicy(policy));
    });

    return rls.join('\n');
  }

  /**
   * Generate RLS policy statement
   */
  private generateRLSPolicy(policy: RLSPolicy): string {
    let sql = `CREATE POLICY "${policy.name}" ON "${policy.tableName}" FOR ${policy.command}`;
    
    if (policy.roles && policy.roles.length > 0) {
      sql += ` TO ${policy.roles.join(', ')}`;
    }
    
    if (policy.using) {
      sql += ` USING (${policy.using})`;
    }
    
    if (policy.withCheck) {
      sql += ` WITH CHECK (${policy.withCheck})`;
    }
    
    sql += ';';
    
    return sql;
  }

  /**
   * Generate Prisma schema content
   */
  private generatePrismaContent(): string {
    const lines: string[] = [];

    // Generator and datasource
    lines.push('generator client {');
    lines.push('  provider = "prisma-client-js"');
    lines.push('}');
    lines.push('');
    lines.push('datasource db {');
    lines.push('  provider = "postgresql"');
    lines.push('  url      = env("DATABASE_URL")');
    lines.push('}');
    lines.push('');

    // Models
    this.schema.tables.forEach(table => {
      lines.push(this.generatePrismaModel(table));
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Generate Prisma model
   */
  private generatePrismaModel(table: Table): string {
    const lines: string[] = [];
    
    lines.push(`model ${this.toPascalCase(table.name)} {`);
    
    // Fields
    table.columns.forEach(col => {
      lines.push(`  ${this.generatePrismaField(col)}`);
    });

    // Relations
    const relations = this.schema.relationships.filter(rel => 
      rel.sourceTable === table.name || rel.targetTable === table.name
    );
    
    relations.forEach(rel => {
      if (rel.sourceTable === table.name) {
        const targetTable = this.schema.tables.find(t => t.name === rel.targetTable);
        if (targetTable) {
          lines.push(`  ${this.toCamelCase(rel.targetTable)} ${this.toPascalCase(rel.targetTable)}? @relation(fields: [${this.toCamelCase(rel.sourceColumn)}], references: [${this.toCamelCase(rel.targetColumn)}])`);
        }
      }
    });

    lines.push('}');
    
    return lines.join('\n');
  }

  /**
   * Generate Prisma field
   */
  private generatePrismaField(column: Column): string {
    const isPrimary = column.constraints.some(c => c.type === 'PRIMARY KEY');
    const isUnique = column.constraints.some(c => c.type === 'UNIQUE');
    const isOptional = column.nullable ? '?' : '';
    
    let field = `${this.toCamelCase(column.name)} ${this.getPrismaType(column)}${isOptional}`;
    
    const attributes: string[] = [];
    
    if (isPrimary) {
      attributes.push('@id');
    }
    
    if (isUnique && !isPrimary) {
      attributes.push('@unique');
    }
    
    if (column.defaultValue) {
      if (column.defaultValue === 'uuid_generate_v4()') {
        attributes.push('@default(uuid())');
      } else if (column.defaultValue === 'NOW()') {
        attributes.push('@default(now())');
      } else {
        attributes.push(`@default(${column.defaultValue})`);
      }
    }
    
    if (column.name !== this.toCamelCase(column.name)) {
      attributes.push(`@map("${column.name}")`);
    }
    
    if (attributes.length > 0) {
      field += ` ${attributes.join(' ')}`;
    }
    
    return field;
  }

  /**
   * Get Prisma type for column
   */
  private getPrismaType(column: Column): string {
    switch (column.type) {
      case 'UUID':
        return 'String';
      case 'VARCHAR':
      case 'CHAR':
      case 'TEXT':
        return 'String';
      case 'INTEGER':
      case 'SMALLINT':
        return 'Int';
      case 'BIGINT':
        return 'BigInt';
      case 'NUMERIC':
      case 'DECIMAL':
      case 'REAL':
      case 'DOUBLE PRECISION':
        return 'Decimal';
      case 'BOOLEAN':
        return 'Boolean';
      case 'DATE':
      case 'TIMESTAMP':
      case 'TIMESTAMPTZ':
        return 'DateTime';
      case 'JSONB':
      case 'JSON':
        return 'Json';
      default:
        return 'String';
    }
  }

  /**
   * Get tables in dependency order (for creation)
   */
  private getTablesInDependencyOrder(): Table[] {
    const ordered: Table[] = [];
    const remaining = [...this.schema.tables];
    const processing = new Set<string>();

    const addTable = (tableName: string) => {
      if (processing.has(tableName)) {
        // Circular dependency - add anyway
        return;
      }
      
      const table = remaining.find(t => t.name === tableName);
      if (!table || ordered.includes(table)) {
        return;
      }

      processing.add(tableName);

      // Add dependencies first
      const dependencies = this.schema.relationships
        .filter(rel => rel.sourceTable === tableName)
        .map(rel => rel.targetTable)
        .filter(target => target !== tableName); // Avoid self-references

      dependencies.forEach(dep => addTable(dep));

      ordered.push(table);
      remaining.splice(remaining.indexOf(table), 1);
      processing.delete(tableName);
    };

    // Process all tables
    while (remaining.length > 0) {
      addTable(remaining[0].name);
    }

    return ordered;
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split(/[_\s-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Convert string to camelCase
   */
  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
}

/**
 * Convenience function to generate migrations
 */
export function generateMigrations(
  schema: DatabaseSchema, 
  options: Partial<MigrationOptions> = {}
): GeneratedMigration[] {
  const formatter = new MigrationFormatter(schema, options);
  return formatter.generateMigration();
}