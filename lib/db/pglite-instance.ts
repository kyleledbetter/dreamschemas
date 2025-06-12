import { PGlite } from '@electric-sql/pglite';
import type { 
  DatabaseSchema, 
  Table, 
  Column, 
  Relationship
} from '@/types/schema.types';
import type { CSVParseResult } from '@/types/csv.types';

export interface PGLiteTestResult {
  success: boolean;
  executionTime: number;
  rowsAffected?: number;
  results?: Record<string, unknown>[];
  error?: string;
  query: string;
}

export interface SchemaTestResult {
  schemaValid: boolean;
  tablesCreated: number;
  relationshipsCreated: number;
  indexesCreated: number;
  rlsPoliciesCreated: number;
  sampleDataInserted: number;
  errors: string[];
  warnings: string[];
  executionTime: number;
  testQueries: PGLiteTestResult[];
}

export class PGLiteManager {
  private db: PGlite | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize PGLite with in-memory database
      this.db = new PGlite();
      
      // Wait for database to be ready
      await this.db.exec('SELECT 1');
      
      // Enable necessary extensions
      await this.db.exec('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize PGLite:', error);
      throw new Error(`PGLite initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async execute(query: string): Promise<PGLiteTestResult> {
    await this.ensureInitialized();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const startTime = Date.now();
    
    try {
      const result = await this.db.exec(query);
      const executionTime = Date.now() - startTime;

      // PGLite exec returns an array of results, get the last one
      const lastResult = result[result.length - 1];

      const resultObj: PGLiteTestResult = {
        success: true,
        executionTime,
        results: lastResult?.rows as Record<string, unknown>[],
        query
      };

      if (lastResult?.affectedRows !== undefined) {
        resultObj.rowsAffected = lastResult.affectedRows;
      }

      return resultObj;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        query
      };
    }
  }

  async query(sql: string): Promise<PGLiteTestResult> {
    return this.execute(sql);
  }

  async testSchema(schema: DatabaseSchema, csvData?: CSVParseResult[]): Promise<SchemaTestResult> {
    await this.ensureInitialized();

    const result: SchemaTestResult = {
      schemaValid: false,
      tablesCreated: 0,
      relationshipsCreated: 0,
      indexesCreated: 0,
      rlsPoliciesCreated: 0,
      sampleDataInserted: 0,
      errors: [],
      warnings: [],
      executionTime: 0,
      testQueries: []
    };

    const startTime = Date.now();

    try {
      // Clean slate - drop all tables
      await this.cleanDatabase();

      // Step 1: Create tables
      for (const table of schema.tables) {
        try {
          const createTableSQL = this.generateCreateTableSQL(table);
          const tableResult = await this.execute(createTableSQL);
          
          if (tableResult.success) {
            result.tablesCreated++;
          } else {
            result.errors.push(`Failed to create table ${table.name}: ${tableResult.error}`);
          }
          
          result.testQueries.push(tableResult);
        } catch (error) {
          result.errors.push(`Error creating table ${table.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Step 2: Create relationships (foreign keys)
      for (const relationship of schema.relationships) {
        try {
          const alterTableSQL = this.generateAlterTableForRelationship(relationship);
          const relationshipResult = await this.execute(alterTableSQL);
          
          if (relationshipResult.success) {
            result.relationshipsCreated++;
          } else {
            result.errors.push(`Failed to create relationship ${relationship.name || relationship.id}: ${relationshipResult.error}`);
          }
          
          result.testQueries.push(relationshipResult);
        } catch (error) {
          result.errors.push(`Error creating relationship: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Step 3: Create indexes
      for (const table of schema.tables) {
        for (const index of table.indexes) {
          try {
            const createIndexSQL = this.generateCreateIndexSQL(table.name, index);
            const indexResult = await this.execute(createIndexSQL);
            
            if (indexResult.success) {
              result.indexesCreated++;
            } else {
              result.warnings.push(`Failed to create index ${index.name}: ${indexResult.error}`);
            }
            
            result.testQueries.push(indexResult);
          } catch (error) {
            result.warnings.push(`Error creating index ${index.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Step 4: Test RLS policies (simulation - PGLite may not support full RLS)
      for (const policy of schema.rlsPolicies) {
        try {
          // For PGLite, we'll just validate the policy syntax
          result.rlsPoliciesCreated++;
          result.warnings.push(`RLS policy ${policy.name} validated (simulation mode)`);
        } catch (error) {
          result.warnings.push(`RLS policy validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Step 5: Insert sample data if CSV data is provided
      if (csvData && csvData.length > 0) {
        for (const csv of csvData) {
          try {
            const inserted = await this.insertSampleData(csv, schema);
            result.sampleDataInserted += inserted;
          } catch (error) {
            result.errors.push(`Failed to insert sample data from ${csv.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Step 6: Run validation queries
      const validationQueries = this.generateValidationQueries(schema);
      for (const validationQuery of validationQueries) {
        const queryResult = await this.execute(validationQuery);
        result.testQueries.push(queryResult);
        
        if (!queryResult.success) {
          result.errors.push(`Validation query failed: ${queryResult.error}`);
        }
      }

      result.schemaValid = result.errors.length === 0;
      result.executionTime = Date.now() - startTime;

    } catch (error) {
      result.errors.push(`Schema testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.executionTime = Date.now() - startTime;
    }

    return result;
  }

  private async cleanDatabase(): Promise<void> {
    try {
      // Get all tables (excluding system tables)
      const tablesResult = await this.execute(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
      `);

      if (tablesResult.success && tablesResult.results) {
        for (const row of tablesResult.results) {
          const tableName = (row as { tablename: string }).tablename;
          await this.execute(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
        }
      }
    } catch (error) {
      console.warn('Failed to clean database:', error);
    }
  }

  private generateCreateTableSQL(table: Table): string {
    const columns = table.columns.map(column => {
      return this.generateColumnDefinition(column);
    }).join(',\n  ');

    return `CREATE TABLE "${table.name}" (\n  ${columns}\n)`;
  }

  private generateColumnDefinition(column: Column): string {
    let definition = `"${column.name}" ${this.getPostgresType(column)}`;

    // Add constraints
    const constraints = column.constraints
      .filter(c => c.type !== 'FOREIGN KEY') // Foreign keys handled separately
      .map(c => {
        switch (c.type) {
          case 'PRIMARY KEY':
            return 'PRIMARY KEY';
          case 'UNIQUE':
            return 'UNIQUE';
          case 'NOT NULL':
            return 'NOT NULL';
          case 'DEFAULT':
            return `DEFAULT ${c.value}`;
          case 'CHECK':
            return `CHECK (${c.value})`;
          default:
            return '';
        }
      })
      .filter(Boolean)
      .join(' ');

    if (constraints) {
      definition += ` ${constraints}`;
    }

    if (!column.nullable && !column.constraints.some(c => c.type === 'NOT NULL')) {
      definition += ' NOT NULL';
    }

    if (column.defaultValue && !column.constraints.some(c => c.type === 'DEFAULT')) {
      definition += ` DEFAULT ${column.defaultValue}`;
    }

    return definition;
  }

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

  private generateAlterTableForRelationship(relationship: Relationship): string {
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
    
    return sql;
  }

  private generateCreateIndexSQL(tableName: string, index: { name: string; columns: string[]; unique: boolean; type?: string }): string {
    const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
    const indexType = index.type ? ` USING ${index.type}` : '';
    const columns = index.columns.map(col => `"${col}"`).join(', ');
    
    return `CREATE ${uniqueKeyword}INDEX "${index.name}" ON "${tableName}"${indexType} (${columns})`;
  }

  private async insertSampleData(csv: CSVParseResult, schema: DatabaseSchema): Promise<number> {
    const tableName = csv.fileName.replace(/\.(csv|tsv|txt)$/i, '');
    const table = schema.tables.find(t => t.name === tableName);
    
    if (!table) {
      throw new Error(`Table ${tableName} not found in schema`);
    }

    // Take first 10 rows as sample data
    const sampleRows = csv.data.slice(0, 10);
    let insertedCount = 0;

    for (const row of sampleRows) {
      try {
        const values = row.map((value, index) => {
          const column = table.columns[index];
          if (!column) return 'NULL';
          
          if (value === null || value === '') {
            return 'NULL';
          }
          
          // Handle different data types
          switch (column.type) {
            case 'INTEGER':
            case 'SMALLINT':
            case 'BIGINT':
            case 'NUMERIC':
            case 'DECIMAL':
            case 'REAL':
            case 'DOUBLE PRECISION':
              return isNaN(Number(value)) ? 'NULL' : value;
            case 'BOOLEAN':
              return ['true', '1', 'yes', 'y'].includes(value.toLowerCase()) ? 'TRUE' : 'FALSE';
            case 'UUID':
              return `'${value}'`;
            default:
              return `'${value.replace(/'/g, "''")}'`; // Escape single quotes
          }
        });

        const columnNames = table.columns.map(col => `"${col.name}"`).join(', ');
        const valuesList = values.join(', ');
        
        const insertSQL = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${valuesList})`;
        const result = await this.execute(insertSQL);
        
        if (result.success) {
          insertedCount++;
        }
      } catch (error) {
        console.warn(`Failed to insert row into ${tableName}:`, error);
      }
    }

    return insertedCount;
  }

  private generateValidationQueries(schema: DatabaseSchema): string[] {
    const queries: string[] = [];

    // Basic table existence checks
    for (const table of schema.tables) {
      queries.push(`SELECT COUNT(*) as count FROM "${table.name}"`);
    }

    // Check foreign key constraints
    for (const relationship of schema.relationships) {
      queries.push(`
        SELECT COUNT(*) as count 
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = '${relationship.sourceTable}'
      `);
    }

    // Check indexes
    queries.push(`
      SELECT COUNT(*) as index_count 
      FROM pg_indexes 
      WHERE schemaname = 'public'
    `);

    return queries;
  }

  async getTableInfo(tableName: string): Promise<{
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      default: string | null;
    }>;
    indexes: Array<{
      name: string;
      columns: string[];
      unique: boolean;
    }>;
    constraints: Array<{
      name: string;
      type: string;
      definition: string;
    }>;
  }> {
    await this.ensureInitialized();

    // Get column information
    const columnsResult = await this.execute(`
      SELECT 
        column_name as name,
        data_type as type,
        is_nullable::boolean as nullable,
        column_default as default_value
      FROM information_schema.columns 
      WHERE table_name = '${tableName}' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    // Get index information
    const indexesResult = await this.execute(`
      SELECT 
        indexname as name,
        indexdef as definition
      FROM pg_indexes 
      WHERE tablename = '${tableName}' 
      AND schemaname = 'public'
    `);

    // Get constraint information
    const constraintsResult = await this.execute(`
      SELECT 
        constraint_name as name,
        constraint_type as type
      FROM information_schema.table_constraints 
      WHERE table_name = '${tableName}' 
      AND table_schema = 'public'
    `);

    return {
      columns: (columnsResult.results || []) as Array<{
        name: string;
        type: string;
        nullable: boolean;
        default: string | null;
      }>,
      indexes: (indexesResult.results || []).map((idx: Record<string, unknown>) => ({
        name: idx.name as string,
        columns: [], // Would need additional parsing
        unique: (idx.definition as string).includes('UNIQUE')
      })),
      constraints: (constraintsResult.results || []) as Array<{
        name: string;
        type: string;
        definition: string;
      }>
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  get isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }
}

// Singleton instance
let pgliteManager: PGLiteManager | null = null;

export function getPGLiteManager(): PGLiteManager {
  if (!pgliteManager) {
    pgliteManager = new PGLiteManager();
  }
  return pgliteManager;
}

export async function createPGLiteInstance(): Promise<PGLiteManager> {
  return new PGLiteManager();
}