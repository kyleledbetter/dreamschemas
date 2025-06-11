import type { DatabaseSchema, Table, Column } from '@/types/schema.types';
import type { GeneratedMigration } from './migration-formatter';

export interface TypeGeneratorOptions {
  format: 'typescript' | 'supabase' | 'prisma-client';
  includeComments?: boolean;
  includeInsertTypes?: boolean;
  includeUpdateTypes?: boolean;
  includeSelectTypes?: boolean;
  exportDefault?: boolean;
  namespace?: string;
}

/**
 * Generates TypeScript types from database schema
 */
export class TypeGenerator {
  private schema: DatabaseSchema;
  private options: TypeGeneratorOptions;

  constructor(schema: DatabaseSchema, options: Partial<TypeGeneratorOptions> = {}) {
    this.schema = schema;
    this.options = {
      format: 'typescript',
      includeComments: true,
      includeInsertTypes: true,
      includeUpdateTypes: true,
      includeSelectTypes: true,
      exportDefault: false,
      ...options
    };
  }

  /**
   * Generate TypeScript types
   */
  generateTypes(): GeneratedMigration[] {
    switch (this.options.format) {
      case 'typescript':
        return this.generateTypescriptTypes();
      case 'supabase':
        return this.generateSupabaseTypes();
      case 'prisma-client':
        return this.generatePrismaClientTypes();
      default:
        throw new Error(`Unsupported type format: ${this.options.format}`);
    }
  }

  /**
   * Generate standard TypeScript types
   */
  private generateTypescriptTypes(): GeneratedMigration[] {
    const content = this.generateTypescriptContent();
    
    return [{
      filename: 'database.types.ts',
      content,
      description: 'TypeScript type definitions for database schema',
      type: 'typescript'
    }];
  }

  /**
   * Generate Supabase-style types
   */
  private generateSupabaseTypes(): GeneratedMigration[] {
    const content = this.generateSupabaseTypesContent();
    
    return [{
      filename: 'supabase.types.ts',
      content,
      description: 'Supabase-compatible type definitions',
      type: 'typescript'
    }];
  }

  /**
   * Generate Prisma client types
   */
  private generatePrismaClientTypes(): GeneratedMigration[] {
    const content = this.generatePrismaClientContent();
    
    return [{
      filename: 'prisma.types.ts',
      content,
      description: 'Prisma client type definitions',
      type: 'typescript'
    }];
  }

  /**
   * Generate TypeScript content
   */
  private generateTypescriptContent(): string {
    const lines: string[] = [];

    // Header
    if (this.options.includeComments) {
      lines.push(this.generateTypeHeader());
    }

    // Namespace or module declaration
    if (this.options.namespace) {
      lines.push(`export namespace ${this.options.namespace} {`);
    }

    // Generate types for each table
    this.schema.tables.forEach(table => {
      lines.push(this.generateTableTypes(table));
      lines.push('');
    });

    // Database interface
    lines.push(this.generateDatabaseInterface());

    // Close namespace
    if (this.options.namespace) {
      lines.push('}');
    }

    return lines.join('\n');
  }

  /**
   * Generate Supabase types content
   */
  private generateSupabaseTypesContent(): string {
    const lines: string[] = [];

    if (this.options.includeComments) {
      lines.push('// Supabase Database Types');
      lines.push('// Generated from schema');
      lines.push('');
    }

    lines.push('export type Json =');
    lines.push('  | string');
    lines.push('  | number');
    lines.push('  | boolean');
    lines.push('  | null');
    lines.push('  | { [key: string]: Json | undefined }');
    lines.push('  | Json[]');
    lines.push('');

    lines.push('export interface Database {');
    lines.push('  public: {');
    lines.push('    Tables: {');

    this.schema.tables.forEach((table, index) => {
      lines.push(`      ${table.name}: {`);
      lines.push('        Row: {');
      
      table.columns.forEach(col => {
        const nullable = col.nullable ? ' | null' : '';
        lines.push(`          ${col.name}: ${this.getSupabaseType(col)}${nullable};`);
      });
      
      lines.push('        };');
      lines.push('        Insert: {');
      
      table.columns.forEach(col => {
        const hasDefault = col.defaultValue || col.constraints.some(c => c.type === 'DEFAULT');
        const nullable = col.nullable || hasDefault ? '?' : '';
        const type = col.nullable ? ` ${this.getSupabaseType(col)} | null` : ` ${this.getSupabaseType(col)}`;
        lines.push(`          ${col.name}${nullable}:${type};`);
      });
      
      lines.push('        };');
      lines.push('        Update: {');
      
      table.columns.forEach(col => {
        const nullable = col.nullable ? ' | null' : '';
        lines.push(`          ${col.name}?: ${this.getSupabaseType(col)}${nullable};`);
      });
      
      lines.push('        };');
      lines.push('        Relationships: [');
      
      // Add relationships
      const relationships = this.schema.relationships.filter(rel => rel.sourceTable === table.name);
      relationships.forEach(rel => {
        lines.push('          {');
        lines.push(`            foreignKeyName: "fk_${rel.sourceTable}_${rel.sourceColumn}";`);
        lines.push(`            columns: ["${rel.sourceColumn}"];`);
        lines.push(`            referencedRelation: "${rel.targetTable}";`);
        lines.push(`            referencedColumns: ["${rel.targetColumn}"];`);
        lines.push('          },');
      });
      
      lines.push('        ];');
      lines.push(`      }${index < this.schema.tables.length - 1 ? ';' : ''}`);
    });

    lines.push('    };');
    lines.push('    Views: {');
    lines.push('      [_ in never]: never;');
    lines.push('    };');
    lines.push('    Functions: {');
    lines.push('      [_ in never]: never;');
    lines.push('    };');
    lines.push('    Enums: {');
    lines.push('      [_ in never]: never;');
    lines.push('    };');
    lines.push('    CompositeTypes: {');
    lines.push('      [_ in never]: never;');
    lines.push('    };');
    lines.push('  };');
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate Prisma client content
   */
  private generatePrismaClientContent(): string {
    const lines: string[] = [];

    if (this.options.includeComments) {
      lines.push('// Prisma Client Types');
      lines.push('// Import these from @prisma/client after generation');
      lines.push('');
    }

    lines.push('// Re-export Prisma types');
    lines.push('export {');
    this.schema.tables.forEach(table => {
      const modelName = this.toPascalCase(table.name);
      lines.push(`  ${modelName},`);
    });
    lines.push('} from "@prisma/client";');
    lines.push('');

    // Custom types for better DX
    this.schema.tables.forEach(table => {
      const modelName = this.toPascalCase(table.name);
      lines.push(`export type ${modelName}CreateInput = Omit<${modelName}, 'id' | 'createdAt' | 'updatedAt'>;`);
      lines.push(`export type ${modelName}UpdateInput = Partial<${modelName}CreateInput>;`);
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Generate type header
   */
  private generateTypeHeader(): string {
    return `// ${this.schema.name} Database Types
// Generated by Dreamschema on ${new Date().toISOString()}
// 
// This file contains TypeScript type definitions for your database schema.
// 
// Tables: ${this.schema.tables.length}
// Relationships: ${this.schema.relationships.length}
//
// Usage:
//   import type { Database } from './database.types';
//`;
  }

  /**
   * Generate types for a single table
   */
  private generateTableTypes(table: Table): string {
    const lines: string[] = [];
    const typeName = this.toPascalCase(table.name);

    // Table comment
    if (this.options.includeComments && table.comment) {
      lines.push(`// ${table.comment}`);
    }

    // Base interface
    lines.push(`export interface ${typeName} {`);
    table.columns.forEach(col => {
      if (this.options.includeComments && col.comment) {
        lines.push(`  /** ${col.comment} */`);
      }
      const nullable = col.nullable ? ' | null' : '';
      lines.push(`  ${col.name}: ${this.getTypescriptType(col)}${nullable};`);
    });
    lines.push('}');

    // Insert type (optional fields with defaults)
    if (this.options.includeInsertTypes) {
      lines.push('');
      lines.push(`export interface ${typeName}Insert {`);
      table.columns.forEach(col => {
        const hasDefault = col.defaultValue || col.constraints.some(c => c.type === 'DEFAULT');
        const nullable = col.nullable || hasDefault ? '?' : '';
        const type = col.nullable ? ` ${this.getTypescriptType(col)} | null` : ` ${this.getTypescriptType(col)}`;
        lines.push(`  ${col.name}${nullable}:${type};`);
      });
      lines.push('}');
    }

    // Update type (all optional)
    if (this.options.includeUpdateTypes) {
      lines.push('');
      lines.push(`export interface ${typeName}Update {`);
      table.columns.forEach(col => {
        const nullable = col.nullable ? ' | null' : '';
        lines.push(`  ${col.name}?: ${this.getTypescriptType(col)}${nullable};`);
      });
      lines.push('}');
    }

    return lines.join('\n');
  }

  /**
   * Generate database interface
   */
  private generateDatabaseInterface(): string {
    const lines: string[] = [];

    lines.push('export interface Database {');
    this.schema.tables.forEach(table => {
      const typeName = this.toPascalCase(table.name);
      lines.push(`  ${table.name}: ${typeName};`);
    });
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Get TypeScript type for column
   */
  private getTypescriptType(column: Column): string {
    switch (column.type) {
      case 'UUID':
      case 'VARCHAR':
      case 'CHAR':
      case 'TEXT':
        return 'string';
      case 'INTEGER':
      case 'SMALLINT':
      case 'BIGINT':
      case 'NUMERIC':
      case 'DECIMAL':
      case 'REAL':
      case 'DOUBLE PRECISION':
        return 'number';
      case 'BOOLEAN':
        return 'boolean';
      case 'DATE':
      case 'TIMESTAMP':
      case 'TIMESTAMPTZ':
        return 'Date';
      case 'JSONB':
      case 'JSON':
        return 'Record<string, any>';
      default:
        return 'unknown';
    }
  }

  /**
   * Get Supabase type for column
   */
  private getSupabaseType(column: Column): string {
    switch (column.type) {
      case 'UUID':
      case 'VARCHAR':
      case 'CHAR':
      case 'TEXT':
        return 'string';
      case 'INTEGER':
      case 'SMALLINT':
      case 'BIGINT':
      case 'NUMERIC':
      case 'DECIMAL':
      case 'REAL':
      case 'DOUBLE PRECISION':
        return 'number';
      case 'BOOLEAN':
        return 'boolean';
      case 'DATE':
      case 'TIMESTAMP':
      case 'TIMESTAMPTZ':
        return 'string'; // Supabase returns dates as ISO strings
      case 'JSONB':
      case 'JSON':
        return 'Json';
      default:
        return 'unknown';
    }
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
}

/**
 * Convenience function to generate types
 */
export function generateTypes(
  schema: DatabaseSchema,
  options: Partial<TypeGeneratorOptions> = {}
): GeneratedMigration[] {
  const generator = new TypeGenerator(schema, options);
  return generator.generateTypes();
}