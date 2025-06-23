'use client';

import { generateMigrations, type MigrationOptions } from '../supabase/migration-formatter';
import { TypeGenerator } from '../supabase/type-generator';
import type { DatabaseSchema, Table, Column, Relationship } from '../../types/schema.types';

export interface ExportFormat {
  id: string;
  name: string;
  description: string;
  extension: string;
  mimeType: string;
  category: 'sql' | 'types' | 'documentation' | 'data' | 'config';
  icon: string;
  supportsOptions?: boolean;
}

export interface ExportOptions {
  format: string;
  includeComments?: boolean;
  includeDropStatements?: boolean;
  includeRLS?: boolean;
  includeIndexes?: boolean;
  includeConstraints?: boolean;
  includeData?: boolean;
  tablePrefix?: string;
  indentation?: 'spaces' | 'tabs';
  spacesCount?: number;
  lineEnding?: 'lf' | 'crlf';
  customOptions?: Record<string, unknown>;
}

export interface ExportResult {
  files: {
    filename: string;
    content: string;
    mimeType: string;
    size: number;
  }[];
  metadata: {
    format: string;
    generatedAt: Date;
    schema: {
      name: string;
      version: string;
      tableCount: number;
      columnCount: number;
      relationshipCount: number;
    };
    options: ExportOptions;
  };
}

// Type definitions for JSON Schema
interface JSONSchemaProperty {
  type: string;
  format?: string;
  maxLength?: number;
  description?: string;
}

interface JSONTableSchema {
  type: string;
  description?: string;
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

interface JSONSchema {
  $schema: string;
  title: string;
  description: string;
  type: string;
  properties: Record<string, { $ref: string }>;
  definitions: Record<string, JSONTableSchema>;
}

/**
 * Comprehensive export manager supporting multiple output formats
 */
export class ExportManager {
  private static readonly FORMATS: ExportFormat[] = [
    // SQL Formats
    {
      id: 'supabase-migration',
      name: 'Supabase Migration',
      description: 'SQL migration files compatible with Supabase CLI',
      extension: 'sql',
      mimeType: 'application/sql',
      category: 'sql',
      icon: 'database',
      supportsOptions: true,
    },
    {
      id: 'postgresql',
      name: 'PostgreSQL DDL',
      description: 'Standard PostgreSQL Data Definition Language',
      extension: 'sql',
      mimeType: 'application/sql',
      category: 'sql',
      icon: 'database',
      supportsOptions: true,
    },
    {
      id: 'prisma-schema',
      name: 'Prisma Schema',
      description: 'Prisma ORM schema definition file',
      extension: 'prisma',
      mimeType: 'text/plain',
      category: 'config',
      icon: 'settings',
      supportsOptions: true,
    },
    {
      id: 'drizzle-schema',
      name: 'Drizzle Schema',
      description: 'Drizzle ORM TypeScript schema',
      extension: 'ts',
      mimeType: 'application/typescript',
      category: 'config',
      icon: 'code',
      supportsOptions: true,
    },
    {
      id: 'sequelize-models',
      name: 'Sequelize Models',
      description: 'Sequelize ORM model definitions',
      extension: 'js',
      mimeType: 'application/javascript',
      category: 'config',
      icon: 'code',
    },

    // TypeScript/Type Definitions
    {
      id: 'typescript-types',
      name: 'TypeScript Types',
      description: 'TypeScript interface definitions',
      extension: 'ts',
      mimeType: 'application/typescript',
      category: 'types',
      icon: 'type',
      supportsOptions: true,
    },
    {
      id: 'supabase-types',
      name: 'Supabase Generated Types',
      description: 'Supabase-compatible TypeScript types',
      extension: 'ts',
      mimeType: 'application/typescript',
      category: 'types',
      icon: 'type',
    },
    {
      id: 'zod-schemas',
      name: 'Zod Validation Schemas',
      description: 'Zod runtime validation schemas',
      extension: 'ts',
      mimeType: 'application/typescript',
      category: 'types',
      icon: 'shield',
    },

    // Documentation
    {
      id: 'markdown-docs',
      name: 'Markdown Documentation',
      description: 'Comprehensive schema documentation',
      extension: 'md',
      mimeType: 'text/markdown',
      category: 'documentation',
      icon: 'file-text',
      supportsOptions: true,
    },
    {
      id: 'html-docs',
      name: 'HTML Documentation',
      description: 'Interactive HTML documentation',
      extension: 'html',
      mimeType: 'text/html',
      category: 'documentation',
      icon: 'globe',
    },
    {
      id: 'json-schema',
      name: 'JSON Schema',
      description: 'JSON Schema specification format',
      extension: 'json',
      mimeType: 'application/json',
      category: 'config',
      icon: 'braces',
    },

    // Data Formats
    {
      id: 'dbml',
      name: 'DBML',
      description: 'Database Markup Language for dbdiagram.io',
      extension: 'dbml',
      mimeType: 'text/plain',
      category: 'config',
      icon: 'share-2',
    },
    {
      id: 'plantuml',
      name: 'PlantUML',
      description: 'PlantUML entity relationship diagram',
      extension: 'puml',
      mimeType: 'text/plain',
      category: 'documentation',
      icon: 'git-branch',
    },
    {
      id: 'mermaid',
      name: 'Mermaid Diagram',
      description: 'Mermaid entity relationship diagram',
      extension: 'mmd',
      mimeType: 'text/plain',
      category: 'documentation',
      icon: 'git-branch',
    },

    // Configuration Files
    {
      id: 'docker-compose',
      name: 'Docker Compose',
      description: 'Docker Compose with PostgreSQL setup',
      extension: 'yml',
      mimeType: 'application/yaml',
      category: 'config',
      icon: 'container',
    },
    {
      id: 'kubernetes-manifest',
      name: 'Kubernetes Manifest',
      description: 'Kubernetes deployment with PostgreSQL',
      extension: 'yaml',
      mimeType: 'application/yaml',
      category: 'config',
      icon: 'cloud',
    },
  ];

  /**
   * Get all available export formats
   */
  static getFormats(): ExportFormat[] {
    return [...this.FORMATS];
  }

  /**
   * Get formats by category
   */
  static getFormatsByCategory(category: ExportFormat['category']): ExportFormat[] {
    return this.FORMATS.filter(format => format.category === category);
  }

  /**
   * Get format by ID
   */
  static getFormat(formatId: string): ExportFormat | undefined {
    return this.FORMATS.find(format => format.id === formatId);
  }

  /**
   * Export schema in specified format
   */
  static async exportSchema(
    schema: DatabaseSchema,
    options: ExportOptions
  ): Promise<ExportResult> {
    const format = this.getFormat(options.format);
    if (!format) {
      throw new Error(`Unknown export format: ${options.format}`);
    }

    const files = await this.generateFiles(schema, format, options);
    
    return {
      files: files.map(file => ({
        ...file,
        size: new Blob([file.content]).size,
      })),
      metadata: {
        format: format.id,
        generatedAt: new Date(),
        schema: {
          name: schema.name,
          version: schema.version,
          tableCount: schema.tables.length,
          columnCount: schema.tables.reduce((acc, table) => acc + table.columns.length, 0),
          relationshipCount: schema.relationships?.length || 0,
        },
        options,
      },
    };
  }

  /**
   * Export multiple formats at once
   */
  static async exportMultiple(
    schema: DatabaseSchema,
    formats: string[],
    baseOptions: Partial<ExportOptions> = {}
  ): Promise<Record<string, ExportResult>> {
    const results: Record<string, ExportResult> = {};

    for (const formatId of formats) {
      const options: ExportOptions = {
        ...baseOptions,
        format: formatId,
      };
      
      try {
        results[formatId] = await this.exportSchema(schema, options);
      } catch (error) {
        console.error(`Failed to export format ${formatId}:`, error);
        // Continue with other formats
      }
    }

    return results;
  }

  /**
   * Generate files for specific format
   */
  private static async generateFiles(
    schema: DatabaseSchema,
    format: ExportFormat,
    options: ExportOptions
  ): Promise<{ filename: string; content: string; mimeType: string }[]> {
    switch (format.id) {
      case 'supabase-migration':
        return this.generateSupabaseMigration(schema, options);
      
      case 'postgresql':
        return this.generatePostgreSQLDDL(schema, options);
      
      case 'prisma-schema':
        return this.generatePrismaSchema(schema);
      
      case 'drizzle-schema':
        return this.generateDrizzleSchema(schema);
      
      case 'typescript-types':
        return this.generateTypeScriptTypes(schema, options);
      
      case 'supabase-types':
        return this.generateSupabaseTypes(schema, options);
      
      case 'zod-schemas':
        return this.generateZodSchemas(schema);
      
      case 'markdown-docs':
        return this.generateMarkdownDocs(schema);
      
      case 'html-docs':
        return this.generateHTMLDocs(schema);
      
      case 'json-schema':
        return this.generateJSONSchema(schema);
      
      case 'dbml':
        return this.generateDBML(schema);
      
      case 'plantuml':
        return this.generatePlantUML(schema);
      
      case 'mermaid':
        return this.generateMermaid(schema);
      
      case 'docker-compose':
        return this.generateDockerCompose(schema, options);
      
      case 'kubernetes-manifest':
        return this.generateKubernetesManifest(schema);
      
      default:
        throw new Error(`Export format not implemented: ${format.id}`);
    }
  }

  /**
   * Generate Supabase migration files
   */
  private static generateSupabaseMigration(
    schema: DatabaseSchema,
    options: ExportOptions
  ): { filename: string; content: string; mimeType: string }[] {
    const migrationOptions: MigrationOptions = {
      format: 'migration',
      includeComments: options.includeComments ?? true,
      includeDropStatements: options.includeDropStatements ?? false,
      includeRLS: options.includeRLS ?? true,
      includeIndexes: options.includeIndexes ?? true,
    };

    const migrations = generateMigrations(schema, migrationOptions);
    
    return migrations.map((migration, index) => ({
      filename: migration.filename || `${String(index + 1).padStart(3, '0')}_${schema.name.toLowerCase().replace(/\s+/g, '_')}.sql`,
      content: migration.content,
      mimeType: 'application/sql',
    }));
  }

  /**
   * Generate PostgreSQL DDL
   */
  private static generatePostgreSQLDDL(
    schema: DatabaseSchema,
    options: ExportOptions
  ): { filename: string; content: string; mimeType: string }[] {
    const migrationOptions: MigrationOptions = {
      format: 'declarative',
      includeComments: options.includeComments ?? true,
      includeDropStatements: options.includeDropStatements ?? false,
      includeRLS: options.includeRLS ?? false,
      includeIndexes: options.includeIndexes ?? true,
    };

    const migrations = generateMigrations(schema, migrationOptions);
    
    return [{
      filename: `${schema.name.toLowerCase().replace(/\s+/g, '_')}_schema.sql`,
      content: migrations.map(m => m.content).join('\n\n'),
      mimeType: 'application/sql',
    }];
  }

  /**
   * Generate Prisma schema
   */
  private static generatePrismaSchema(
    schema: DatabaseSchema,
  ): { filename: string; content: string; mimeType: string }[] {
    let content = `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

`;

    // Generate models for each table
    schema.tables.forEach(table => {
      content += this.generatePrismaModel(table);
      content += '\n';
    });

    return [{
      filename: 'schema.prisma',
      content,
      mimeType: 'text/plain',
    }];
  }

  /**
   * Generate Drizzle schema
   */
  private static generateDrizzleSchema(
    schema: DatabaseSchema,
  ): { filename: string; content: string; mimeType: string }[] {
    let content = `import { pgTable, uuid, varchar, text, integer, bigint, decimal, boolean, timestamp, jsonb, index, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

`;

    // Generate table definitions
    schema.tables.forEach(table => {
      content += this.generateDrizzleTable(table);
      content += '\n';
    });

    // Generate relations if any
    if (schema.relationships && schema.relationships.length > 0) {
      content += '\n// Relations\n';
      schema.tables.forEach(table => {
        const tableRelations = schema.relationships?.filter(
          rel => rel.sourceTable === table.name || rel.targetTable === table.name
        );
        
        if (tableRelations && tableRelations.length > 0) {
          content += this.generateDrizzleRelations(table, tableRelations);
          content += '\n';
        }
      });
    }

    return [{
      filename: 'schema.ts',
      content,
      mimeType: 'application/typescript',
    }];
  }

  /**
   * Generate TypeScript types
   */
  private static generateTypeScriptTypes(
    schema: DatabaseSchema,
    options: ExportOptions
  ): { filename: string; content: string; mimeType: string }[] {
    const typeGenerator = new TypeGenerator(schema, {
      format: 'typescript',
      includeComments: options.includeComments ?? true,
    });
    const types = typeGenerator.generateTypes();

    return types.map(type => ({
      filename: type.filename || 'types.ts',
      content: type.content,
      mimeType: 'application/typescript',
    }));
  }

  /**
   * Generate Supabase types
   */
  private static generateSupabaseTypes(
    schema: DatabaseSchema,
    options: ExportOptions
  ): { filename: string; content: string; mimeType: string }[] {
    const typeGenerator = new TypeGenerator(schema, {
      format: 'supabase',
      includeComments: options.includeComments ?? true,
    });
    const types = typeGenerator.generateTypes();

    return types.map(type => ({
      filename: type.filename || 'database.types.ts',
      content: type.content,
      mimeType: 'application/typescript',
    }));
  }

  /**
   * Generate Zod schemas
   */
  private static generateZodSchemas(
    schema: DatabaseSchema,
  ): { filename: string; content: string; mimeType: string }[] {
    let content = `import { z } from 'zod';

`;

    schema.tables.forEach(table => {
      content += this.generateZodSchema(table);
      content += '\n';
    });

    return [{
      filename: 'schemas.ts',
      content,
      mimeType: 'application/typescript',
    }];
  }

  /**
   * Generate Markdown documentation
   */
  private static generateMarkdownDocs(
    schema: DatabaseSchema,
  ): { filename: string; content: string; mimeType: string }[] {
    let content = `# ${schema.name} Database Schema

${schema.version ? `**Version:** ${schema.version}` : ''}

## Overview

This document describes the database schema for ${schema.name}.

### Statistics

- **Tables:** ${schema.tables.length}
- **Total Columns:** ${schema.tables.reduce((acc, table) => acc + table.columns.length, 0)}
- **Relationships:** ${schema.relationships?.length || 0}

## Tables

`;

    schema.tables.forEach(table => {
      content += this.generateTableMarkdown(table);
      content += '\n';
    });

    if (schema.relationships && schema.relationships.length > 0) {
      content += '\n## Relationships\n\n';
      schema.relationships.forEach(rel => {
        content += `- **${rel.name}**: ${rel.sourceTable}.${rel.sourceColumn} → ${rel.targetTable}.${rel.targetColumn} (${rel.type})\n`;
      });
    }

    return [{
      filename: `${schema.name.toLowerCase().replace(/\s+/g, '_')}_schema.md`,
      content,
      mimeType: 'text/markdown',
    }];
  }

  /**
   * Generate HTML documentation
   */
  private static generateHTMLDocs(
    schema: DatabaseSchema,
  ): { filename: string; content: string; mimeType: string }[] {
    const content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${schema.name} - Database Schema</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { border-bottom: 2px solid #ddd; padding-bottom: 20px; margin-bottom: 30px; }
        .table { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .table-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #ddd; }
        .table-content { padding: 15px; }
        .column { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .column:last-child { border-bottom: none; }
        .badge { background: #007bff; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; }
        .primary-key { background: #ffc107; color: #000; }
        .foreign-key { background: #6f42c1; }
        .not-null { background: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        ${this.generateHTMLContent(schema)}
    </div>
</body>
</html>`;

    return [{
      filename: `${schema.name.toLowerCase().replace(/\s+/g, '_')}_schema.html`,
      content,
      mimeType: 'text/html',
    }];
  }

  /**
   * Generate JSON Schema
   */
  private static generateJSONSchema(
    schema: DatabaseSchema
  ): { filename: string; content: string; mimeType: string }[] {
    const jsonSchema: JSONSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: schema.name,
      description: `Database schema for ${schema.name}`,
      type: 'object',
      properties: {},
      definitions: {},
    };

    // Generate table schemas
    schema.tables.forEach(table => {
      const tableSchema = this.generateJSONTableSchema(table);
      jsonSchema.definitions[table.name] = tableSchema;
      jsonSchema.properties[table.name] = {
        $ref: `#/definitions/${table.name}`,
      };
    });

    return [{
      filename: 'schema.json',
      content: JSON.stringify(jsonSchema, null, 2),
      mimeType: 'application/json',
    }];
  }

  /**
   * Generate DBML
   */
  private static generateDBML(
    schema: DatabaseSchema
  ): { filename: string; content: string; mimeType: string }[] {
    let content = `Project ${schema.name} {\n  database_type: 'PostgreSQL'\n  Note: '${schema.name} database schema'\n}\n\n`;

    // Generate tables
    schema.tables.forEach(table => {
      content += this.generateDBMLTable(table);
      content += '\n';
    });

    // Generate relationships
    if (schema.relationships && schema.relationships.length > 0) {
      content += '\n// Relationships\n';
      schema.relationships.forEach(rel => {
        const relType = rel.type === 'one-to-many' ? '>' : 
                       rel.type === 'one-to-one' ? '-' : '<>';
        content += `Ref: ${rel.sourceTable}.${rel.sourceColumn} ${relType} ${rel.targetTable}.${rel.targetColumn}\n`;
      });
    }

    return [{
      filename: `${schema.name.toLowerCase().replace(/\s+/g, '_')}.dbml`,
      content,
      mimeType: 'text/plain',
    }];
  }

  /**
   * Generate PlantUML
   */
  private static generatePlantUML(
    schema: DatabaseSchema
  ): { filename: string; content: string; mimeType: string }[] {
    let content = `@startuml ${schema.name}
!theme plain

`;

    // Generate entities
    schema.tables.forEach(table => {
      content += `entity "${table.name}" {\n`;
      table.columns.forEach(column => {
        const isPK = column.constraints?.some(c => c.type.includes('PRIMARY KEY'));
        const prefix = isPK ? '* ' : '';
        content += `  ${prefix}${column.name} : ${column.type}\n`;
      });
      content += '}\n\n';
    });

    // Generate relationships
    if (schema.relationships && schema.relationships.length > 0) {
      schema.relationships.forEach(rel => {
        const relSymbol = rel.type === 'one-to-many' ? '||--o{' : 
                         rel.type === 'one-to-one' ? '||--||' : '}o--o{';
        content += `"${rel.sourceTable}" ${relSymbol} "${rel.targetTable}"\n`;
      });
    }

    content += '\n@enduml';

    return [{
      filename: `${schema.name.toLowerCase().replace(/\s+/g, '_')}.puml`,
      content,
      mimeType: 'text/plain',
    }];
  }

  /**
   * Generate Mermaid diagram
   */
  private static generateMermaid(
    schema: DatabaseSchema
  ): { filename: string; content: string; mimeType: string }[] {
    let content = `erDiagram\n`;

    // Generate entities
    schema.tables.forEach(table => {
      content += `    ${table.name.toUpperCase()} {\n`;
      table.columns.forEach(column => {
        const type = this.postgresTypeToMermaidType(column.type);
        const isPK = column.constraints?.some(c => c.type.includes('PRIMARY KEY'));
        const constraint = isPK ? ' PK' : 
                          column.constraints?.some(c => c.type.includes('FOREIGN KEY')) ? ' FK' : '';
        content += `        ${type} ${column.name}${constraint}\n`;
      });
      content += '    }\n';
    });

    // Generate relationships
    if (schema.relationships && schema.relationships.length > 0) {
      schema.relationships.forEach(rel => {
        const relSymbol = rel.type === 'one-to-many' ? '||--o{' : 
                         rel.type === 'one-to-one' ? '||--||' : '}o--o{';
        content += `    ${rel.sourceTable.toUpperCase()} ${relSymbol} ${rel.targetTable.toUpperCase()} : "${rel.name}"\n`;
      });
    }

    return [{
      filename: `${schema.name.toLowerCase().replace(/\s+/g, '_')}.mmd`,
      content,
      mimeType: 'text/plain',
    }];
  }

  /**
   * Generate Docker Compose
   */
  private static generateDockerCompose(
    schema: DatabaseSchema,
    options: ExportOptions
  ): { filename: string; content: string; mimeType: string }[] {
    const content = `version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ${schema.name.toLowerCase().replace(/\s+/g, '_')}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  postgres_data:
`;

    // Also generate init.sql
    const migrationOptions: MigrationOptions = {
      format: 'declarative',
      includeComments: options.includeComments ?? true,
      includeDropStatements: false,
      includeRLS: false,
      includeIndexes: options.includeIndexes ?? true,
    };

    const migrations = generateMigrations(schema, migrationOptions);
    const initSQL = migrations.map(m => m.content).join('\n\n');

    return [
      {
        filename: 'docker-compose.yml',
        content,
        mimeType: 'application/yaml',
      },
      {
        filename: 'init.sql',
        content: initSQL,
        mimeType: 'application/sql',
      }
    ];
  }

  /**
   * Generate Kubernetes manifest
   */
  private static generateKubernetesManifest(
    schema: DatabaseSchema
  ): { filename: string; content: string; mimeType: string }[] {
    const appName = schema.name.toLowerCase().replace(/\s+/g, '-');
    
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-${appName}
  labels:
    app: postgres-${appName}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres-${appName}
  template:
    metadata:
      labels:
        app: postgres-${appName}
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_DB
          value: "${schema.name.toLowerCase().replace(/\s+/g, '_')}"
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          value: "password"
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc-${appName}
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service-${appName}
spec:
  selector:
    app: postgres-${appName}
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc-${appName}
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
`;

    return [{
      filename: 'postgres-deployment.yaml',
      content,
      mimeType: 'application/yaml',
    }];
  }

  // Helper methods for specific format generation
  private static generatePrismaModel(table: Table): string {
    let content = `model ${this.toPascalCase(table.name)} {\n`;
    
    table.columns.forEach(column => {
      const prismaType = this.postgresTypeToPrismaType(column.type);
      const optional = column.nullable ? '?' : '';
      const attributes = this.getPrismaAttributes(column);
      
      content += `  ${column.name} ${prismaType}${optional}${attributes}\n`;
    });

    // Add table-level attributes
    content += `\n  @@map("${table.name}")\n`;
    content += '}\n';
    
    return content;
  }

  private static generateDrizzleTable(table: Table): string {
    const tableName = `${table.name}Table`;
    let content = `export const ${tableName} = pgTable('${table.name}', {\n`;
    
    table.columns.forEach(column => {
      const drizzleType = this.postgresTypeToDrizzleType(column.type, column);
      content += `  ${column.name}: ${drizzleType},\n`;
    });
    
    content += '});';
    return content;
  }

  private static generateZodSchema(table: Table): string {
    const schemaName = `${this.toPascalCase(table.name)}Schema`;
    let content = `export const ${schemaName} = z.object({\n`;
    
    table.columns.forEach(column => {
      const zodType = this.postgresTypeToZodType(column.type, column);
      content += `  ${column.name}: ${zodType},\n`;
    });
    
    content += '});';
    return content;
  }

  // Additional helper methods would be implemented here for type conversions, formatting, etc.
  private static toPascalCase(str: string): string {
    return str.replace(/(^|_)([a-z])/g, (_, __, char) => char.toUpperCase());
  }

  private static postgresTypeToPrismaType(pgType: string): string {
    const typeMap: Record<string, string> = {
      'UUID': 'String',
      'VARCHAR': 'String',
      'TEXT': 'String',
      'INTEGER': 'Int',
      'BIGINT': 'BigInt',
      'DECIMAL': 'Decimal',
      'BOOLEAN': 'Boolean',
      'TIMESTAMPTZ': 'DateTime',
      'JSONB': 'Json',
    };
    return typeMap[pgType] || 'String';
  }

  private static postgresTypeToDrizzleType(pgType: string, column: Column): string {
    const baseType = pgType.toLowerCase();
    
    switch (baseType) {
      case 'uuid':
        return 'uuid(\'id\').primaryKey().defaultRandom()';
      case 'varchar':
        return `varchar('${column.name}', { length: ${column.length || 255} })`;
      case 'text':
        return `text('${column.name}')`;
      case 'integer':
        return `integer('${column.name}')`;
      case 'bigint':
        return `bigint('${column.name}', { mode: 'number' })`;
      case 'decimal':
        return `decimal('${column.name}')`;
      case 'boolean':
        return `boolean('${column.name}')`;
      case 'timestamptz':
        return `timestamp('${column.name}', { withTimezone: true })`;
      case 'jsonb':
        return `jsonb('${column.name}')`;
      default:
        return `text('${column.name}')`;
    }
  }

  private static postgresTypeToZodType(pgType: string, column: Column): string {
    const baseType = pgType.toLowerCase();
    let zodType = '';
    
    switch (baseType) {
      case 'uuid':
      case 'varchar':
      case 'text':
        zodType = 'z.string()';
        break;
      case 'integer':
      case 'bigint':
        zodType = 'z.number().int()';
        break;
      case 'decimal':
        zodType = 'z.number()';
        break;
      case 'boolean':
        zodType = 'z.boolean()';
        break;
      case 'timestamptz':
        zodType = 'z.date()';
        break;
      case 'jsonb':
        zodType = 'z.record(z.any())';
        break;
      default:
        zodType = 'z.string()';
    }
    
    if (column.nullable) {
      zodType += '.nullable()';
    }
    
    return zodType;
  }

  private static getPrismaAttributes(column: Column): string {
    const attributes: string[] = [];
    
    if (column.constraints?.some(c => c.type.includes('PRIMARY KEY'))) {
      attributes.push('@id');
      if (column.type === 'UUID') {
        attributes.push('@default(uuid())');
      }
    }
    
    if (column.defaultValue && !attributes.some(a => a.includes('@default'))) {
      if (column.defaultValue === 'NOW()') {
        attributes.push('@default(now())');
      } else if (column.defaultValue === 'uuid_generate_v4()') {
        attributes.push('@default(uuid())');
      }
    }
    
    return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
  }

  private static postgresTypeToMermaidType(pgType: string): string {
    const typeMap: Record<string, string> = {
      'UUID': 'uuid',
      'VARCHAR': 'string',
      'TEXT': 'text',
      'INTEGER': 'int',
      'BIGINT': 'bigint',
      'DECIMAL': 'decimal',
      'BOOLEAN': 'boolean',
      'TIMESTAMPTZ': 'timestamp',
      'JSONB': 'json',
    };
    return typeMap[pgType] || 'string';
  }

  // Additional helper methods for generating table documentation, HTML content, etc.
  private static generateTableMarkdown(table: Table): string {
    let content = `### ${table.name}\n\n`;
    
    if (table.comment) {
      content += `${table.comment}\n\n`;
    }
    
    content += '| Column | Type | Nullable | Default | Constraints | Comment |\n';
    content += '|--------|------|----------|---------|-------------|----------|\n';
    
    table.columns.forEach(column => {
      const constraints = column.constraints?.map(c => c.type).join(', ') || '';
      content += `| ${column.name} | ${column.type} | ${column.nullable ? 'Yes' : 'No'} | ${column.defaultValue || ''} | ${constraints} | ${column.comment || ''} |\n`;
    });
    
    return content;
  }

  private static generateHTMLContent(schema: DatabaseSchema): string {
    let content = `
        <div class="header">
            <h1>${schema.name}</h1>
            <p>Database Schema Documentation</p>
            <div style="display: flex; gap: 20px; margin-top: 10px;">
                <span><strong>Tables:</strong> ${schema.tables.length}</span>
                <span><strong>Relationships:</strong> ${schema.relationships?.length || 0}</span>
                <span><strong>Generated:</strong> ${new Date().toLocaleDateString()}</span>
            </div>
        </div>
    `;

    schema.tables.forEach(table => {
      content += `
        <div class="table">
            <div class="table-header">
                <h2>${table.name}</h2>
                ${table.comment ? `<p>${table.comment}</p>` : ''}
            </div>
            <div class="table-content">
      `;
      
      table.columns.forEach(column => {
        const isPK = column.constraints?.some(c => c.type.includes('PRIMARY KEY'));
        const isFK = column.constraints?.some(c => c.type.includes('FOREIGN KEY'));
        const badges = [];
        
        if (isPK) badges.push('<span class="badge primary-key">PK</span>');
        if (isFK) badges.push('<span class="badge foreign-key">FK</span>');
        if (!column.nullable) badges.push('<span class="badge not-null">NOT NULL</span>');
        
        content += `
                <div class="column">
                    <div>
                        <strong>${column.name}</strong>
                        <span style="color: #666;">${column.type}</span>
                        ${badges.join(' ')}
                    </div>
                    <div style="color: #888; font-size: 0.9em;">
                        ${column.comment || ''}
                    </div>
                </div>
        `;
      });
      
      content += `
            </div>
        </div>
      `;
    });

    return content;
  }

  private static generateJSONTableSchema(table: Table): JSONTableSchema {
    const properties: Record<string, JSONSchemaProperty> = {};
    const required: string[] = [];

    table.columns.forEach(column => {
      properties[column.name] = this.columnToJSONSchema(column);
      if (!column.nullable) {
        required.push(column.name);
      }
    });

    const result: JSONTableSchema = {
      type: 'object',
      properties,
    };

    if (table.comment) {
      result.description = table.comment;
    }

    if (required.length > 0) {
      result.required = required;
    }

    return result;
  }

  private static columnToJSONSchema(column: Column): JSONSchemaProperty {
    const baseType = column.type.toLowerCase();
    const schema: JSONSchemaProperty = {
      type: 'string', // default type
    };

    switch (baseType) {
      case 'uuid':
      case 'varchar':
      case 'text':
        schema.type = 'string';
        if (baseType === 'uuid') {
          schema.format = 'uuid';
        }
        if (column.length) {
          schema.maxLength = column.length;
        }
        break;
      case 'integer':
      case 'bigint':
        schema.type = 'integer';
        break;
      case 'decimal':
        schema.type = 'number';
        break;
      case 'boolean':
        schema.type = 'boolean';
        break;
      case 'timestamptz':
        schema.type = 'string';
        schema.format = 'date-time';
        break;
      case 'jsonb':
        schema.type = 'object';
        break;
      default:
        schema.type = 'string';
    }

    if (column.comment) {
      schema.description = column.comment;
    }

    return schema;
  }

  private static generateDBMLTable(table: Table): string {
    let content = `Table ${table.name} {\n`;
    
    table.columns.forEach(column => {
      const isPK = column.constraints?.some(c => c.type.includes('PRIMARY KEY'));
      const attributes = [];
      
      if (isPK) attributes.push('pk');
      if (!column.nullable) attributes.push('not null');
      if (column.defaultValue) attributes.push(`default: ${column.defaultValue}`);
      
      const attrStr = attributes.length > 0 ? ` [${attributes.join(', ')}]` : '';
      const noteStr = column.comment ? ` // ${column.comment}` : '';
      
      content += `  ${column.name} ${column.type}${attrStr}${noteStr}\n`;
    });
    
    if (table.comment) {
      content += `\n  Note: '${table.comment}'\n`;
    }
    
    content += '}';
    return content;
  }

  private static generateDrizzleRelations(table: Table, relations: Relationship[]): string {
    const relationName = `${table.name}Relations`;
    let content = `export const ${relationName} = relations(${table.name}Table, ({ one, many }) => ({\n`;
    
    relations.forEach(rel => {
      const isSource = rel.sourceTable === table.name;
      const relType = rel.type === 'one-to-many' ? (isSource ? 'many' : 'one') : 'one';
      const targetTable = isSource ? rel.targetTable : rel.sourceTable;
      
      content += `  ${targetTable}: ${relType}(${targetTable}Table),\n`;
    });
    
    content += '}));';
    return content;
  }
}